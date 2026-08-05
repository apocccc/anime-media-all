import { notFound } from "next/navigation";
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
 * /rss/{locale}.xml — ロケール別RSS 2.0
 * /rss/{locale}.atom — Atom / /rss/{locale}.json — JSON Feed
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ feed: string }> }
) {
  const { feed } = await params;
  const m = feed.match(/^(.+)\.(xml|atom|json)$/);
  if (!m) notFound();
  const [, locale, format] = m;
  if (!isPublicLocale(locale)) notFound();

  const items = await buildFeedItems(locale, undefined, 50);
  const opts = { title: feedTitle(), selfPath: `/rss/${feed}`, locale };

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
