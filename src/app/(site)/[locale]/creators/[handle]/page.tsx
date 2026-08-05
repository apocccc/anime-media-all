import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import {
  firstMediaUrls,
  getCreatorByHandle,
  getFanPosts,
} from "@/lib/data-community";
import { FanPostCard } from "@/components/site/FanPostCard";
import { Breadcrumbs } from "@/components/site/Breadcrumbs";
import { Pagination } from "@/components/site/Pagination";
import { SectionHeading } from "@/components/site/SectionHeading";
import { JsonLd } from "@/components/JsonLd";
import { creatorJsonLd, staticAlternates } from "@/lib/seo";
import { localizedUrl } from "@/lib/site";

export const revalidate = 300;

const PER_PAGE = 24;

type Params = { locale: string; handle: string };

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { locale, handle } = await params;
  const creator = await getCreatorByHandle(handle);
  if (!creator) return {};
  const path = `/creators/${handle}`;
  return {
    title: creator.name,
    description: creator.bio ?? undefined,
    alternates: {
      canonical: localizedUrl(locale, path),
      languages: staticAlternates(path).languages,
    },
  };
}

/** 投稿者(インフルエンサー)ページ。index対象(§8.3) */
export default async function CreatorPage({
  params,
  searchParams,
}: {
  params: Promise<Params>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { locale, handle } = await params;
  setRequestLocale(locale);

  const creator = await getCreatorByHandle(handle);
  if (!creator) notFound();

  const { page: pageParam } = await searchParams;
  const page = Math.max(1, parseInt(pageParam ?? "1", 10) || 1);
  const t = await getTranslations();

  const { items, total } = await getFanPosts({
    authorId: creator.id,
    page,
    perPage: PER_PAGE,
  });
  const mediaUrls = await firstMediaUrls(items);
  const sns = (creator.snsLinks ?? []) as { name: string; url: string }[];

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <JsonLd data={creatorJsonLd(creator, locale)} />
      <Breadcrumbs
        crumbs={[
          { name: t("nav.home"), path: "/" },
          { name: creator.name, path: `/creators/${handle}` },
        ]}
      />

      <header className="mt-4 rounded-[13px] border-2 border-ink bg-surface p-5">
        <div className="flex items-center gap-4">
          {creator.avatarUrl ? (
            <Image
              src={creator.avatarUrl}
              alt={creator.name}
              width={64}
              height={64}
              className="shrink-0 rounded-full border-2 border-ink"
            />
          ) : (
            <div
              aria-hidden="true"
              className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full border-2 border-ink bg-primary-light font-display text-xl text-primary"
            >
              {creator.name.charAt(0)}
            </div>
          )}
          <div className="min-w-0">
            <p>
              <span className="inline-flex h-[18px] items-center rounded-[4px] bg-teal px-[7px] font-heading text-[10px] font-extrabold uppercase text-white">
                {t("creators.creator")}
              </span>
            </p>
            <h1 className="mt-1 font-heading text-[26px] font-extrabold leading-tight">
              {creator.name}
            </h1>
            {creator.bio ? (
              <p className="mt-1 text-sm leading-relaxed text-gray">
                {creator.bio}
              </p>
            ) : null}
            {Array.isArray(sns) && sns.length > 0 ? (
              <ul className="mt-2.5 flex flex-wrap gap-2">
                {sns.map((s) => (
                  <li key={s.url}>
                    <a
                      href={s.url}
                      target="_blank"
                      rel="ugc nofollow noopener"
                      className="inline-flex h-[24px] items-center rounded-[4px] border-2 border-ink bg-surface px-[9px] font-heading text-[11px] font-extrabold uppercase text-ink hover:bg-yellow"
                    >
                      {s.name}
                    </a>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </div>
      </header>

      <div className="mt-8">
        <SectionHeading>
          {t("creators.postsBy", { name: creator.name })}
        </SectionHeading>
      </div>

      {items.length === 0 ? (
        <div className="mt-5 rounded-[13px] border-2 border-ink bg-surface">
          <p className="py-16 text-center font-semibold text-gray">
            {t("labels.noArticles")}
          </p>
        </div>
      ) : (
        <div className="mt-5 grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
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
        basePath={`/creators/${handle}`}
        page={page}
        total={total}
        perPage={PER_PAGE}
      />
    </div>
  );
}
