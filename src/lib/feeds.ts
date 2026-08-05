import { getFeedArticles, pickTranslation, type ArticleListItem } from "@/lib/data";
import { renderArticleHtml } from "@/lib/tiptap";
import { xmlEscape } from "@/lib/seo";
import { categoryName } from "@/lib/categories";
import { localeMeta, toDbLocale } from "@/lib/locale";
import { absoluteUrl, articlePath, localizedUrl, SITE_NAME } from "@/lib/site";

export type FeedItem = {
  title: string;
  url: string;
  lead: string;
  html: string;
  author: string;
  category: string;
  publishedAt: Date;
  updatedAt: Date;
  image?: { url: string; mimeType: string };
};

/** フィードはロケール別(/rss/{locale}.xml, /rss/{locale}/{category}.xml) */
export async function buildFeedItems(
  locale: string,
  categorySlug?: string,
  limit = 50
): Promise<FeedItem[]> {
  const db = toDbLocale(locale);
  const articles = await getFeedArticles(db, categorySlug, limit);
  return articles.flatMap((a: ArticleListItem) => {
    const t = pickTranslation(a);
    if (!t) return [];
    return [
      {
        title: t.title,
        url: localizedUrl(locale, articlePath(a.category.slug, a.slug)),
        lead: t.lead,
        html: renderArticleHtml(t.body),
        author: a.author.name,
        category: categoryName(a.category, locale),
        publishedAt: a.publishedAt ?? a.createdAt,
        updatedAt: a.updatedAt,
        image: a.heroImage
          ? { url: a.heroImage.url, mimeType: a.heroImage.mimeType }
          : undefined,
      },
    ];
  });
}

export function feedTitle(categoryName?: string): string {
  return categoryName ? `${SITE_NAME} — ${categoryName}` : SITE_NAME;
}

const FEED_DESCRIPTION =
  "Japanese anime, manga, game and IP news in your language.";

export function renderRss2(
  items: FeedItem[],
  opts: { title: string; selfPath: string; locale: string }
): string {
  const now = new Date().toUTCString();
  const entries = items
    .map(
      (i) => `    <item>
      <title>${xmlEscape(i.title)}</title>
      <link>${xmlEscape(i.url)}</link>
      <guid isPermaLink="true">${xmlEscape(i.url)}</guid>
      <pubDate>${i.publishedAt.toUTCString()}</pubDate>
      <description>${xmlEscape(i.lead)}</description>
      <dc:creator>${xmlEscape(i.author)}</dc:creator>
      <category>${xmlEscape(i.category)}</category>
      <content:encoded><![CDATA[${i.html}]]></content:encoded>
${i.image ? `      <media:content url="${xmlEscape(i.image.url)}" type="${xmlEscape(i.image.mimeType)}" medium="image" />` : ""}
    </item>`
    )
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"
  xmlns:content="http://purl.org/rss/1.0/modules/content/"
  xmlns:dc="http://purl.org/dc/elements/1.1/"
  xmlns:media="http://search.yahoo.com/mrss/"
  xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${xmlEscape(opts.title)}</title>
    <link>${xmlEscape(localizedUrl(opts.locale, "/"))}</link>
    <description>${xmlEscape(FEED_DESCRIPTION)}</description>
    <language>${localeMeta(opts.locale).rss}</language>
    <lastBuildDate>${now}</lastBuildDate>
    <atom:link href="${xmlEscape(absoluteUrl(opts.selfPath))}" rel="self" type="application/rss+xml" />
${entries}
  </channel>
</rss>
`;
}

export function renderAtom(
  items: FeedItem[],
  opts: { title: string; selfPath: string; locale: string }
): string {
  const updated = (items[0]?.updatedAt ?? new Date()).toISOString();
  const entries = items
    .map(
      (i) => `  <entry>
    <title>${xmlEscape(i.title)}</title>
    <link href="${xmlEscape(i.url)}" />
    <id>${xmlEscape(i.url)}</id>
    <published>${i.publishedAt.toISOString()}</published>
    <updated>${i.updatedAt.toISOString()}</updated>
    <summary>${xmlEscape(i.lead)}</summary>
    <author><name>${xmlEscape(i.author)}</name></author>
    <category term="${xmlEscape(i.category)}" />
    <content type="html">${xmlEscape(i.html)}</content>
  </entry>`
    )
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom" xml:lang="${xmlEscape(opts.locale)}">
  <title>${xmlEscape(opts.title)}</title>
  <link href="${xmlEscape(localizedUrl(opts.locale, "/"))}" />
  <link href="${xmlEscape(absoluteUrl(opts.selfPath))}" rel="self" type="application/atom+xml" />
  <id>${xmlEscape(localizedUrl(opts.locale, "/"))}</id>
  <updated>${updated}</updated>
  <subtitle>${xmlEscape(FEED_DESCRIPTION)}</subtitle>
${entries}
</feed>
`;
}

export function renderJsonFeed(
  items: FeedItem[],
  opts: { title: string; selfPath: string; locale: string }
): string {
  return JSON.stringify(
    {
      version: "https://jsonfeed.org/version/1.1",
      title: opts.title,
      home_page_url: localizedUrl(opts.locale, "/"),
      feed_url: absoluteUrl(opts.selfPath),
      description: FEED_DESCRIPTION,
      language: opts.locale,
      items: items.map((i) => ({
        id: i.url,
        url: i.url,
        title: i.title,
        summary: i.lead,
        content_html: i.html,
        date_published: i.publishedAt.toISOString(),
        date_modified: i.updatedAt.toISOString(),
        authors: [{ name: i.author }],
        tags: [i.category],
        ...(i.image ? { image: i.image.url } : {}),
      })),
    },
    null,
    2
  );
}

export const FEED_CACHE_HEADERS = {
  "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
};
