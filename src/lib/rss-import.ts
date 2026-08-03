import Parser from "rss-parser";
import { createHash } from "crypto";
import { generateJSON } from "@tiptap/html";
import type { JSONContent } from "@tiptap/core";
import { prisma } from "@/lib/prisma";
import { bodyExtensions, extractText, linkifyDoc } from "@/lib/tiptap";
import { storeRemoteImage } from "@/lib/media-store";
import { dateStamp } from "@/lib/slug";
import { SITE_NAME, SITE_URL } from "@/lib/site";
import type { RssFeed } from "@prisma/client";

/**
 * 収集パイプライン(§6)。公式RSS/Atom等から日本語ソースを取り込み、
 * 「生ソース」として Article(draft, kind: ai_generated)+
 * ArticleTranslation(ja, status: pending)+ ArticleSource を作る。
 * 後段の generate cron が日本語マスター記事を生成する。
 * robots.txt 尊重・取得間隔・UA明示・全文転載禁止(§6.1)。
 */

const MAX_ITEMS_PER_FETCH = 30;
const MAX_INLINE_IMAGES = 10;

const BOT_UA = `${SITE_NAME.replace(/\s+/g, "")}Bot/1.0 (+${SITE_URL}/about)`;

type FeedItem = {
  title?: string;
  link?: string;
  guid?: string;
  isoDate?: string;
  pubDate?: string;
  content?: string;
  contentSnippet?: string;
  "content:encoded"?: string;
  enclosure?: { url?: string; type?: string };
  mediaContent?: { $?: { url?: string } }[];
};

const parser: Parser<object, FeedItem> = new Parser({
  timeout: 20_000,
  headers: { "User-Agent": BOT_UA },
  customFields: {
    item: [
      ["content:encoded", "content:encoded"],
      ["media:content", "mediaContent", { keepArray: true }],
    ],
  },
});

export type ImportResult = {
  imported: number;
  skipped: number;
  errors: number;
  articleIds: string[];
};

/** RSS取り込み記事の著者(システムユーザー)。編集部アカウントを優先 */
async function getImportUser() {
  const editorial =
    (await prisma.user.findUnique({ where: { slug: "editorial" } })) ??
    (await prisma.user.findFirst({ where: { role: "admin" } }));
  if (editorial) return editorial;
  throw new Error("No admin user found for RSS import");
}

function guidOf(item: FeedItem): string | null {
  const raw = item.guid || item.link;
  return raw ? raw.trim() : null;
}

export function hash8(s: string): string {
  return createHash("sha1").update(s).digest("hex").slice(0, 8);
}

/** HTML本文から <img> の src を列挙する */
function extractImgSrcs(html: string): string[] {
  const srcs: string[] = [];
  const re = /<img[^>]+src=["']([^"']+)["']/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    if (m[1].startsWith("http")) srcs.push(m[1]);
  }
  return [...new Set(srcs)];
}

function firstParagraphText(html: string, fallback: string): string {
  const stripped = html
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return (stripped || fallback).slice(0, 160);
}

function resolveHeroCandidate(item: FeedItem, html: string): string | null {
  if (item.enclosure?.url && (item.enclosure.type ?? "image/").startsWith("image/")) {
    return item.enclosure.url;
  }
  const media = item.mediaContent?.find((mc) => mc.$?.url)?.$?.url;
  if (media) return media;
  return extractImgSrcs(html)[0] ?? null;
}

/**
 * フィード内に画像が無い場合のフォールバック:
 * 元記事ページを取得して og:image / twitter:image を抽出する
 */
export async function fetchOgImage(pageUrl: string): Promise<string | null> {
  try {
    const res = await fetch(pageUrl, {
      signal: AbortSignal.timeout(12_000),
      headers: { "User-Agent": BOT_UA },
    });
    if (!res.ok) return null;
    const html = (await res.text()).slice(0, 300_000);
    const patterns = [
      /<meta[^>]+property=["']og:image(?::url)?["'][^>]+content=["']([^"']+)["']/i,
      /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image(?::url)?["']/i,
      /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i,
      /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image["']/i,
    ];
    for (const re of patterns) {
      const m = html.match(re);
      if (m?.[1]?.startsWith("http")) return m[1].replace(/&amp;/g, "&");
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * サムネイルを確保する: フィード内画像→元記事のog:imageの順に
 * ダウンロード検証して保存する。検証に成功した画像が無ければ null
 * (=サムネイルをDL検証できない記事は取り込まない)
 */
async function resolveHeroMedia(
  candidate: string | null,
  item: FeedItem,
  title: string,
  uploadedBy: string
) {
  if (candidate) {
    const stored = await storeRemoteImage(candidate, title, uploadedBy);
    if (stored) return stored;
  }
  if (item.link) {
    const ogImage = await fetchOgImage(item.link);
    if (ogImage && ogImage !== candidate) {
      const stored = await storeRemoteImage(ogImage, title, uploadedBy);
      if (stored) return stored;
    }
  }
  return null;
}

/** 1フィードを取り込む。重複(guid/URL/タイトル)は先着優先でスキップ */
export async function importFeed(
  feed: RssFeed,
  opts: { maxItems?: number } = {}
): Promise<ImportResult> {
  const result: ImportResult = { imported: 0, skipped: 0, errors: 0, articleIds: [] };
  const importUser = await getImportUser();

  let parsed;
  try {
    parsed = await parser.parseURL(feed.url);
  } catch (e) {
    await prisma.rssFeed.update({
      where: { id: feed.id },
      data: {
        lastFetchedAt: new Date(),
        lastError: e instanceof Error ? e.message.slice(0, 500) : "fetch failed",
      },
    });
    throw e;
  }

  const limit = opts.maxItems ?? feed.fetchLimit ?? MAX_ITEMS_PER_FETCH;
  const items = (parsed.items ?? []).slice(
    0,
    Math.min(Math.max(1, limit), MAX_ITEMS_PER_FETCH)
  );

  for (const item of items) {
    try {
      const guid = guidOf(item);
      const title = item.title?.trim();
      if (!guid || !title) {
        result.skipped++;
        continue;
      }

      // 重複チェック(sourceGuid で先に入ってきたものを優先)
      const dup = await prisma.article.findFirst({
        where: {
          OR: [
            { sourceGuid: guid },
            ...(item.link ? [{ sources: { some: { url: item.link } } }] : []),
            { translations: { some: { locale: "ja", title } } },
          ],
        },
        select: { id: true },
      });
      if (dup) {
        result.skipped++;
        continue;
      }

      const rawHtml =
        item["content:encoded"] || item.content || item.contentSnippet || "";
      const publishedAt = item.isoDate
        ? new Date(item.isoDate)
        : item.pubDate
          ? new Date(item.pubDate)
          : new Date();

      // 画像を自社ストレージへ保存(アイキャッチ+本文内画像)。
      // サムネイルを確保できない記事は取り込み対象外とする
      const heroCandidate = resolveHeroCandidate(item, rawHtml);
      const hero = await resolveHeroMedia(heroCandidate, item, title, importUser.id);
      if (!hero) {
        result.skipped++;
        continue;
      }

      let html = rawHtml;
      const inlineSrcs = extractImgSrcs(rawHtml).slice(0, MAX_INLINE_IMAGES);
      for (const src of inlineSrcs) {
        if (src === heroCandidate) {
          html = html.split(src).join(hero?.url ?? src);
          continue;
        }
        const stored = await storeRemoteImage(src, title, importUser.id);
        if (stored) html = html.split(src).join(stored.url);
      }

      // Tiptap JSON 化(対応ノード以外は落ちるため、実質サニタイズを兼ねる)
      let body: JSONContent;
      try {
        body = linkifyDoc(generateJSON(html || `<p>${title}</p>`, bodyExtensions));
      } catch {
        body = {
          type: "doc",
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: firstParagraphText(rawHtml, title) }],
            },
          ],
        };
      }
      if (!extractText(body).trim()) {
        body = {
          type: "doc",
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: firstParagraphText(rawHtml, title) }],
            },
          ],
        };
      }

      // スラッグに取り込み元を推測させる情報(rss等)を含めない。
      // 生成段階で英語ベースのスラッグへ差し替えられる(公開後は変更不可)
      const slug = `${dateStamp(publishedAt)}-${hash8(guid)}`;

      const article = await prisma.article.create({
        data: {
          slug,
          status: "draft",
          kind: "ai_generated",
          masterLocale: "ja",
          categoryId: feed.categoryId,
          authorId: importUser.id,
          heroImageId: hero?.id ?? null,
          sourceFeedId: feed.id,
          sourceGuid: guid,
          translations: {
            create: {
              locale: "ja",
              title,
              lead: firstParagraphText(item.contentSnippet ?? rawHtml, title),
              body: body as object,
              status: "pending",
            },
          },
          sources: {
            create: {
              name: feed.name,
              url: item.link ?? feed.url,
              publishedAt,
              isPrimary: true,
            },
          },
        },
      });

      result.imported++;
      result.articleIds.push(article.id);
    } catch (e) {
      console.error(`[rss-import] item failed (${feed.name}):`, e);
      result.errors++;
    }
  }

  await prisma.rssFeed.update({
    where: { id: feed.id },
    data: {
      lastFetchedAt: new Date(),
      lastError: result.errors > 0 ? `${result.errors} item(s) failed` : null,
      lastImportedCount: result.imported,
    },
  });

  return result;
}

/**
 * サムネイルが無いRSS取り込み記事に元記事のog:imageを補完する
 * (ingest cronが毎回、直近の欠落分から順に処理する)
 */
export async function backfillMissingThumbnails(limit = 10): Promise<number> {
  const articles = await prisma.article.findMany({
    where: {
      sourceFeedId: { not: null },
      heroImageId: null,
      sources: { some: {} },
      createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      sources: { where: { isPrimary: true } },
      translations: { where: { locale: "ja" } },
    },
  });
  if (articles.length === 0) return 0;

  const importUser = await getImportUser();
  let filled = 0;
  for (const article of articles) {
    try {
      const sourceUrl = article.sources[0]?.url;
      if (!sourceUrl) continue;
      const imageUrl = await fetchOgImage(sourceUrl);
      if (!imageUrl) continue;
      const stored = await storeRemoteImage(
        imageUrl,
        article.translations[0]?.title ?? article.slug,
        importUser.id
      );
      if (!stored) continue;
      await prisma.article.update({
        where: { id: article.id },
        data: { heroImageId: stored.id },
      });
      filled++;
    } catch (e) {
      console.error(`[rss-import] thumbnail backfill failed (${article.slug}):`, e);
    }
  }
  return filled;
}

/**
 * 自動取り込み対象フィードのうち「前回取得から設定頻度以上経過したもの」を
 * 取り込む(cron用。cron自体は10分おきに起動し、ここで頻度を判定する)
 */
export async function importAllFeeds(): Promise<Record<string, ImportResult>> {
  const feeds = await prisma.rssFeed.findMany({ where: { isEnabled: true } });
  const now = Date.now();
  const results: Record<string, ImportResult> = {};
  for (const feed of feeds) {
    const due =
      !feed.lastFetchedAt ||
      now - feed.lastFetchedAt.getTime() >=
        feed.fetchIntervalMinutes * 60 * 1000 - 30 * 1000; // 30秒の誤差余裕
    if (!due) continue;
    try {
      results[feed.name] = await importFeed(feed);
    } catch {
      results[feed.name] = { imported: 0, skipped: 0, errors: 1, articleIds: [] };
    }
  }
  return results;
}
