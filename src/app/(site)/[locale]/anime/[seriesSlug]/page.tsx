import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import {
  firstMediaUrls,
  getFanPosts,
  getSeriesBySlug,
  getSeriesNews,
  seriesSynopsis,
  seriesTitle,
} from "@/lib/data-community";
import { ArticleCard } from "@/components/site/ArticleCard";
import { FanPostCard } from "@/components/site/FanPostCard";
import { Breadcrumbs } from "@/components/site/Breadcrumbs";
import { SectionHeading } from "@/components/site/SectionHeading";
import { JsonLd } from "@/components/JsonLd";
import { breadcrumbJsonLd, seriesJsonLd, staticAlternates } from "@/lib/seo";
import { toDbLocale } from "@/lib/locale";
import { localizedUrl } from "@/lib/site";

export const revalidate = 300;

type Params = { locale: string; seriesSlug: string };

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { locale, seriesSlug } = await params;
  const series = await getSeriesBySlug(seriesSlug);
  if (!series) return {};
  const db = toDbLocale(locale);
  const path = `/anime/${seriesSlug}`;
  return {
    title: seriesTitle(series, db),
    description: seriesSynopsis(series, db) || undefined,
    alternates: {
      canonical: localizedUrl(locale, path),
      languages: staticAlternates(path).languages,
    },
  };
}

type SeriesLinks = {
  official?: string;
  streaming?: { name: string; url: string }[];
};

type SeriesBroadcast = {
  season?: string;
  broadcast?: string;
  episodes?: number;
};

/** 作品ページ: ニュース / ファン投稿 / 基本情報(§8.3) */
export default async function SeriesPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { locale, seriesSlug } = await params;
  setRequestLocale(locale);
  const db = toDbLocale(locale);

  const series = await getSeriesBySlug(seriesSlug);
  if (!series) notFound();

  const t = await getTranslations();
  const [news, { items: fanPosts }] = await Promise.all([
    getSeriesNews(db, series.id, 10),
    getFanPosts({ seriesId: series.id, sort: "popular", perPage: 8 }),
  ]);
  const mediaUrls = await firstMediaUrls(fanPosts);

  const title = seriesTitle(series, db);
  const synopsis = seriesSynopsis(series, db);
  const links = (series.links ?? {}) as SeriesLinks;
  const broadcast = (series.broadcast ?? {}) as SeriesBroadcast;

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <JsonLd
        data={[
          seriesJsonLd(series, locale),
          breadcrumbJsonLd(
            [
              { name: t("nav.home"), path: "/" },
              { name: title, path: `/anime/${seriesSlug}` },
            ],
            locale
          ),
        ]}
      />
      <Breadcrumbs
        crumbs={[
          { name: t("nav.home"), path: "/" },
          { name: title, path: `/anime/${seriesSlug}` },
        ]}
      />

      {/* ヘッダー */}
      <header className="mt-4 flex flex-col gap-5 sm:flex-row">
        {series.heroImage ? (
          <div className="relative aspect-[16/9] w-full shrink-0 overflow-hidden rounded-[13px] border-2 border-ink sm:w-80">
            <Image
              src={series.heroImage.url}
              alt={series.heroImage.alt || title}
              fill
              sizes="(min-width: 640px) 320px, 100vw"
              className="object-cover"
              priority
            />
          </div>
        ) : null}
        <div className="min-w-0">
          <h1 className="font-display text-[34px] uppercase leading-[1.05] text-ink">
            {title}
          </h1>
          <p className="mt-1.5 text-sm text-gray">{series.titleJa}</p>
          {synopsis ? (
            <p className="mt-3 text-[14.5px] leading-relaxed">{synopsis}</p>
          ) : null}
        </div>
      </header>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_300px]">
        <div className="min-w-0">
          {/* ニュース */}
          <section
            aria-label={t("series.newsTab")}
            className="rounded-[13px] border-2 border-ink bg-surface px-[12px] pb-3"
          >
            <div className="-mt-[14px]">
              <SectionHeading color="bg-teal text-white">
                {t("series.latestNews", { title })}
              </SectionHeading>
            </div>
            {news.length === 0 ? (
              <p className="py-10 text-center text-gray">
                {t("labels.noArticles")}
              </p>
            ) : (
              <div className="mt-1">
                {news.map((a, i) => (
                  <div
                    key={a.id}
                    className={`py-4 ${
                      i < news.length - 1
                        ? "border-b border-dashed border-dash"
                        : ""
                    }`}
                  >
                    <ArticleCard article={a} locale={locale} />
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* ファン投稿 */}
          <section
            className="mt-10 rounded-[13px] border-2 border-ink bg-surface px-[12px] pb-3"
            aria-label={t("series.fansTab")}
          >
            <div className="-mt-[14px] flex items-end justify-between">
              <SectionHeading color="bg-primary text-white">
                {t("series.fanPostsFor", { title })}
              </SectionHeading>
              <Link
                href={`/anime/${seriesSlug}/fans`}
                className="pb-1 font-heading text-[11px] font-extrabold uppercase text-ink hover:text-primary"
              >
                {t("series.viewAllFans")} <span aria-hidden="true">→</span>
              </Link>
            </div>
            {fanPosts.length === 0 ? (
              <p className="py-10 text-center text-gray">
                {t("series.noFanPosts")}
              </p>
            ) : (
              <div className="mt-4 grid gap-4 grid-cols-2 pb-1 md:grid-cols-4">
                {fanPosts.map((post) => (
                  <FanPostCard
                    key={post.id}
                    post={post}
                    locale={locale}
                    mediaUrl={mediaUrls.get(post.id)}
                  />
                ))}
              </div>
            )}
          </section>
        </div>

        {/* サイドバー: 基本情報 */}
        <aside>
          <section aria-label={t("series.infoTab")}>
            <SectionHeading color="bg-yellow text-ink">
              {t("series.infoTab")}
            </SectionHeading>
            <dl className="mt-3 rounded-[13px] border-2 border-ink bg-surface p-4 text-sm">
              {broadcast.season ? (
                <div className="border-b border-dashed border-dash py-2.5 first:pt-0 last:border-b-0 last:pb-0">
                  <dt className="font-heading text-[12px] font-extrabold uppercase text-gray">
                    {t("series.season")}
                  </dt>
                  <dd className="mt-0.5">{broadcast.season}</dd>
                </div>
              ) : null}
              {broadcast.broadcast ? (
                <div className="border-b border-dashed border-dash py-2.5 first:pt-0 last:border-b-0 last:pb-0">
                  <dt className="font-heading text-[12px] font-extrabold uppercase text-gray">
                    {t("series.broadcast")}
                  </dt>
                  <dd className="mt-0.5">{broadcast.broadcast}</dd>
                </div>
              ) : null}
              {broadcast.episodes ? (
                <div className="border-b border-dashed border-dash py-2.5 first:pt-0 last:border-b-0 last:pb-0">
                  <dt className="font-heading text-[12px] font-extrabold uppercase text-gray">
                    {t("series.episodes")}
                  </dt>
                  <dd className="mt-0.5">{broadcast.episodes}</dd>
                </div>
              ) : null}
              {links.official ? (
                <div className="border-b border-dashed border-dash py-2.5 first:pt-0 last:border-b-0 last:pb-0">
                  <dt className="font-heading text-[12px] font-extrabold uppercase text-gray">
                    {t("series.officialSite")}
                  </dt>
                  <dd className="mt-0.5">
                    <a
                      href={links.official}
                      target="_blank"
                      rel="noopener"
                      className="break-all text-primary underline underline-offset-2"
                    >
                      {links.official}
                    </a>
                  </dd>
                </div>
              ) : null}
              {links.streaming?.length ? (
                <div className="border-b border-dashed border-dash py-2.5 first:pt-0 last:border-b-0 last:pb-0">
                  <dt className="font-heading text-[12px] font-extrabold uppercase text-gray">
                    {t("series.streaming")}
                  </dt>
                  <dd className="mt-0.5">
                    <ul className="mt-0.5 space-y-0.5">
                      {links.streaming.map((s) => (
                        <li key={s.url}>
                          <a
                            href={s.url}
                            target="_blank"
                            rel="noopener"
                            className="text-primary underline underline-offset-2"
                          >
                            {s.name}
                          </a>
                        </li>
                      ))}
                    </ul>
                  </dd>
                </div>
              ) : null}
            </dl>
          </section>
        </aside>
      </div>
    </div>
  );
}
