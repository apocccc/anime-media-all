import { absoluteUrl } from "@/lib/site";
import { PUBLIC_LOCALES } from "@/lib/locale";

/**
 * 主要AIクローラーを明示的に許可(引用される露出を優先する方針。§10)。
 * /admin /partner /my /preview /search は全クローラー禁止。
 */
const AI_CRAWLERS = [
  "GPTBot",
  "ClaudeBot",
  "Claude-Web",
  "PerplexityBot",
  "Google-Extended",
  "CCBot",
  "Applebot-Extended",
];

const DISALLOW = ["/admin", "/partner", "/my", "/api", "/preview", "/search"];

export function GET() {
  const disallowLines = [
    ...DISALLOW,
    ...PUBLIC_LOCALES.map((l) => `/${l}/search`),
  ]
    .map((p) => `Disallow: ${p}`)
    .join("\n");

  const aiBlocks = AI_CRAWLERS.map(
    (ua) => `User-agent: ${ua}
Allow: /
${disallowLines}
`
  ).join("\n");

  const sitemaps = [
    `Sitemap: ${absoluteUrl("/sitemap.xml")}`,
    ...PUBLIC_LOCALES.map(
      (l) => `Sitemap: ${absoluteUrl(`/news-sitemap-${l}.xml`)}`
    ),
  ].join("\n");

  const body = `User-agent: *
Allow: /
${disallowLines}

${aiBlocks}
${sitemaps}
`;

  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, s-maxage=86400",
    },
  });
}
