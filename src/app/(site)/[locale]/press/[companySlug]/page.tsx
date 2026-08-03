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

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      <Breadcrumbs
        crumbs={[
          { name: t("nav.home"), path: "/" },
          { name: org.name, path: `/press/${companySlug}` },
        ]}
      />

      <header className="mt-4 flex items-center gap-4 border-b border-line pb-6">
        {org.logoUrl ? (
          <Image
            src={org.logoUrl}
            alt={org.name}
            width={64}
            height={64}
            className="rounded-md"
          />
        ) : (
          <div
            aria-hidden="true"
            className="flex h-16 w-16 items-center justify-center rounded-md bg-primary-light text-xl font-black text-primary"
          >
            {org.name.charAt(0)}
          </div>
        )}
        <div>
          <p className="text-xs font-bold text-gray">{t("press.companyPage")}</p>
          <h1 className="text-2xl font-black">{org.name}</h1>
          {org.description ? (
            <p className="mt-1 text-sm text-gray">{org.description}</p>
          ) : null}
          {org.websiteUrl ? (
            <p className="mt-1 text-[13px]">
              <a
                href={org.websiteUrl}
                target="_blank"
                rel="sponsored nofollow noopener"
                className="text-primary underline underline-offset-2"
              >
                {t("press.website")}
              </a>
            </p>
          ) : null}
        </div>
      </header>

      <h2 className="mt-6 text-lg font-bold">
        {t("press.pressReleasesBy", { name: org.name })}
      </h2>

      {items.length === 0 ? (
        <p className="py-20 text-center text-gray">{t("labels.noArticles")}</p>
      ) : (
        <div className="mt-5 flex flex-col gap-7">
          {items.map((a) => (
            <ArticleCard key={a.id} article={a} locale={locale} />
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
