import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { getArticlesByCategory, getCategoryBySlug } from "@/lib/data";
import { ArticleCard } from "@/components/site/ArticleCard";
import { Breadcrumbs } from "@/components/site/Breadcrumbs";
import { Pagination } from "@/components/site/Pagination";
import { SectionHeading } from "@/components/site/SectionHeading";
import { categoryName } from "@/lib/categories";
import { categoryAccent } from "@/lib/category-style";
import { staticAlternates } from "@/lib/seo";
import { toDbLocale } from "@/lib/locale";
import { localizedUrl } from "@/lib/site";

export const revalidate = 300;

const PER_PAGE = 20;

type Params = { locale: string; category: string };

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { locale, category: slug } = await params;
  const category = await getCategoryBySlug(slug);
  if (!category) return {};
  const name = categoryName(category, locale);
  const path = `/category/${slug}`;
  return {
    title: name,
    alternates: {
      canonical: localizedUrl(locale, path),
      languages: staticAlternates(path).languages,
    },
    openGraph: {
      title: name,
      url: localizedUrl(locale, path),
    },
  };
}

export default async function CategoryPage({
  params,
  searchParams,
}: {
  params: Promise<Params>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { locale, category: slug } = await params;
  setRequestLocale(locale);

  const category = await getCategoryBySlug(slug);
  if (!category || !category.isVisible) notFound();

  const { page: pageParam } = await searchParams;
  const page = Math.max(1, parseInt(pageParam ?? "1", 10) || 1);
  const t = await getTranslations();
  const { items, total } = await getArticlesByCategory(
    toDbLocale(locale),
    slug,
    page,
    PER_PAGE
  );
  const name = categoryName(category, locale);
  const accent = categoryAccent(slug);

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      <Breadcrumbs
        crumbs={[
          { name: t("nav.home"), path: "/" },
          { name, path: `/category/${slug}` },
        ]}
      />
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <h1>
          <SectionHeading as="span" color={accent.chip}>
            {name}
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
              <ArticleCard
                article={a}
                locale={locale}
                showCategory={slug === "latest"}
              />
            </div>
          ))}
        </div>
      )}

      <Pagination
        basePath={`/category/${slug}`}
        page={page}
        total={total}
        perPage={PER_PAGE}
      />
    </div>
  );
}
