import { notFound } from "next/navigation";
import { getCategoryBySlug } from "@/lib/data";
import { categoryName } from "@/lib/categories";
import { isPublicLocale } from "@/lib/locale";
import {
  buildFeedItems,
  FEED_CACHE_HEADERS,
  feedTitle,
  renderAtom,
  renderJsonFeed,
  renderRss2,
} from "@/lib/feeds";

export const revalidate = 300;

/**
 * /rss/{locale}/{category}.xml — ロケール×カテゴリー別RSS
 * (press-release 含む。§7.3 の配信フィードもここ)
 * .atom / .json 拡張子で Atom / JSON Feed も提供する。
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ feed: string; category: string }> }
) {
  const { feed: locale, category: file } = await params;
  if (!isPublicLocale(locale)) notFound();
  const m = file.match(/^(.+)\.(xml|atom|json)$/);
  if (!m) notFound();
  const [, slug, format] = m;

  const category = await getCategoryBySlug(slug);
  if (!category && slug !== "latest") notFound();

  const items = await buildFeedItems(locale, slug === "latest" ? undefined : slug, 50);
  const opts = {
    title: feedTitle(category ? categoryName(category, locale) : undefined),
    selfPath: `/rss/${locale}/${file}`,
    locale,
  };

  if (format === "atom") {
    return new Response(renderAtom(items, opts), {
      headers: {
        "Content-Type": "application/atom+xml; charset=utf-8",
        ...FEED_CACHE_HEADERS,
      },
    });
  }
  if (format === "json") {
    return new Response(renderJsonFeed(items, opts), {
      headers: {
        "Content-Type": "application/feed+json; charset=utf-8",
        ...FEED_CACHE_HEADERS,
      },
    });
  }
  return new Response(renderRss2(items, opts), {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      ...FEED_CACHE_HEADERS,
    },
  });
}
