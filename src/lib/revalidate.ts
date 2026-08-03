import { revalidatePath } from "next/cache";
import { articlePath } from "@/lib/site";
import { PUBLIC_LOCALES } from "@/lib/locale";

/**
 * 記事の公開/更新時に関連ページを即時再検証する(全ロケール)。
 * Nextのリクエストコンテキスト外(スクリプト実行等)では no-op。
 */
export function revalidateArticle(categorySlug: string, articleSlug: string) {
  try {
    revalidateArticleInner(categorySlug, articleSlug);
  } catch {
    // ISR (revalidate) が期限内に反映するため無視してよい
  }
}

function revalidateArticleInner(categorySlug: string, articleSlug: string) {
  for (const locale of PUBLIC_LOCALES) {
    revalidatePath(`/${locale}${articlePath(categorySlug, articleSlug)}`);
    revalidatePath(`/${locale}/category/${categorySlug}`);
    revalidatePath(`/${locale}/category/latest`);
    revalidatePath(`/${locale}`);
    revalidatePath(`/rss/${locale}.xml`);
    revalidatePath(`/rss/${locale}/${categorySlug}.xml`);
    revalidatePath(`/news-sitemap-${locale}.xml`);
  }
  revalidatePath("/sitemap.xml");
}

export function revalidateSeries(seriesSlug: string) {
  try {
    for (const locale of PUBLIC_LOCALES) {
      revalidatePath(`/${locale}/anime/${seriesSlug}`);
      revalidatePath(`/${locale}/anime/${seriesSlug}/fans`);
      revalidatePath(`/${locale}/fans`);
    }
  } catch {
    // no-op
  }
}
