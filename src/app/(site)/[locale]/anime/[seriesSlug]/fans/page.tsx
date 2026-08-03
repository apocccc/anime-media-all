import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import {
  firstMediaUrls,
  getFanPosts,
  getSeriesBySlug,
  seriesTitle,
} from "@/lib/data-community";
import { FanPostCard } from "@/components/site/FanPostCard";
import { Breadcrumbs } from "@/components/site/Breadcrumbs";
import { Pagination } from "@/components/site/Pagination";
import { SectionHeading } from "@/components/site/SectionHeading";
import { staticAlternates } from "@/lib/seo";
import { toDbLocale } from "@/lib/locale";
import { localizedUrl } from "@/lib/site";

export const revalidate = 300;

const PER_PAGE = 24;

type Params = { locale: string; seriesSlug: string };

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { locale, seriesSlug } = await params;
  const series = await getSeriesBySlug(seriesSlug);
  if (!series) return {};
  const t = await getTranslations({ locale, namespace: "series" });
  const path = `/anime/${seriesSlug}/fans`;
  return {
    title: t("fanPostsFor", { title: seriesTitle(series, toDbLocale(locale)) }),
    alternates: {
      canonical: localizedUrl(locale, path),
      languages: staticAlternates(path).languages,
    },
  };
}

/** 作品別ファン投稿一覧(ギャラリー。index対象) */
export default async function SeriesFansPage({
  params,
  searchParams,
}: {
  params: Promise<Params>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { locale, seriesSlug } = await params;
  setRequestLocale(locale);
  const db = toDbLocale(locale);

  const series = await getSeriesBySlug(seriesSlug);
  if (!series) notFound();

  const { page: pageParam } = await searchParams;
  const page = Math.max(1, parseInt(pageParam ?? "1", 10) || 1);
  const t = await getTranslations();
  const title = seriesTitle(series, db);

  const { items, total } = await getFanPosts({
    seriesId: series.id,
    page,
    perPage: PER_PAGE,
  });
  const mediaUrls = await firstMediaUrls(items);

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <Breadcrumbs
        crumbs={[
          { name: t("nav.home"), path: "/" },
          { name: title, path: `/anime/${seriesSlug}` },
          { name: t("series.fansTab"), path: `/anime/${seriesSlug}/fans` },
        ]}
      />
      <h1 className="mt-4 text-2xl font-black">
        <SectionHeading>{t("series.fanPostsFor", { title })}</SectionHeading>
      </h1>

      {items.length === 0 ? (
        <p className="py-20 text-center text-gray">{t("series.noFanPosts")}</p>
      ) : (
        <div className="mt-6 grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {items.map((post) => (
            <FanPostCard
              key={post.id}
              post={post}
              locale={locale}
              mediaUrl={mediaUrls.get(post.id)}
            />
          ))}
        </div>
      )}

      <Pagination
        basePath={`/anime/${seriesSlug}/fans`}
        page={page}
        total={total}
        perPage={PER_PAGE}
      />
    </div>
  );
}
