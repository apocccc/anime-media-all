import { getRequestConfig } from "next-intl/server";
import { cookies } from "next/headers";
import { routing, type SiteLocale } from "./routing";

/**
 * 公開サイト([locale] セグメントあり)は site.json(5言語)を、
 * 管理画面・事業者ポータルなど locale セグメントを持たないルートは
 * admin.json を ADMIN_LOCALE クッキー(ja / en)に従って返す。
 */
export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;

  if (requested !== undefined) {
    const locale = routing.locales.includes(requested as SiteLocale)
      ? (requested as SiteLocale)
      : routing.defaultLocale;
    return {
      locale,
      messages: (await import(`../../messages/${locale}/site.json`)).default,
    };
  }

  // 管理画面UI: ja(既定)/ en
  let adminLocale: "ja" | "en" = "ja";
  try {
    const value = (await cookies()).get("ADMIN_LOCALE")?.value;
    if (value === "en") adminLocale = value;
  } catch {
    // 静的レンダリング中はデフォルトのまま
  }

  return {
    locale: adminLocale,
    messages: (await import(`../../messages/${adminLocale}/admin.json`)).default,
  };
});
