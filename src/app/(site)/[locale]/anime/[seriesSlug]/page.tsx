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
          <div className="relative aspect-[16/9] w-full shrink-0 overflow-hidden rounded-lg sm:w-80">
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
          <h1 className="text-[28px] font-black leading-snug">{title}</h1>
          <p className="mt-1 text-sm text-gray">{series.titleJa}</p>
          {synopsis ? (
            <p className="mt-3 text-[14.5px] leading-relaxed">{synopsis}</p>
          ) : null}
        </div>
      </header>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_300px]">
        <div className="min-w-0">
          {/* ニュース */}
          <section aria-label={t("series.newsTab")}>
            <div className="border-t-2 border-ink pt-2.5">
              <SectionHeading>
                {t("series.latestNews", { title })}
              </SectionHeading>
            </div>
            {news.length === 0 ? (
              <p className="py-10 text-center text-gray">
                {t("labels.noArticles")}
              </p>
            ) : (
              <div className="mt-4 flex flex-col gap-5">
                {news.map((a) => (
                  <ArticleCard key={a.id} article={a} locale={locale} />
                ))}
              </div>
            )}
          </section>

          {/* ファン投稿 */}
          <section className="mt-10" aria-label={t("series.fansTab")}>
            <div className="flex items-baseline justify-between border-t-2 border-primary pt-2.5">
              <SectionHeading>{t("series.fanPostsFor", { title })}</SectionHeading>
              <Link
                href={`/anime/${seriesSlug}/fans`}
                className="text-[12.5px] font-medium text-gray hover:text-primary"
              >
                {t("series.viewAllFans")} →
              </Link>
            </div>
            {fanPosts.length === 0 ? (
              <p className="py-10 text-center text-gray">
                {t("series.noFanPosts")}
              </p>
            ) : (
              <div className="mt-4 grid gap-4 grid-cols-2 md:grid-cols-4">
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
            <div className="border-t-2 border-ink pt-2.5">
              <SectionHeading>{t("series.infoTab")}</SectionHeading>
            </div>
            <dl className="mt-3 space-y-3 text-sm">
              {broadcast.season ? (
                <div>
                  <dt className="font-bold text-gray">{t("series.season")}</dt>
                  <dd>{broadcast.season}</dd>
                </div>
              ) : null}
              {broadcast.broadcast ? (
                <div>
                  <dt className="font-bold text-gray">{t("series.broadcast")}</dt>
                  <dd>{broadcast.broadcast}</dd>
                </div>
              ) : null}
              {broadcast.episodes ? (
                <div>
                  <dt className="font-bold text-gray">{t("series.episodes")}</dt>
                  <dd>{broadcast.episodes}</dd>
                </div>
              ) : null}
              {links.official ? (
                <div>
                  <dt className="font-bold text-gray">
                    {t("series.officialSite")}
                  </dt>
                  <dd>
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
                <div>
                  <dt className="font-bold text-gray">{t("series.streaming")}</dt>
                  <dd>
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
