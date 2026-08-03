import {
  absoluteUrl,
  articlePath,
  localizedUrl,
  SITE_NAME,
  SITE_URL,
} from "@/lib/site";
import { categoryName } from "@/lib/categories";
import {
  fromDbLocale,
  isPublicLocale,
  PUBLIC_DB_LOCALES,
  toDbLocale,
} from "@/lib/locale";
import type { ArticleFull } from "@/lib/data";
import { PUBLIC_TRANSLATION_STATUSES } from "@/lib/data";
import { seriesTitle, type SeriesWithTranslations } from "@/lib/data-community";
import type { Locale as DbLocale } from "@prisma/client";

/**
 * JSON-LD ビルダー群と hreflang ヘルパー。
 * 記事 = NewsArticle(プレスリリースのみ Article)。canonical は各ロケールが自分自身を指す。
 */

export function organizationJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "NewsMediaOrganization",
    "@id": `${SITE_URL}/#organization`,
    name: SITE_NAME,
    url: SITE_URL,
    logo: {
      "@type": "ImageObject",
      url: absoluteUrl("/logo.png"),
      width: 512,
      height: 512,
    },
  };
}

export function webSiteJsonLd(locale: string) {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${SITE_URL}/#website`,
    name: SITE_NAME,
    url: SITE_URL,
    inLanguage: locale,
    publisher: { "@id": `${SITE_URL}/#organization` },
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${SITE_URL}/${locale}/search?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  };
}

/** 記事が公開されているロケール(URLロケール表記)一覧 */
export function publishedLocalesOf(article: {
  translations: { locale: DbLocale; status: string }[];
}): string[] {
  return article.translations
    .filter(
      (t) =>
        (PUBLIC_TRANSLATION_STATUSES as readonly string[]).includes(t.status) &&
        (PUBLIC_DB_LOCALES as DbLocale[]).includes(t.locale)
    )
    .map((t) => fromDbLocale(t.locale));
}

/**
 * hreflang alternates。翻訳が存在しない(excluded 等)ロケールは含めない。
 * x-default は en(en が無い場合は先頭の公開ロケール)。
 */
export function articleAlternates(
  article: { translations: { locale: DbLocale; status: string }[] },
  path: string
): { languages: Record<string, string> } | null {
  const locales = publishedLocalesOf(article);
  if (locales.length === 0) return null;
  const languages: Record<string, string> = {};
  for (const l of locales) {
    languages[l] = localizedUrl(l, path);
  }
  languages["x-default"] = localizedUrl(
    locales.includes("en") ? "en" : locales[0],
    path
  );
  return { languages };
}

/** 全ロケールで存在するページ(トップ・カテゴリー等)の hreflang */
export function staticAlternates(path: string): {
  languages: Record<string, string>;
} {
  const languages: Record<string, string> = {};
  for (const db of PUBLIC_DB_LOCALES) {
    const l = fromDbLocale(db);
    languages[l] = localizedUrl(l, path);
  }
  languages["x-default"] = localizedUrl("en", path);
  return { languages };
}

export function articleJsonLd(
  article: ArticleFull,
  locale: string,
  t: { title: string; lead: string }
) {
  const isPressRelease = article.kind === "press_release";
  const url = localizedUrl(locale, articlePath(article.category.slug, article.slug));
  return {
    "@context": "https://schema.org",
    "@type": isPressRelease ? "Article" : "NewsArticle",
    headline: t.title,
    description: t.lead,
    datePublished: (article.publishedAt ?? article.createdAt).toISOString(),
    dateModified: article.updatedAt.toISOString(),
    author: {
      "@type": "Person",
      name: article.author.name,
      url: localizedUrl(locale, `/author/${article.author.slug}`),
    },
    publisher: { "@id": `${SITE_URL}/#organization` },
    ...(article.heroImage
      ? {
          image: {
            "@type": "ImageObject",
            url: article.heroImage.url,
            width: article.heroImage.width,
            height: article.heroImage.height,
          },
        }
      : {}),
    articleSection: isPublicLocale(locale)
      ? categoryName(article.category, locale)
      : article.category.slug,
    inLanguage: locale,
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    ...(isPressRelease && article.organization
      ? {
          sourceOrganization: {
            "@type": "Organization",
            name: article.organization.name,
          },
        }
      : {}),
  };
}

/** 作品ページ: TVSeries / Movie */
export function seriesJsonLd(series: SeriesWithTranslations, locale: string) {
  const db = toDbLocale(locale);
  return {
    "@context": "https://schema.org",
    "@type": series.kind === "movie" ? "Movie" : "TVSeries",
    name: seriesTitle(series, db),
    alternateName: series.titleJa,
    url: localizedUrl(locale, `/anime/${series.slug}`),
    inLanguage: locale,
    ...(series.heroImage ? { image: series.heroImage.url } : {}),
  };
}

/** 投稿者ページ: Person */
export function creatorJsonLd(
  creator: { name: string; handle: string | null; avatarUrl: string | null },
  locale: string
) {
  return {
    "@context": "https://schema.org",
    "@type": "Person",
    name: creator.name,
    url: localizedUrl(locale, `/creators/${creator.handle}`),
    ...(creator.avatarUrl ? { image: creator.avatarUrl } : {}),
  };
}

export type Crumb = { name: string; path: string };

export function breadcrumbJsonLd(crumbs: Crumb[], locale?: string) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map((c, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: c.name,
      item: locale ? localizedUrl(locale, c.path) : absoluteUrl(c.path),
    })),
  };
}

/** XML 出力用の最小限のエスケープ */
export function xmlEscape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
