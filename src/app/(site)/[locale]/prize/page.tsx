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
import { Crown, StarSpark } from "@/components/site/Doodads";
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
      <div className="flex items-center gap-2.5">
        <h1>
          <SectionHeading as="span" color="bg-yellow text-ink">
            {t("prize.title")}
          </SectionHeading>
        </h1>
        <Crown size={30} className="-rotate-6" />
      </div>
      <div className="mt-4 max-w-2xl rounded-[8px] border-2 border-ink bg-surface px-4 py-3">
        <p className="text-[14.5px] leading-relaxed">{t("prize.description")}</p>
      </div>
      <div className="mt-3 max-w-2xl rounded-[8px] border-2 border-ink bg-bg-sub px-4 py-2.5">
        <p className="text-[12.5px] leading-relaxed text-gray">
          {t("prize.judgingNote")}
        </p>
      </div>

      {/* 今週 */}
      <section className="mt-10" aria-label={t("prize.currentCycle")}>
        <SectionHeading color="bg-primary text-white">
          {t("prize.currentCycle")}
        </SectionHeading>
        {cycle ? (
          <>
            <p className="mt-3 text-sm font-semibold text-gray">
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
              <div className="mt-4 rounded-[13px] border-2 border-ink bg-surface">
                <p className="py-10 text-center font-semibold text-gray">
                  {t("labels.noArticles")}
                </p>
              </div>
            )}
          </>
        ) : (
          <div className="mt-4 rounded-[13px] border-2 border-ink bg-surface">
            <p className="py-10 text-center font-semibold text-gray">
              {t("prize.noCycle")}
            </p>
          </div>
        )}
      </section>

      {/* 過去の受賞者 */}
      <section className="mt-12" aria-label={t("prize.pastWinners")}>
        <div className="flex items-center gap-2.5">
          <SectionHeading color="bg-navy text-white">
            {t("prize.pastWinners")}
          </SectionHeading>
          <StarSpark size={20} />
        </div>
        {pastAwards.length === 0 ? (
          <div className="mt-4 rounded-[13px] border-2 border-ink bg-surface">
            <p className="py-10 text-center font-semibold text-gray">
              {t("labels.noArticles")}
            </p>
          </div>
        ) : (
          <div className="mt-5 grid gap-4 grid-cols-2 md:grid-cols-4">
            {pastAwards.map((award) => (
              <div key={award.id}>
                <p className="mb-1.5 flex flex-wrap items-center gap-x-1.5 gap-y-1">
                  <span className="inline-flex h-[22px] items-center rounded-[4px] border-2 border-ink bg-yellow px-[8px] font-heading text-[11px] font-extrabold uppercase text-ink">
                    🏆 {t("prize.winner")}
                  </span>
                  <span className="text-[11.5px] font-semibold text-gray">
                    {t("prize.week", {
                      date: formatTokyo(award.cycle.startAt, intl, {
                        year: "numeric",
                        month: "2-digit",
                        day: "2-digit",
                      }),
                    })}
                  </span>
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
      <section id="rules" className="mt-12" aria-label={t("prize.rules")}>
        <SectionHeading color="bg-teal text-white">
          {t("prize.rules")}
        </SectionHeading>
        <div className="mt-4 max-w-2xl rounded-[8px] border-2 border-ink bg-surface px-4 py-3">
          <p className="text-[14px] leading-relaxed text-gray">
            {t("prize.rulesBody")}
          </p>
        </div>
      </section>
    </div>
  );
}
