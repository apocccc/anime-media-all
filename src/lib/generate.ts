import { prisma } from "@/lib/prisma";
import type { JSONContent } from "@tiptap/core";
import { aiCompleteJson, aiConfigured, modelForRole } from "@/lib/ai/provider";
import { buildRewrittenBody, extractSource, fetchPageText } from "@/lib/rewrite";
import { extractAndRegisterTerms } from "@/lib/glossary";
import { queueArticleTranslations } from "@/lib/translate";
import { articleSlug } from "@/lib/slug";

/**
 * 日本語マスター記事の生成(§6.3)。
 * RSS取り込みで draft 保持中の記事(生ソース)から、
 * 「日本のアニメ業界に詳しいニュース編集者」ペルソナで日本語マスター原稿を生成する。
 * 生成物は必ず draft/review。編集者承認なしに翻訳・公開へ進めない設定が既定
 * (自動公開はフィード単位でオプトイン)。
 */

const PER_CATEGORY_LIMIT = 3;
const JST_OFFSET_MS = 9 * 60 * 60 * 1000;
const TIME_BUDGET_MS = 270_000;

/** ランダム時刻公開: 現在時刻の30〜90分後のランダムな時刻 */
export function computeReleaseTime(now: Date, random = Math.random()): Date {
  const offsetMin = 30 + Math.floor(random * 60);
  return new Date(now.getTime() + offsetMin * 60_000);
}

type GenerateOutput = {
  title: string;
  lead: string;
  paragraphs: string[];
  /** 英語ベースの短いスラッグ(URL用) */
  slugBase?: string;
  category?: string;
  /** 記事に登場する作品名(日本語) */
  seriesNames?: string[];
};

export type GenerateSummary = {
  generated: number;
  failed: number;
  truncated: boolean;
  skippedNoKey: boolean;
  details: string[];
};

export async function generateMasterArticles(
  now = new Date()
): Promise<GenerateSummary> {
  const summary: GenerateSummary = {
    generated: 0,
    failed: 0,
    truncated: false,
    skippedNoKey: false,
    details: [],
  };

  if (!aiConfigured()) {
    summary.skippedNoKey = true;
    summary.details.push("AI provider is not configured — job skipped");
    return summary;
  }

  const deadline = Date.now() + TIME_BUDGET_MS;
  const categories = await prisma.category.findMany({
    where: { isVisible: true, slug: { notIn: ["latest", "press-release", "fan"] } },
    orderBy: { order: "asc" },
    include: { translations: true },
  });
  const categoryChoices = categories.map((c) => ({
    slug: c.slug,
    name: c.translations.find((t) => t.locale === "ja")?.name ?? c.slug,
  }));

  for (const category of categories) {
    // 1ソース1記事保証: sourceGuid 付き draft のうち、まだマスター生成されて
    // いないもの(ja translation が pending のまま)を対象にする
    const drafts = await prisma.article.findMany({
      where: {
        categoryId: category.id,
        status: "draft",
        kind: "ai_generated",
        sourceFeedId: { not: null },
        heroImageId: { not: null },
        translations: { some: { locale: "ja", status: "pending" } },
      },
      orderBy: { createdAt: "desc" },
      take: PER_CATEGORY_LIMIT,
      include: {
        sourceFeed: true,
        sources: true,
        translations: { where: { locale: "ja" } },
      },
    });

    for (const article of drafts) {
      if (Date.now() > deadline) {
        summary.truncated = true;
        return summary;
      }
      const raw = article.translations[0];
      if (!raw) continue;
      try {
        const { text, images } = extractSource(raw.body as JSONContent);
        const primarySource = article.sources.find((s) => s.isPrimary) ?? article.sources[0];
        const pageText = primarySource?.url
          ? await fetchPageText(primarySource.url)
          : null;

        const system = [
          "あなたは日本のアニメ業界に詳しいニュース編集者です。",
          "任務: 提供された一次情報をもとに、日本語のマスター原稿(独自記事)を書く。この原稿は後段で5言語へ翻訳される。",
          "規則:",
          "1. 事実・数字・固有名詞・日付の捏造禁止。確認できない情報は書かない。放送日・話数・キャスト・スタッフは一次情報に無ければ書かない。",
          "2. 原文の逐語コピーをしない。構成・表現を独自に再構成する(全文転載禁止)。",
          "3. 分量: 日本語1,000〜2,000字(読了2〜4分)。小見出し(「## 」で始まる独立段落)を2〜4個。リード文は160字目安。",
          "4. 未放送話のネタバレは見出し・リードに出さない。",
          "5. 原文中の [IMAGE_n] マーカーは位置・順序を変えず必ず保持する(独立段落として)。",
          '6. 出力JSON: {"title": "見出し", "lead": "リード文", "paragraphs": ["段落", "## 小見出し", "[IMAGE_1]", ...], "slugBase": "english-short-slug", "seriesNames": ["作品名"], "category": "slug"}',
          `7. category は次から最適な1つを選ぶ: ${categoryChoices.map((c) => `${c.slug}(${c.name})`).join("、")}`,
        ].join("\n");

        const user = [
          `カテゴリー: ${categoryChoices.find((c) => c.slug === category.slug)?.name ?? category.slug}`,
          `元タイトル: ${raw.title}`,
          `元リード: ${raw.lead}`,
          "",
          `原文(フィード):\n${text}`,
          ...(pageText ? ["", `補足資料(元記事ページ全文):\n${pageText}`] : []),
        ].join("\n");

        const output = await aiCompleteJson<GenerateOutput>({
          role: "write",
          system,
          user,
        });
        if (!output.title || !Array.isArray(output.paragraphs) || output.paragraphs.length === 0) {
          throw new Error("AI response is missing title/paragraphs");
        }

        const body = buildRewrittenBody(output.paragraphs, images);
        const target =
          categories.find((c) => c.slug === output.category) ?? category;
        const autoPublish = article.sourceFeed?.autoPublish ?? false;
        const publishAt = computeReleaseTime(now);

        // 英語ベーススラッグへ差し替え(未公開の間のみ変更可)
        let slug = article.slug;
        if (output.slugBase && article.status !== "published") {
          const candidate = articleSlug(output.slugBase, now);
          const conflict = await prisma.article.findFirst({
            where: { slug: candidate, id: { not: article.id } },
            select: { id: true },
          });
          if (!conflict) slug = candidate;
        }

        await prisma.$transaction([
          prisma.article.update({
            where: { id: article.id },
            data: {
              slug,
              categoryId: target.id,
              status: autoPublish ? "scheduled" : "review",
              publishAt: autoPublish ? publishAt : null,
            },
          }),
          prisma.articleTranslation.update({
            where: { articleId_locale: { articleId: article.id, locale: "ja" } },
            data: {
              title: output.title,
              lead: (output.lead ?? "").slice(0, 300),
              body: body as object,
              status: "approved",
              translatedBy: "ai",
              model: modelForRole("write"),
            },
          }),
        ]);

        // 作品(Series)紐付け: 既存作品のタイトル一致で紐付け
        for (const name of output.seriesNames ?? []) {
          const series = await prisma.series.findFirst({
            where: {
              OR: [
                { titleJa: name },
                { translations: { some: { title: name } } },
              ],
            },
            select: { id: true },
          });
          if (series) {
            await prisma.articleSeries.upsert({
              where: {
                articleId_seriesId: {
                  articleId: article.id,
                  seriesId: series.id,
                },
              },
              create: { articleId: article.id, seriesId: series.id, isPrimary: false },
              update: {},
            });
          }
        }

        // 固有名詞の抽出・pending 登録 → 翻訳キュー投入
        const masterText = `${output.title}\n${output.lead}\n${output.paragraphs.join("\n")}`;
        await extractAndRegisterTerms(article.id, masterText);
        await queueArticleTranslations(article.id);

        summary.generated++;
        summary.details.push(
          `[${target.slug}] ${output.title} → ${autoPublish ? publishAt.toISOString() : "review"}`
        );
      } catch (e) {
        summary.failed++;
        summary.details.push(
          `[${category.slug}] FAILED ${article.slug}: ${e instanceof Error ? e.message : e}`
        );
      }
    }
  }

  return summary;
}

/** JSTの現在日を返す(表示・ログ用) */
export function jstNow(now = new Date()): Date {
  return new Date(now.getTime() + JST_OFFSET_MS);
}
