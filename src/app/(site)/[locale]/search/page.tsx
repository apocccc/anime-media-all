import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { searchArticles } from "@/lib/data";
import { toDbLocale } from "@/lib/locale";
import { ArticleCard } from "@/components/site/ArticleCard";
import { Pagination } from "@/components/site/Pagination";
import { SectionHeading } from "@/components/site/SectionHeading";

export const dynamic = "force-dynamic";

const PER_PAGE = 20;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "search" });
  return { title: t("title"), robots: { index: false } };
}

export default async function SearchPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { q = "", page: pageParam } = await searchParams;
  const query = q.trim();
  const page = Math.max(1, parseInt(pageParam ?? "1", 10) || 1);
  const t = await getTranslations();

  const { items, total } = query
    ? await searchArticles(toDbLocale(locale), query, page, PER_PAGE)
    : { items: [], total: 0 };

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      <h1>
        <SectionHeading as="span">
          {query ? t("search.resultsFor", { query }) : t("search.title")}
        </SectionHeading>
      </h1>

      <form
        action=""
        method="get"
        role="search"
        className="mt-5 flex h-[46px] max-w-md items-center overflow-hidden rounded-[11px] border-2 border-ink bg-surface"
      >
        <input
          type="search"
          name="q"
          defaultValue={query}
          placeholder={t("search.placeholder")}
          className="h-full min-w-0 flex-1 bg-transparent px-4 text-sm text-ink outline-none placeholder:text-[#a29fa9]"
        />
        <button
          type="submit"
          className="flex h-full shrink-0 items-center justify-center bg-primary px-5 font-heading text-[14px] font-extrabold uppercase text-white hover:bg-primary-dark"
        >
          {t("search.button")}
        </button>
      </form>

      {query && items.length === 0 ? (
        <p className="py-20 text-center font-semibold text-gray">
          {t("search.noResults", { query })}
        </p>
      ) : items.length > 0 ? (
        <div className="mt-8 rounded-[13px] border-2 border-ink bg-surface p-4 sm:p-5">
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
      ) : null}

      {query ? (
        <Pagination
          basePath="/search"
          page={page}
          total={total}
          perPage={PER_PAGE}
          extraQuery={{ q: query }}
        />
      ) : null}
    </div>
  );
}
