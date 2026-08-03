import type { Metadata } from "next";
import Image from "next/image";
import { notFound, permanentRedirect, redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import {
  findRedirect,
  getArticleBySlug,
  getArticlePublishedLocales,
  getLatestArticles,
  getPopularArticles,
  getRelatedArticles,
  incrementViewCount,
} from "@/lib/data";
import { renderArticleHtml } from "@/lib/tiptap";
import { articleAlternates, articleJsonLd } from "@/lib/seo";
import { JsonLd } from "@/components/JsonLd";
import { Breadcrumbs } from "@/components/site/Breadcrumbs";
import { ArticleCard } from "@/components/site/ArticleCard";
import { HeadlineList } from "@/components/site/HeadlineList";
import { RankingList } from "@/components/site/RankingList";
import { SectionHeading } from "@/components/site/SectionHeading";
import { ShareButtons } from "@/components/site/ShareButtons";
import { categoryName } from "@/lib/categories";
import { categoryAccent } from "@/lib/category-style";
import { fromDbLocale, localeMeta, toDbLocale } from "@/lib/locale";
import { seriesTitle } from "@/lib/data-community";
import { articlePath, formatTokyo, localizedUrl } from "@/lib/site";

export const revalidate = 300;

export function generateStaticParams() {
  // ビルド時は生成せず、初回アクセス時に ISR で生成する
  return [];
}

type Params = { locale: string; category: string; slug: string };

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { locale, category, slug } = await params;
  const db = toDbLocale(locale);
  const article = await getArticleBySlug(db, category, slug);
  if (!article) return {};
  const tr = article.translations.find(
    (t) => t.locale === db && ["approved", "machine"].includes(t.status)
  );
  if (!tr) return {};

  const path = articlePath(category, slug);
  const alternates = articleAlternates(article, path);
  return {
    title: tr.title,
    description: tr.lead,
    alternates: {
      // 本文が翻訳されているため canonical は各ロケールが自分自身を指す
      canonical: localizedUrl(locale, path),
      ...(alternates ? { languages: alternates.languages } : {}),
    },
    openGraph: {
      type: "article",
      title: tr.title,
      description: tr.lead,
      url: localizedUrl(locale, path),
      publishedTime: (article.publishedAt ?? article.createdAt).toISOString(),
      modifiedTime: article.updatedAt.toISOString(),
      section: categoryName(article.category, locale),
      locale: localeMeta(locale).og,
      authors: [localizedUrl(locale, `/author/${article.author.slug}`)],
      ...(article.heroImage
        ? {
            images: [
              {
                url: article.heroImage.url,
                width: article.heroImage.width,
                height: article.heroImage.height,
                alt: article.heroImage.alt,
              },
            ],
          }
        : {}),
    },
  };
}

export default async function ArticlePage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { locale, category, slug } = await params;
  setRequestLocale(locale);
  const db = toDbLocale(locale);

  const article = await getArticleBySlug(db, category, slug);
  if (!article) {
    // スラッグ変更・カテゴリー移動時の恒久リダイレクト
    const r = await findRedirect(articlePath(category, slug));
    if (r) permanentRedirect(`/${locale}${r.toPath}`);
    // excluded ロケールの直リンクは他ロケール(en優先)へ 302
    const available = await getArticlePublishedLocales(category, slug);
    if (available.length > 0) {
      const target = available.includes("en") ? "en" : available[0];
      redirect(`/${fromDbLocale(target)}${articlePath(category, slug)}`);
    }
    notFound();
  }

  const tr = article.translations.find(
    (t) => t.locale === db && ["approved", "machine"].includes(t.status)
  );
  if (!tr) notFound();

  incrementViewCount(article.id);

  const t = await getTranslations();
  const [related, popular, latestSide] = await Promise.all([
    getRelatedArticles(db, article.id, article.categoryId, 4),
    getPopularArticles(db, 8),
    getLatestArticles(db, 8),
  ]);
  const bodyHtml = renderArticleHtml(tr.body);
  const isPressRelease = article.kind === "press_release";
  const isMachineTranslated = tr.status === "machine";
  const publishedAt = article.publishedAt ?? article.createdAt;
  const wasUpdated =
    article.updatedAt.getTime() - publishedAt.getTime() > 60 * 1000;
  const canonicalUrl = localizedUrl(locale, articlePath(category, slug));
  const intl = localeMeta(locale).intl;
  const primarySource =
    article.sources.find((s) => s.isPrimary) ?? article.sources[0] ?? null;
  const accent = categoryAccent(article.category.slug);
  const seriesAccent = categoryAccent("anime");

  return (
    <div className="mx-auto max-w-6xl px-4 py-4">
      <Breadcrumbs
        crumbs={[
          { name: t("nav.home"), path: "/" },
          {
            name: categoryName(article.category, locale),
            path: `/category/${article.category.slug}`,
          },
          { name: tr.title, path: articlePath(category, slug) },
        ]}
      />

      <div className="mt-3 grid gap-8 lg:grid-cols-[1fr_300px]">
        {/* メイン: 記事本文 */}
        <div className="min-w-0 max-w-3xl">
          <article>
            <JsonLd data={articleJsonLd(article, locale, tr)} />

            <header>
              <div className="flex flex-wrap items-center gap-2">
                {article.isBreaking ? (
                  <span className="inline-flex h-[18px] items-center rounded-[4px] bg-breaking px-[7px] font-heading text-[10px] font-extrabold uppercase text-white">
                    {t("labels.breaking")}
                  </span>
                ) : null}
                <Link
                  href={`/category/${article.category.slug}`}
                  className={`inline-flex h-[18px] items-center rounded-[4px] px-[7px] font-heading text-[10px] font-extrabold uppercase ${accent.chip} hover:bg-ink hover:text-white`}
                >
                  {categoryName(article.category, locale)}
                </Link>
                {isPressRelease ? (
                  <span
                    className={`inline-flex h-[18px] items-center rounded-[4px] px-[7px] font-heading text-[10px] font-extrabold uppercase ${categoryAccent("press-release").chip}`}
                  >
                    {t("labels.pressRelease")}
                  </span>
                ) : null}
              </div>

              {/* PR: 配信元企業をタイトル上に常時明示(§7.2) */}
              {isPressRelease && article.organization ? (
                <div className="mt-3 flex items-center gap-3 rounded-[8px] border-2 border-ink bg-bg-sub px-4 py-2.5">
                  <span className="shrink-0 font-heading text-[11px] font-extrabold uppercase text-gray">
                    {t("labels.prProvidedBy")}
                  </span>
                  <Link
                    href={`/press/${article.organization.slug}`}
                    className="font-heading text-lg font-extrabold text-ink hover:text-primary"
                  >
                    {article.organization.name}
                  </Link>
                </div>
              ) : null}

              <h1 className="mt-3 font-heading text-[26px] font-extrabold leading-snug sm:text-[30px]">
                {tr.title}
              </h1>

              {/* 日付・著者を本文冒頭で機械可読に明示(AI/検索の出典特定用) */}
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-y border-dashed border-dash py-2.5">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-gray">
                  <span>
                    {t("labels.byAuthor")}{" "}
                    <Link
                      href={`/author/${article.author.slug}`}
                      rel="author"
                      className="font-medium text-ink hover:text-primary"
                    >
                      {article.author.name}
                    </Link>
                  </span>
                  <span>
                    {t("labels.publishedAt")}{" "}
                    <time dateTime={publishedAt.toISOString()}>
                      {formatTokyo(publishedAt, intl)}
                    </time>
                  </span>
                  {wasUpdated ? (
                    <span>
                      {t("labels.updatedAt")}{" "}
                      <time dateTime={article.updatedAt.toISOString()}>
                        {formatTokyo(article.updatedAt, intl)}
                      </time>
                    </span>
                  ) : null}
                </div>
                <ShareButtons url={canonicalUrl} title={tr.title} />
              </div>

              {isPressRelease ? (
                <div className="mt-4 rounded-[8px] border-2 border-ink bg-bg-sub px-4 py-3 text-sm text-gray">
                  <p>{t("labels.pressReleaseNotice")}</p>
                  {article.organization ? (
                    <p className="mt-1 font-medium text-ink">
                      {t("labels.prSource")}:{article.organization.name}
                    </p>
                  ) : null}
                </div>
              ) : null}

              {isMachineTranslated ? (
                <p className="mt-3 rounded-[8px] border-2 border-dash bg-surface px-3 py-2 text-xs text-gray">
                  {t("labels.machineTranslated")}
                </p>
              ) : null}

              {tr.lead ? (
                <p className="mt-5 rounded-r-[8px] border-l-4 border-primary bg-primary-light px-4 py-3 text-[16px] font-medium leading-relaxed text-ink">
                  {tr.lead}
                </p>
              ) : null}

              {article.heroImage ? (
                <figure className="mt-5">
                  <div className="relative aspect-[16/9] overflow-hidden rounded-[13px] border-2 border-ink">
                    <Image
                      src={article.heroImage.url}
                      alt={article.heroImage.alt}
                      fill
                      priority
                      sizes="(min-width: 768px) 768px, 100vw"
                      className="object-cover"
                    />
                  </div>
                  {article.heroImage.alt || primarySource ? (
                    <figcaption className="mt-2 text-xs text-gray">
                      {article.heroImage.alt}
                      {/* 画像の出典は常に表示する(§6.1) */}
                      {primarySource
                        ? `${article.heroImage.alt ? " " : ""}(${t("labels.imageSource")}:${primarySource.name})`
                        : ""}
                    </figcaption>
                  ) : null}
                </figure>
              ) : null}
            </header>

            <div
              className="article-body mt-7"
              dangerouslySetInnerHTML={{ __html: bodyHtml }}
            />

            {/* 出典(複数可): 本文末に出典名+原文リンク(§6.1) */}
            {article.sources.length > 0 && !isPressRelease ? (
              <div className="mt-8 rounded-[8px] border-2 border-ink bg-bg-sub px-4 py-3 text-sm text-gray">
                <span className="font-heading text-[12px] font-extrabold uppercase text-ink">
                  {t("labels.sources")}:
                </span>
                <ul className="mt-1 space-y-0.5">
                  {article.sources.map((s) => (
                    <li key={s.id}>
                      <span className="font-medium text-ink">{s.name}</span>
                      {" · "}
                      <a
                        href={s.url}
                        target="_blank"
                        rel="noopener nofollow"
                        className="text-primary underline underline-offset-2 hover:text-primary-dark"
                      >
                        {t("labels.originalArticle")}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            <footer className="mt-8 border-t border-dashed border-dash pt-4">
              {/* 関連作品 */}
              {article.seriesLinks.length > 0 ? (
                <div className="mb-4">
                  <span className="font-heading text-[12px] font-extrabold uppercase text-gray">
                    {t("labels.relatedSeries")}:
                  </span>
                  <ul className="mt-1.5 flex flex-wrap gap-2">
                    {article.seriesLinks.map(({ series }) => (
                      <li key={series.id}>
                        <Link
                          href={`/anime/${series.slug}`}
                          className={`inline-flex h-[18px] items-center rounded-[4px] px-[7px] font-heading text-[10px] font-extrabold uppercase ${seriesAccent.chip} hover:bg-ink hover:text-white`}
                        >
                          {seriesTitle(series, db)}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              <div className="flex flex-wrap items-center justify-between gap-3">
                {article.tags.length > 0 ? (
                  <ul className="flex flex-wrap gap-2">
                    {article.tags.map(({ tag }) => (
                      <li key={tag.id}>
                        <Link
                          href={`/tag/${tag.slug}`}
                          className="inline-flex h-[18px] items-center rounded-[4px] border-2 border-ink bg-surface px-[7px] font-heading text-[10px] font-extrabold uppercase text-ink hover:bg-yellow"
                        >
                          #{tag.name}
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <span />
                )}
                <ShareButtons url={canonicalUrl} title={tr.title} />
              </div>
            </footer>
          </article>

          {related.length > 0 ? (
            <section className="mt-10" aria-label={t("labels.relatedArticles")}>
              <div className="border-t-2 border-ink pt-2.5">
                <SectionHeading>{t("labels.relatedArticles")}</SectionHeading>
              </div>
              <div className="mt-4 flex flex-col gap-5">
                {related.map((a) => (
                  <ArticleCard
                    key={a.id}
                    article={a}
                    locale={locale}
                    showCategory={false}
                  />
                ))}
              </div>
            </section>
          ) : null}
        </div>

        {/* サイドバー */}
        <aside className="flex flex-col gap-7 pt-[6px]">
          <section
            aria-label={t("labels.ranking")}
            className="relative rounded-[13px] border-2 border-ink bg-surface px-[12px] pb-2"
          >
            <div className="-ml-[18px] -mt-[14px]">
              <SectionHeading color="bg-primary text-white">
                {t("labels.ranking")}
              </SectionHeading>
            </div>
            <div className="mt-1">
              <RankingList articles={popular} />
            </div>
          </section>

          <section
            aria-label={t("labels.latestNews")}
            className="relative rounded-[13px] border-2 border-ink bg-surface px-[12px] pb-2"
          >
            <div className="-ml-[18px] -mt-[14px] flex items-end justify-between">
              <SectionHeading color="bg-navy text-white">
                {t("labels.latestNews")}
              </SectionHeading>
              <Link
                href="/category/latest"
                className="pb-1 font-heading text-[11px] font-extrabold uppercase text-ink hover:text-primary"
              >
                {t("labels.viewAll")} <span aria-hidden="true">→</span>
              </Link>
            </div>
            <div className="mt-1">
              <HeadlineList
                articles={latestSide.filter((a) => a.id !== article.id)}
                locale={locale}
                showCategory={false}
              />
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
