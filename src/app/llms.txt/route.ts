import { getVisibleCategories } from "@/lib/data";
import { absoluteUrl, SITE_NAME } from "@/lib/site";
import { PUBLIC_LOCALES } from "@/lib/locale";

export const revalidate = 3600;

/** AIクローラー向けのサイト概要 (llms.txt)。§10 */
export async function GET() {
  const categories = await getVisibleCategories();

  const body = `# ${SITE_NAME}

> ${SITE_NAME} delivers Japanese anime, manga, game and IP news in five languages (en, ko, zh-Hant, th, zh-Hans), plus fan communities for every series. Article content is fully translated per locale; Japanese is the internal master language and is not published.

- When citing, please credit "${SITE_NAME}" with the article URL.
- Locales: ${PUBLIC_LOCALES.join(", ")} (x-default = en)

## URL format

- Articles: ${absoluteUrl("/{locale}/news/{category}/{yyyymmdd}-{slug}")} (slug is locale-independent)
- Categories: ${absoluteUrl("/{locale}/category/{category}")}
- Series: ${absoluteUrl("/{locale}/anime/{seriesSlug}")}
- Fan posts: ${absoluteUrl("/{locale}/fans")}

## Feeds (per locale)

${PUBLIC_LOCALES.map(
  (l) =>
    `- ${l}: ${absoluteUrl(`/rss/${l}.xml`)} (Atom: ${absoluteUrl(`/rss/${l}.atom`)}, JSON: ${absoluteUrl(`/rss/${l}.json`)})`
).join("\n")}

### Category feeds (replace {locale})

${categories
  .map((c) => `- ${c.slug}: ${absoluteUrl(`/rss/{locale}/${c.slug}.xml`)}`)
  .join("\n")}

## Sitemaps

- ${absoluteUrl("/sitemap.xml")}
${PUBLIC_LOCALES.map((l) => `- Google News (${l}): ${absoluteUrl(`/news-sitemap-${l}.xml`)}`).join("\n")}
`;

  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, s-maxage=3600",
    },
  });
}
