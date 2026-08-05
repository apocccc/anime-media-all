import { TOKYO_TZ } from "@/lib/site";

/** 東京時間基準の yyyymmdd(記事URLの日付部分は Asia/Tokyo の公開日) */
export function dateStamp(date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TOKYO_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
  return parts.replace(/-/g, "");
}

/**
 * 英語ベースの短いスラッグへ正規化(小文字・ハイフン区切り)。
 * スラッグはロケール非依存(全言語で同一)。非ASCII文字は除去する。
 */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "");
}

/** `{yyyymmdd}-{英語ベースの短いスラッグ}` 形式の記事スラッグを生成 */
export function articleSlug(base: string, date = new Date()): string {
  const s = slugify(base);
  return `${dateStamp(date)}-${s || "article"}`;
}

/** スラッグ形式のバリデーション */
export function isValidArticleSlug(slug: string): boolean {
  return /^\d{8}-[a-z0-9][a-z0-9-]*$/.test(slug);
}

/** 作品スラッグ(ローマ字・ヘボン式・マクロン無し)のバリデーション */
export function isValidSeriesSlug(slug: string): boolean {
  return /^[a-z0-9][a-z0-9-]*$/.test(slug);
}
