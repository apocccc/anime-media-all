import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { NextIntlClientProvider } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { routing, type SiteLocale } from "@/i18n/routing";
import {
  displayFontVariables,
  fontForLocale,
  lineHeightClassForLocale,
} from "@/lib/fonts";
import { localeMeta, PUBLIC_LOCALES } from "@/lib/locale";
import { getVisibleCategories } from "@/lib/data";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";
import { GoogleAnalytics } from "@/components/site/GoogleAnalytics";
import { JsonLd } from "@/components/JsonLd";
import { organizationJsonLd, webSiteJsonLd } from "@/lib/seo";
import { absoluteUrl, SITE_URL } from "@/lib/site";
import "../../globals.css";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "site" });
  const meta = localeMeta(locale);
  return {
    metadataBase: new URL(SITE_URL),
    title: {
      default: t("name"),
      template: `%s | ${t("name")}`,
    },
    description: t("description"),
    openGraph: {
      siteName: t("name"),
      type: "website",
      locale: meta.og,
      alternateLocale: PUBLIC_LOCALES.filter((l) => l !== locale).map(
        (l) => localeMeta(l).og
      ),
    },
    twitter: {
      card: "summary_large_image",
    },
    alternates: {
      types: {
        "application/rss+xml": [
          { url: absoluteUrl(`/rss/${locale}.xml`), title: t("name") },
        ],
      },
    },
  };
}

export default async function SiteLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!routing.locales.includes(locale as SiteLocale)) {
    notFound();
  }
  setRequestLocale(locale);

  const categories = await getVisibleCategories();
  const font = fontForLocale(locale);

  return (
    <html lang={locale}>
      <body
        className={`${font.variable} ${displayFontVariables()} font-sans bg-bg text-ink min-h-screen flex flex-col ${lineHeightClassForLocale(locale)}`}
      >
        <JsonLd data={[organizationJsonLd(), webSiteJsonLd(locale)]} />
        {/* 公開サイトのみ計測(管理画面は別レイアウトのため対象外) */}
        {process.env.NEXT_PUBLIC_GA_ID ? (
          <GoogleAnalytics id={process.env.NEXT_PUBLIC_GA_ID} />
        ) : null}
        <NextIntlClientProvider>
          <SiteHeader categories={categories} locale={locale} />
          <main className="flex-1">{children}</main>
          <SiteFooter locale={locale} />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
