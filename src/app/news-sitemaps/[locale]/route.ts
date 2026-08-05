import { notFound } from "next/navigation";
import { getNewsSitemapArticles } from "@/lib/data";
import { articlePath, localizedUrl, SITE_NAME } from "@/lib/site";
import { isPublicLocale, toDbLocale } from "@/lib/locale";
import { xmlEscape } from "@/lib/seo";

export const revalidate = 300;

/**
 * Googleニュース用サイトマップ(ロケール別 /news-sitemap-{locale}.xml。
 * next.config の rewrite でこのルートへ到達する)。
 * 直近48時間・当該ロケールで公開中の記事のみ。ファン投稿は含めない(§8.3)。
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ locale: string }> }
) {
  const { locale } = await params;
  if (!isPublicLocale(locale)) notFound();

  const articles = await getNewsSitemapArticles(toDbLocale(locale));

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
  xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">
${articles
  .flatMap((a) => {
    const title = a.translations[0]?.title;
    if (!title || !a.publishedAt) return [];
    return [
      `  <url>
    <loc>${xmlEscape(localizedUrl(locale, articlePath(a.category.slug, a.slug)))}</loc>
    <news:news>
      <news:publication>
        <news:name>${xmlEscape(SITE_NAME)}</news:name>
        <news:language>${xmlEscape(locale)}</news:language>
      </news:publication>
      <news:publication_date>${a.publishedAt.toISOString()}</news:publication_date>
      <news:title>${xmlEscape(title)}</news:title>
    </news:news>
  </url>`,
    ];
  })
  .join("\n")}
</urlset>
`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
    },
  });
}
