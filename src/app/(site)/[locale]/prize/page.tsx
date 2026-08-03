import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import {
  firstMediaUrls,
  getCycleLeaders,
  getOpenPrizeCycle,
  getPastAwards,
} from "@/lib/data-community";
import { FanPostCard } from "@/components/site/FanPostCard";
import { SectionHeading } from "@/components/site/SectionHeading";
import { staticAlternates } from "@/lib/seo";
import { localeMeta } from "@/lib/locale";
import { formatTokyo, localizedUrl } from "@/lib/site";

export const revalidate = 300;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "prize" });
  return {
    title: t("title"),
    description: t("description"),
    alternates: {
      canonical: localizedUrl(locale, "/prize"),
      languages: staticAlternates("/prize").languages,
    },
  };
}

/** 今週のプライズ・過去の受賞者・規約(§9) */
export default async function PrizePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();
  const intl = localeMeta(locale).intl;

  const cycle = await getOpenPrizeCycle();
  const [leaders, pastAwards] = await Promise.all([
    cycle ? getCycleLeaders(cycle.id, 8) : Promise.resolve([]),
    getPastAwards(12),
  ]);
  const leaderMedia = await firstMediaUrls(leaders.map((l) => l.post));
  const awardMedia = await firstMediaUrls(pastAwards.map((a) => a.post));

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <h1 className="text-2xl font-black">
        <SectionHeading>{t("prize.title")}</SectionHeading>
      </h1>
      <p className="mt-2 max-w-2xl text-[14.5px] leading-relaxed">
        {t("prize.description")}
      </p>
      <p className="mt-2 max-w-2xl rounded-md bg-bg-sub px-4 py-2.5 text-[12.5px] text-gray">
        {t("prize.judgingNote")}
      </p>

      {/* 今週 */}
      <section className="mt-8" aria-label={t("prize.currentCycle")}>
        <div className="border-t-2 border-primary pt-2.5">
          <SectionHeading>{t("prize.currentCycle")}</SectionHeading>
        </div>
        {cycle ? (
          <>
            <p className="mt-2 text-sm text-gray">
              {t("prize.week", {
                date: formatTokyo(cycle.startAt, intl, {
                  year: "numeric",
                  month: "2-digit",
                  day: "2-digit",
                }),
              })}
              {" · "}
              {t("prize.votingEnds")}:{" "}
              <time dateTime={cycle.endAt.toISOString()}>
                {formatTokyo(cycle.endAt, intl)}
              </time>
            </p>
            {leaders.length > 0 ? (
              <div className="mt-4 grid gap-4 grid-cols-2 md:grid-cols-4">
                {leaders.map(({ post }) => (
                  <FanPostCard
                    key={post.id}
                    post={post}
                    locale={locale}
                    mediaUrl={leaderMedia.get(post.id)}
                  />
                ))}
              </div>
            ) : (
              <p className="py-10 text-center text-gray">
                {t("labels.noArticles")}
              </p>
            )}
          </>
        ) : (
          <p className="py-10 text-center text-gray">{t("prize.noCycle")}</p>
        )}
      </section>

      {/* 過去の受賞者 */}
      <section className="mt-10" aria-label={t("prize.pastWinners")}>
        <div className="border-t-2 border-ink pt-2.5">
          <SectionHeading>{t("prize.pastWinners")}</SectionHeading>
        </div>
        {pastAwards.length === 0 ? (
          <p className="py-10 text-center text-gray">{t("labels.noArticles")}</p>
        ) : (
          <div className="mt-4 grid gap-4 grid-cols-2 md:grid-cols-4">
            {pastAwards.map((award) => (
              <div key={award.id}>
                <p className="mb-1 text-[12px] font-bold text-primary-dark">
                  🏆 {t("prize.winner")} —{" "}
                  {t("prize.week", {
                    date: formatTokyo(award.cycle.startAt, intl, {
                      year: "numeric",
                      month: "2-digit",
                      day: "2-digit",
                    }),
                  })}
                </p>
                <FanPostCard
                  post={award.post}
                  locale={locale}
                  mediaUrl={awardMedia.get(award.post.id)}
                />
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 規約(ロケールごとの公式ルール掲示。§9.3) */}
      <section id="rules" className="mt-10" aria-label={t("prize.rules")}>
        <div className="border-t-2 border-ink pt-2.5">
          <SectionHeading>{t("prize.rules")}</SectionHeading>
        </div>
        <p className="mt-3 max-w-2xl text-[14px] leading-relaxed text-gray">
          {t("prize.rulesBody")}
        </p>
      </section>
    </div>
  );
}
