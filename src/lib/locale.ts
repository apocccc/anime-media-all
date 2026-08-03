import type { Locale as DbLocale } from "@prisma/client";
import { routing, type SiteLocale } from "@/i18n/routing";

/**
 * ロケールの単一参照点。
 * - URL/表示用コード ("zh-Hant") と Prisma enum ("zh_Hant") の相互変換
 * - hreflang / OGP / Intl 用のメタデータ
 * ja は内部編集用(翻訳の原文マスター)で、公開サイト・sitemap・feed に一切出さない。
 */

export const PUBLIC_LOCALES = routing.locales;
export const MASTER_LOCALE: DbLocale = "ja";

export function toDbLocale(locale: string): DbLocale {
  return locale.replace(/-/g, "_") as DbLocale;
}

export function fromDbLocale(locale: DbLocale): string {
  return locale.replace(/_/g, "-");
}

export function isPublicLocale(locale: string): locale is SiteLocale {
  return (PUBLIC_LOCALES as readonly string[]).includes(locale);
}

type LocaleMeta = {
  /** ネイティブ表記のラベル(言語スイッチャー用) */
  label: string;
  /** Intl.DateTimeFormat などに渡すロケール */
  intl: string;
  /** og:locale */
  og: string;
  /** RSS <language> */
  rss: string;
};

export const LOCALE_META: Record<SiteLocale, LocaleMeta> = {
  en: { label: "English", intl: "en-US", og: "en_US", rss: "en" },
  ko: { label: "한국어", intl: "ko-KR", og: "ko_KR", rss: "ko" },
  "zh-Hant": { label: "繁體中文", intl: "zh-TW", og: "zh_TW", rss: "zh-tw" },
  th: { label: "ไทย", intl: "th-TH", og: "th_TH", rss: "th" },
  "zh-Hans": { label: "简体中文", intl: "zh-CN", og: "zh_CN", rss: "zh-cn" },
};

export function localeMeta(locale: string): LocaleMeta {
  return LOCALE_META[(isPublicLocale(locale) ? locale : "en") as SiteLocale];
}

/** 全DBロケール(ja 含む)。翻訳パイプラインの対象列挙用 */
export const ALL_DB_LOCALES: DbLocale[] = [
  "ja",
  "en",
  "ko",
  "zh_Hant",
  "th",
  "zh_Hans",
];

/** 公開対象のDBロケール(ja を除く) */
export const PUBLIC_DB_LOCALES: DbLocale[] = PUBLIC_LOCALES.map(toDbLocale);
