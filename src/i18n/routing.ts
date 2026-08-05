import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  // 公開5ロケール。ja は内部編集専用のため含めない(/admin でのみ閲覧)
  locales: ["en", "ko", "zh-Hant", "th", "zh-Hans"],
  defaultLocale: "en",
  // 本文が翻訳され各ロケールが対等な独立ページになるため全ロケールにプレフィックス。
  // `/` は Cookie → Accept-Language → en の順で判定して 307 リダイレクト
  localePrefix: "always",
  localeCookie: {
    name: "SITE_LOCALE",
  },
});

export type SiteLocale = (typeof routing.locales)[number];
