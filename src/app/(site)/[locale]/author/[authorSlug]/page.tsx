import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { getAuthorWithArticles } from "@/lib/data";
import { toDbLocale } from "@/lib/locale";
import { ArticleCard } from "@/components/site/ArticleCard";
import { Breadcrumbs } from "@/components/site/Breadcrumbs";
import { Pagination } from "@/components/site/Pagination";
import { SectionHeading } from "@/components/site/SectionHeading";

export const revalidate = 300;

const PER_PAGE = 20;

type Params = { locale: string; authorSlug: string };

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { locale, authorSlug } = await params;
  const { author } = await getAuthorWithArticles(toDbLocale(locale), authorSlug, 1, 1);
  if (!author) return {};
  return { title: author.name, description: author.bio ?? undefined };
}

export default async function AuthorPage({
  params,
  searchParams,
}: {
  params: Promise<Params>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { locale, authorSlug } = await params;
  setRequestLocale(locale);

  const { page: pageParam } = await searchParams;
  const page = Math.max(1, parseInt(pageParam ?? "1", 10) || 1);
  const { author, items, total } = await getAuthorWithArticles(
    toDbLocale(locale),
    authorSlug,
    page,
    PER_PAGE
  );
  if (!author) notFound();

  const t = await getTranslations();

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      <Breadcrumbs
        crumbs={[
          { name: t("nav.home"), path: "/" },
          { name: author.name, path: `/author/${authorSlug}` },
        ]}
      />

      <header className="mt-4 flex items-center gap-4 rounded-[13px] border-2 border-ink bg-surface p-5">
        {author.avatarUrl ? (
          <Image
            src={author.avatarUrl}
            alt={author.name}
            width={64}
            height={64}
            className="rounded-full border-2 border-ink"
          />
        ) : (
          <div
            aria-hidden="true"
            className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-ink bg-primary-light font-display text-2xl text-primary"
          >
            {author.name.charAt(0)}
          </div>
        )}
        <div className="min-w-0">
          <h1 className="font-heading text-2xl font-extrabold uppercase leading-tight text-ink">
            {author.name}
          </h1>
          {author.bio ? (
            <p className="mt-1 text-sm leading-relaxed text-gray">{author.bio}</p>
          ) : null}
        </div>
      </header>

      <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
        <SectionHeading color="bg-teal text-white">
          {t("author.articlesBy", { name: author.name })}
        </SectionHeading>
        <p className="inline-flex h-[24px] items-center rounded-[4px] bg-yellow px-[10px] font-heading text-[12px] font-extrabold uppercase text-ink">
          {t("labels.articleCount", { count: total })}
        </p>
      </div>

      {items.length === 0 ? (
        <div className="mt-5 rounded-[13px] border-2 border-ink bg-surface p-5">
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
        basePath={`/author/${authorSlug}`}
        page={page}
        total={total}
        perPage={PER_PAGE}
      />
    </div>
  );
}
