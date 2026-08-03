import { notFound } from "next/navigation";
import { getAllPublishedForSitemap, getVisibleCategories } from "@/lib/data";
import { getSeriesList } from "@/lib/data-community";
import { articlePath, localizedUrl } from "@/lib/site";
import { isPublicLocale, toDbLocale } from "@/lib/locale";
import { publishedLocalesOf, xmlEscape } from "@/lib/seo";

export const revalidate = 3600;

const CHUNK_SIZE = 40000;

type UrlEntry = {
  loc: string;
  lastmod?: Date;
  changefreq?: string;
  priority?: string;
  /** hreflang: ロケールコード→URL(§10。xhtml:link で出力) */
  alternates?: Record<string, string>;
};

function urlset(urls: UrlEntry[]): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
  xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urls
  .map(
    (u) => `  <url>
    <loc>${xmlEscape(u.loc)}</loc>
${u.lastmod ? `    <lastmod>${u.lastmod.toISOString()}</lastmod>` : ""}
${u.changefreq ? `    <changefreq>${u.changefreq}</changefreq>` : ""}
${u.priority ? `    <priority>${u.priority}</priority>` : ""}
${
  u.alternates
    ? Object.entries(u.alternates)
        .map(
          ([hreflang, href]) =>
            `    <xhtml:link rel="alternate" hreflang="${xmlEscape(hreflang)}" href="${xmlEscape(href)}" />`
        )
        .join("\n")
    : ""
}
  </url>`
  )
  .join("\n")}
</urlset>
`;
}

/** 静的パスの hreflang(全ロケールに存在するページ) */
function staticAlternatesMap(path: string): Record<string, string> {
  const alternates: Record<string, string> = {};
  for (const l of ["en", "ko", "zh-Hant", "th", "zh-Hans"]) {
    alternates[l] = localizedUrl(l, path);
  }
  alternates["x-default"] = localizedUrl("en", path);
  return alternates;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ name: string }> }
) {
  const { name } = await params;

  const pagesMatch = name.match(/^(.+)-pages\.xml$/);
  if (pagesMatch && isPublicLocale(pagesMatch[1])) {
    const locale = pagesMatch[1];
    const [categories, seriesList] = await Promise.all([
      getVisibleCategories(),
      getSeriesList(500),
    ]);
    const urls: UrlEntry[] = [
      {
        loc: localizedUrl(locale, "/"),
        changefreq: "hourly",
        priority: "1.0",
        alternates: staticAlternatesMap("/"),
      },
      ...categories.map((c) => ({
        loc: localizedUrl(locale, `/category/${c.slug}`),
        changefreq: "hourly",
        priority: "0.8",
        alternates: staticAlternatesMap(`/category/${c.slug}`),
      })),
      ...seriesList.map((s) => ({
        loc: localizedUrl(locale, `/anime/${s.slug}`),
        changefreq: "daily",
        priority: "0.7",
        alternates: staticAlternatesMap(`/anime/${s.slug}`),
      })),
      {
        loc: localizedUrl(locale, "/fans"),
        changefreq: "hourly",
        priority: "0.7",
        alternates: staticAlternatesMap("/fans"),
      },
      {
        loc: localizedUrl(locale, "/prize"),
        changefreq: "daily",
        priority: "0.5",
        alternates: staticAlternatesMap("/prize"),
      },
      ...["/about", "/contact", "/privacy"].map((p) => ({
        loc: localizedUrl(locale, p),
        changefreq: "monthly",
        priority: "0.3",
        alternates: staticAlternatesMap(p),
      })),
    ];
    return xmlResponse(urlset(urls));
  }

  const articlesMatch = name.match(/^(.+)-articles-(\d+)\.xml$/);
  if (articlesMatch && isPublicLocale(articlesMatch[1])) {
    const locale = articlesMatch[1];
    const chunk = parseInt(articlesMatch[2], 10);
    const articles = await getAllPublishedForSitemap(toDbLocale(locale));
    const start = (chunk - 1) * CHUNK_SIZE;
    if (chunk < 1 || (start > 0 && start >= articles.length)) notFound();
    const slice = articles.slice(start, start + CHUNK_SIZE);
    const urls: UrlEntry[] = slice.map((a) => {
      const path = articlePath(a.category.slug, a.slug);
      const locales = publishedLocalesOf(a);
      const alternates: Record<string, string> = {};
      for (const l of locales) alternates[l] = localizedUrl(l, path);
      alternates["x-default"] = localizedUrl(
        locales.includes("en") ? "en" : (locales[0] ?? "en"),
        path
      );
      return {
        loc: localizedUrl(locale, path),
        lastmod: a.updatedAt,
        priority: "0.7",
        alternates,
      };
    });
    return xmlResponse(urlset(urls));
  }

  notFound();
}

function xmlResponse(xml: string) {
  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=3600",
    },
  });
}
