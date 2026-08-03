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

      <header className="mt-4 flex items-center gap-4 border-b border-line pb-6">
        {creator.avatarUrl ? (
          <Image
            src={creator.avatarUrl}
            alt={creator.name}
            width={64}
            height={64}
            className="rounded-full"
          />
        ) : (
          <div
            aria-hidden="true"
            className="flex h-16 w-16 items-center justify-center rounded-full bg-primary-light text-xl font-black text-primary"
          >
            {creator.name.charAt(0)}
          </div>
        )}
        <div>
          <p className="text-xs font-bold text-primary">
            {t("creators.creator")}
          </p>
          <h1 className="text-2xl font-black">{creator.name}</h1>
          {creator.bio ? (
            <p className="mt-1 text-sm text-gray">{creator.bio}</p>
          ) : null}
          {Array.isArray(sns) && sns.length > 0 ? (
            <ul className="mt-1.5 flex flex-wrap gap-3 text-[13px]">
              {sns.map((s) => (
                <li key={s.url}>
                  <a
                    href={s.url}
                    target="_blank"
                    rel="ugc nofollow noopener"
                    className="text-primary underline underline-offset-2"
                  >
                    {s.name}
                  </a>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </header>

      <h2 className="mt-6 text-lg font-bold">
        {t("creators.postsBy", { name: creator.name })}
      </h2>

      {items.length === 0 ? (
        <p className="py-20 text-center text-gray">{t("labels.noArticles")}</p>
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
