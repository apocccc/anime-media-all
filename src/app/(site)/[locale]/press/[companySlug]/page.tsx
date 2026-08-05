import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import {
  getOrganizationBySlug,
  getOrganizationPressReleases,
} from "@/lib/data-community";
import { ArticleCard } from "@/components/site/ArticleCard";
import { Breadcrumbs } from "@/components/site/Breadcrumbs";
import { Pagination } from "@/components/site/Pagination";
import { SectionHeading } from "@/components/site/SectionHeading";
import { categoryAccent } from "@/lib/category-style";
import { staticAlternates } from "@/lib/seo";
import { toDbLocale } from "@/lib/locale";
import { localizedUrl } from "@/lib/site";

export const revalidate = 300;

const PER_PAGE = 20;

type Params = { locale: string; companySlug: string };

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { locale, companySlug } = await params;
  const org = await getOrganizationBySlug(companySlug);
  if (!org) return {};
  const path = `/press/${companySlug}`;
  return {
    title: org.name,
    description: org.description ?? undefined,
    alternates: {
      canonical: localizedUrl(locale, path),
      languages: staticAlternates(path).languages,
    },
  };
}

/** 企業ページ: その企業のPR一覧+プロフィール(§7.2) */
export default async function CompanyPage({
  params,
  searchParams,
}: {
  params: Promise<Params>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { locale, companySlug } = await params;
  setRequestLocale(locale);

  const org = await getOrganizationBySlug(companySlug);
  if (!org) notFound();

  const { page: pageParam } = await searchParams;
  const page = Math.max(1, parseInt(pageParam ?? "1", 10) || 1);
  const t = await getTranslations();

  const { items, total } = await getOrganizationPressReleases(
    toDbLocale(locale),
    org.id,
    page,
    PER_PAGE
  );
  const accent = categoryAccent("press-release");

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      <Breadcrumbs
        crumbs={[
          { name: t("nav.home"), path: "/" },
          { name: org.name, path: `/press/${companySlug}` },
        ]}
      />

      <header className="mt-4 rounded-[13px] border-2 border-ink bg-surface p-5">
        <div className="flex items-center gap-4">
          {org.logoUrl ? (
            <Image
              src={org.logoUrl}
              alt={org.name}
              width={64}
              height={64}
              className="shrink-0 rounded-[8px] border-2 border-ink bg-surface"
            />
          ) : (
            <div
              aria-hidden="true"
              className="flex h-16 w-16 shrink-0 items-center justify-center rounded-[8px] border-2 border-ink bg-primary-light font-display text-xl text-primary"
            >
              {org.name.charAt(0)}
            </div>
          )}
          <div className="min-w-0">
            <p>
              <span
                className={`inline-flex h-[18px] items-center rounded-[4px] px-[7px] font-heading text-[10px] font-extrabold uppercase ${accent.chip}`}
              >
                {t("press.companyPage")}
              </span>
            </p>
            <h1 className="mt-1 font-heading text-[26px] font-extrabold leading-tight">
              {org.name}
            </h1>
            {org.description ? (
              <p className="mt-1 text-sm leading-relaxed text-gray">
                {org.description}
              </p>
            ) : null}
            {org.websiteUrl ? (
              <p className="mt-2.5">
                <a
                  href={org.websiteUrl}
                  target="_blank"
                  rel="sponsored nofollow noopener"
                  className="inline-flex h-[24px] items-center gap-1 rounded-[4px] border-2 border-ink bg-surface px-[9px] font-heading text-[11px] font-extrabold uppercase text-ink hover:bg-yellow"
                >
                  {t("press.website")}
                  <span aria-hidden="true">→</span>
                </a>
              </p>
            ) : null}
          </div>
        </div>
      </header>

      <div className="mt-8">
        <SectionHeading color="bg-navy text-white">
          {t("press.pressReleasesBy", { name: org.name })}
        </SectionHeading>
      </div>

      {items.length === 0 ? (
        <div className="mt-5 rounded-[13px] border-2 border-ink bg-surface">
          <p className="py-16 text-center font-semibold text-gray">
            {t("labels.noArticles")}
          </p>
        </div>
      ) : (
        <div className="mt-5 rounded-[13px] border-2 border-ink bg-surface p-4 sm:p-5">
          {items.map((a, i) => (
            <div
              key={a.id}
              className={
                i < items.length - 1
                  ? "mb-4 border-b border-dashed border-dash pb-4"
                  : ""
              }
            >
              <ArticleCard article={a} locale={locale} />
            </div>
          ))}
        </div>
      )}

      <Pagination
        basePath={`/press/${companySlug}`}
        page={page}
        total={total}
        perPage={PER_PAGE}
      />
    </div>
  );
}
