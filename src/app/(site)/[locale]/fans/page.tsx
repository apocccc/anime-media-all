import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { firstMediaUrls, getFanPosts, getSeriesList, seriesTitle } from "@/lib/data-community";
import { FanPostCard } from "@/components/site/FanPostCard";
import { Pagination } from "@/components/site/Pagination";
import { SectionHeading } from "@/components/site/SectionHeading";
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
      <h1 className="text-2xl font-black">
        <SectionHeading>{t("fans.title")}</SectionHeading>
      </h1>
      <p className="mt-2 text-xs text-gray">{t("fans.aiTranslationNote")}</p>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {(["latest", "popular"] as const).map((s) => (
          <Link
            key={s}
            href={s === "latest" ? "/fans" : `/fans?sort=${s}`}
            className={`rounded-full px-4 py-1.5 text-sm font-bold ${
              sort === s
                ? "bg-primary text-white"
                : "border border-line text-gray hover:border-primary hover:text-primary"
            }`}
          >
            {t(`fans.${s}`)}
          </Link>
        ))}
      </div>

      {/* 作品別リンク */}
      {seriesList.length > 0 ? (
        <div className="mt-4">
          <span className="text-[13px] font-bold text-gray">
            {t("fans.bySeries")}:
          </span>
          <ul className="mt-1.5 flex flex-wrap gap-2">
            {seriesList.map((s) => (
              <li key={s.id}>
                <Link
                  href={`/anime/${s.slug}/fans`}
                  className="inline-block rounded-full border border-line px-3 py-1 text-[13px] text-gray hover:border-primary hover:text-primary"
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
