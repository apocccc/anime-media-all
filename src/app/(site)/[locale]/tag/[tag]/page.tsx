import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { getArticlesByTag } from "@/lib/data";
import { toDbLocale } from "@/lib/locale";
import { ArticleCard } from "@/components/site/ArticleCard";
import { Breadcrumbs } from "@/components/site/Breadcrumbs";
import { Pagination } from "@/components/site/Pagination";
import { SectionHeading } from "@/components/site/SectionHeading";

export const revalidate = 300;

const PER_PAGE = 20;

type Params = { locale: string; tag: string };

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { locale, tag: tagSlug } = await params;
  const { tag } = await getArticlesByTag(toDbLocale(locale), tagSlug, 1, 1);
  if (!tag) return {};
  return { title: `#${tag.name}` };
}

export default async function TagPage({
  params,
  searchParams,
}: {
  params: Promise<Params>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { locale, tag: tagSlug } = await params;
  setRequestLocale(locale);

  const { page: pageParam } = await searchParams;
  const page = Math.max(1, parseInt(pageParam ?? "1", 10) || 1);
  const { tag, items, total } = await getArticlesByTag(toDbLocale(locale), tagSlug, page, PER_PAGE);
  if (!tag) notFound();

  const t = await getTranslations();

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      <Breadcrumbs
        crumbs={[
          { name: t("nav.home"), path: "/" },
          { name: `#${tag.name}`, path: `/tag/${tagSlug}` },
        ]}
      />
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <h1>
          <SectionHeading as="span" color="bg-purple text-white">
            {t("tag.articlesTagged", { tag: tag.name })}
          </SectionHeading>
        </h1>
        <p className="inline-flex h-[24px] items-center rounded-[4px] bg-yellow px-[10px] font-heading text-[12px] font-extrabold uppercase text-ink">
          {t("labels.articleCount", { count: total })}
        </p>
      </div>

      {items.length === 0 ? (
        <div className="mt-6 rounded-[13px] border-2 border-ink bg-surface p-5">
          <p className="py-16 text-center font-semibold text-gray">
            {t("labels.noArticles")}
          </p>
        </div>
      ) : (
        <div className="mt-6 rounded-[13px] border-2 border-ink bg-surface p-4 sm:p-5">
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
        basePath={`/tag/${tagSlug}`}
        page={page}
        total={total}
        perPage={PER_PAGE}
      />
    </div>
  );
}
