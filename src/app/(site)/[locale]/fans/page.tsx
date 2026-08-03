import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { firstMediaUrls, getFanPosts, getSeriesList, seriesTitle } from "@/lib/data-community";
import { FanPostCard } from "@/components/site/FanPostCard";
import { Pagination } from "@/components/site/Pagination";
import { SectionHeading } from "@/components/site/SectionHeading";
import { StarSpark } from "@/components/site/Doodads";
import { staticAlternates } from "@/lib/seo";
import { toDbLocale } from "@/lib/locale";
import { localizedUrl } from "@/lib/site";

export const revalidate = 300;

const PER_PAGE = 24;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "fans" });
  return {
    title: t("title"),
    alternates: {
      canonical: localizedUrl(locale, "/fans"),
      languages: staticAlternates("/fans").languages,
    },
  };
}

/** ファン投稿ハブ(新着・人気・作品別) */
export default async function FansPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ sort?: string; page?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { sort: sortParam, page: pageParam } = await searchParams;
  const sort = sortParam === "popular" ? "popular" : "latest";
  const page = Math.max(1, parseInt(pageParam ?? "1", 10) || 1);
  const t = await getTranslations();
  const db = toDbLocale(locale);

  const [{ items, total }, seriesList] = await Promise.all([
    getFanPosts({ sort, page, perPage: PER_PAGE }),
    getSeriesList(20),
  ]);
  const mediaUrls = await firstMediaUrls(items);

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <h1 className="flex items-center gap-2 text-2xl">
        <SectionHeading as="span" color="bg-primary text-white">
          {t("fans.title")}
        </SectionHeading>
        <StarSpark size={24} className="shrink-0" />
      </h1>
      <p className="mt-3 text-xs text-gray">{t("fans.aiTranslationNote")}</p>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {(["latest", "popular"] as const).map((s) => (
          <Link
            key={s}
            href={s === "latest" ? "/fans" : `/fans?sort=${s}`}
            className={`inline-flex items-center rounded-full border-2 border-ink px-4 py-1 font-heading text-sm font-extrabold uppercase ${
              sort === s
                ? "bg-primary text-white"
                : "bg-surface text-ink hover:bg-yellow"
            }`}
          >
            {t(`fans.${s}`)}
          </Link>
        ))}
      </div>

      {/* 作品別リンク */}
      {seriesList.length > 0 ? (
        <div className="mt-4">
          <span className="font-heading text-[12px] font-extrabold uppercase text-ink">
            {t("fans.bySeries")}:
          </span>
          <ul className="mt-1.5 flex flex-wrap gap-2">
            {seriesList.map((s) => (
              <li key={s.id}>
                <Link
                  href={`/anime/${s.slug}/fans`}
                  className="inline-block rounded-full border-2 border-ink bg-surface px-3 py-0.5 text-[13px] font-semibold text-ink hover:bg-yellow"
                >
                  {seriesTitle(s, db)}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {items.length === 0 ? (
        <p className="py-20 text-center text-gray">{t("labels.noArticles")}</p>
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
        basePath="/fans"
        page={page}
        total={total}
        perPage={PER_PAGE}
        {...(sort === "popular" ? { extraQuery: { sort } } : {})}
      />
    </div>
  );
}
