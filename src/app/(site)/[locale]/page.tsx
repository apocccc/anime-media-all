import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import {
  getBreakingArticles,
  getCategoryDigests,
  getLatestArticles,
  getPinnedArticles,
  getPopularArticles,
} from "@/lib/data";
import { toDbLocale } from "@/lib/locale";
import { BreakingTicker } from "@/components/site/BreakingTicker";
import { FeaturedHero } from "@/components/site/FeaturedHero";
import { SideStoryCard } from "@/components/site/SideStoryCard";
import { MostReadPanel } from "@/components/site/MostReadPanel";
import { CategoryPanel } from "@/components/site/CategoryPanel";
import { CommunityPromo } from "@/components/site/CommunityPromo";
import { HeadlineList } from "@/components/site/HeadlineList";
import { SectionHeading } from "@/components/site/SectionHeading";

export const revalidate = 300;

/**
 * トップページ(デザイン仕様書 §5)。
 * BreakingTicker → MainTopGrid(Hero / SideStories / MostRead)
 * → LowerContentGrid(カテゴリーパネル×3 / CommunityPromo)→ 最新見出し。
 */
export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();
  const db = toDbLocale(locale);

  const [pinned, latest, breaking, popular, digests] = await Promise.all([
    getPinnedArticles(db, 3),
    getLatestArticles(db, 24, false),
    getBreakingArticles(db, 1),
    getPopularArticles(db, 5),
    getCategoryDigests(db, 3),
  ]);

  const hero = pinned[0] ?? latest[0];
  const sideStories = latest.filter((a) => a.id !== hero?.id).slice(0, 2);
  const usedIds = new Set([hero?.id, ...sideStories.map((a) => a.id)]);
  const rest = latest.filter((a) => !usedIds.has(a.id));
  // 下段パネル: news / anime / manga を優先し、足りない分は記事のあるカテゴリーで補完
  const preferred = ["news", "anime", "manga"];
  const panels = [
    ...preferred
      .map((slug) => digests.find((d) => d.category.slug === slug))
      .filter((d): d is (typeof digests)[number] => Boolean(d)),
    ...digests.filter((d) => !preferred.includes(d.category.slug)),
  ].slice(0, 3);

  return (
    <div className="mx-auto w-[calc(100%-24px)] max-w-[1600px] pb-6 xl:w-[calc(100%-72px)]">
      <BreakingTicker article={breaking[0] ?? latest[0] ?? null} />

      {hero ? (
        <>
          {/* 上段: Hero / サイドカード / Most Read(§13) */}
          <div className="mt-[14px] grid gap-[14px] lg:grid-cols-[minmax(0,854fr)_minmax(240px,278fr)_minmax(340px,420fr)]">
            <FeaturedHero article={hero} />
            <div className="grid gap-[12px] sm:grid-cols-2 lg:grid-cols-1 lg:content-start">
              {sideStories.map((a) => (
                <SideStoryCard key={a.id} article={a} locale={locale} />
              ))}
            </div>
            <MostReadPanel articles={popular} locale={locale} />
          </div>

          {/* 下段: カテゴリーパネル×3 + Community Promo(§17) */}
          <div className="mt-[26px] grid gap-[14px] md:grid-cols-2 lg:grid-cols-[390fr_370fr_360fr_420fr]">
            {panels.map(({ category, articles }) => (
              <CategoryPanel
                key={category.id}
                category={category}
                articles={articles}
                locale={locale}
              />
            ))}
            <CommunityPromo />
          </div>

          {/* 最新見出し(高密度リスト) */}
          {rest.length > 0 ? (
            <section
              className="mt-[26px] rounded-[13px] border-2 border-ink bg-surface px-[14px] pb-2"
              aria-label={t("labels.latestNews")}
            >
              <div className="-mt-[14px] flex items-end justify-between">
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
              <HeadlineList articles={rest.slice(0, 12)} locale={locale} />
            </section>
          ) : null}
        </>
      ) : (
        <p className="py-20 text-center font-heading text-lg font-bold text-gray">
          {t("labels.noArticles")}
        </p>
      )}
    </div>
  );
}
