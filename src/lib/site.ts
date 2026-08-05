/**
 * サイト定義の唯一の参照点。ドメイン・サイト名はハードコードせず
 * 環境変数({{SITE_NAME}}/{{DOMAIN}} は別途指示があるまで仮値)を参照する。
 */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"
).replace(/\/$/, "");

export const SITE_NAME = process.env.NEXT_PUBLIC_SITE_NAME ?? "Anime Relay";

export const TOKYO_TZ = "Asia/Tokyo";

/** サイトのホスト名(例: animerelay.com)。SITE_URL から導出しハードコードしない */
export const SITE_HOST = (() => {
  try {
    return new URL(SITE_URL).host.replace(/^www\./, "");
  } catch {
    return "localhost:3000";
  }
})();

/** 問い合わせ先メール。未設定時は contact@<domain> */
export const CONTACT_EMAIL =
  process.env.NEXT_PUBLIC_CONTACT_EMAIL ??
  `contact@${SITE_HOST.replace(/:\d+$/, "")}`;

/** 収集ボットのUA(§6.1: robots.txt 尊重・UA明示)。SITE_NAME/SITE_URL から生成 */
export const BOT_UA = `${SITE_NAME.replace(/\s+/g, "")}Bot/1.0 (+${SITE_URL}/about)`;

/** 絶対URLを生成する。path は必ず / 始まり */
export function absoluteUrl(path: string): string {
  return `${SITE_URL}${path}`;
}

/** ロケールプレフィックスなしの記事パス(スラッグはロケール非依存) */
export function articlePath(categorySlug: string, articleSlug: string): string {
  return `/news/${categorySlug}/${articleSlug}`;
}

/** localePrefix: "always" のため、絶対URLは常にロケール付き */
export function localizedPath(locale: string, path: string): string {
  return `/${locale}${path === "/" ? "" : path}`;
}

export function localizedUrl(locale: string, path: string): string {
  return absoluteUrl(localizedPath(locale, path));
}

/** 運用基準は Asia/Tokyo。表示は各ロケールの日付書式に従う */
export function formatTokyoShort(date: Date, intlLocale: string): string {
  return new Intl.DateTimeFormat(intlLocale, {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: TOKYO_TZ,
  }).format(date);
}

export function formatTokyo(
  date: Date,
  intlLocale: string,
  opts: Intl.DateTimeFormatOptions = {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }
): string {
  return new Intl.DateTimeFormat(intlLocale, {
    ...opts,
    timeZone: TOKYO_TZ,
  }).format(date);
}
