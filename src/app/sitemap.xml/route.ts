import { getAllPublishedForSitemap } from "@/lib/data";
import { absoluteUrl } from "@/lib/site";
import { PUBLIC_DB_LOCALES, fromDbLocale } from "@/lib/locale";
import { xmlEscape } from "@/lib/seo";

export const revalidate = 3600;

const SITEMAP_CHUNK_SIZE = 40000;

/**
 * インデックスサイトマップ。/sitemaps/{locale}-pages.xml と
 * /sitemaps/{locale}-articles-{n}.xml(4万件/ファイルで分割)を参照する。
 */
export async function GET() {
  const sitemaps: string[] = [];
  for (const db of PUBLIC_DB_LOCALES) {
    const locale = fromDbLocale(db);
    const articles = await getAllPublishedForSitemap(db);
    const chunks = Math.max(1, Math.ceil(articles.length / SITEMAP_CHUNK_SIZE));
    sitemaps.push(absoluteUrl(`/sitemaps/${locale}-pages.xml`));
    for (let i = 1; i <= chunks; i++) {
      sitemaps.push(absoluteUrl(`/sitemaps/${locale}-articles-${i}.xml`));
    }
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemaps
  .map(
    (u) => `  <sitemap>
    <loc>${xmlEscape(u)}</loc>
  </sitemap>`
  )
  .join("\n")}
</sitemapindex>
`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=3600",
    },
  });
}
