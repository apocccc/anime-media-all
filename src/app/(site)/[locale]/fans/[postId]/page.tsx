import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import {
  fanPostBody,
  getFanPost,
  getMediaByIds,
  incrementFanPostView,
  seriesTitle,
} from "@/lib/data-community";
import { auth } from "@/lib/auth";
import { Breadcrumbs } from "@/components/site/Breadcrumbs";
import { EmbedRenderer } from "@/components/site/EmbedRenderer";
import { fanTypeChip } from "@/components/site/FanPostCard";
import { VoteButton } from "@/components/site/VoteButton";
import { fromDbLocale, localeMeta, toDbLocale } from "@/lib/locale";
import { formatTokyo, localizedUrl } from "@/lib/site";

export const dynamic = "force-dynamic";

/** 薄いコンテンツ対策: 本文がこの文字数未満の投稿ページは noindex, follow */
const INDEX_MIN_CHARS = 80;

type Params = { locale: string; postId: string };

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { locale, postId } = await params;
  const post = await getFanPost(postId);
  if (!post) return {};
  const db = toDbLocale(locale);
  const { body } = fanPostBody(post, db);
  const thin = post.bodyOriginal.length < INDEX_MIN_CHARS;
  return {
    title: `${seriesTitle(post.series, db)} — ${post.author.name}`,
    description: body.slice(0, 160),
    robots: thin ? { index: false, follow: true } : undefined,
    alternates: { canonical: localizedUrl(locale, `/fans/${postId}`) },
  };
}

export default async function FanPostPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { locale, postId } = await params;
  setRequestLocale(locale);
  const db = toDbLocale(locale);

  const [post, session] = await Promise.all([getFanPost(postId), auth()]);
  if (!post) notFound();
  incrementFanPostView(post.id);

  const t = await getTranslations();
  const media = await getMediaByIds(post.mediaIds);
  const { body, isTranslation } = fanPostBody(post, db);
  const showOriginalToggle =
    isTranslation && post.originalLocale !== db && post.bodyOriginal.trim();

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <Breadcrumbs
        crumbs={[
          { name: t("nav.home"), path: "/" },
          { name: t("fans.title"), path: "/fans" },
          { name: t("fans.postDetail"), path: `/fans/${post.id}` },
        ]}
      />

      <article className="mt-4">
        <header className="flex flex-wrap items-center gap-2">
          <span className={fanTypeChip(post.type)}>
            {t(`fans.types.${post.type}`)}
          </span>
          <Link
            href={`/anime/${post.series.slug}`}
            className="font-heading text-[15px] font-extrabold uppercase text-ink hover:text-primary"
          >
            {seriesTitle(post.series, db)}
          </Link>
        </header>

        <div className="mt-3 flex items-center justify-between gap-3 border-y border-dashed border-dash py-2.5 text-[13px] text-gray">
          <span>
            {t("fans.postedBy")}{" "}
            {post.author.handle ? (
              <Link
                href={`/creators/${post.author.handle}`}
                className="font-medium text-ink hover:text-primary"
              >
                {post.author.name}
              </Link>
            ) : (
              <span className="font-medium text-ink">{post.author.name}</span>
            )}
          </span>
          {post.publishedAt ? (
            <time dateTime={post.publishedAt.toISOString()}>
              {formatTokyo(post.publishedAt, localeMeta(locale).intl)}
            </time>
          ) : null}
        </div>

        {media.length > 0 ? (
          <div className="mt-5 flex flex-col gap-4">
            {media.map((m) => (
              <figure
                key={m.id}
                className="overflow-hidden rounded-[13px] border-2 border-ink"
              >
                <Image
                  src={m.url}
                  alt={m.alt}
                  width={m.width}
                  height={m.height}
                  className="h-auto w-full"
                />
              </figure>
            ))}
          </div>
        ) : null}

        {post.embedUrl ? (
          <EmbedRenderer
            url={post.embedUrl}
            provider={post.embedProvider}
            viewOnLabel={t("fans.viewOriginalPost")}
          />
        ) : null}

        {body ? (
          <div className="mt-5">
            {isTranslation ? (
              <p className="mb-1 text-[11px] text-gray">
                {t("fans.translation")} — {t("fans.aiTranslationNote")}
              </p>
            ) : null}
            <p className="whitespace-pre-wrap text-[15px] leading-relaxed">
              {body}
            </p>
          </div>
        ) : null}

        {/* 原文は常に併記(トグル)。翻訳は原文を置き換えない(§8.3) */}
        {showOriginalToggle ? (
          <details className="mt-4 rounded-[8px] border-2 border-ink bg-bg-sub px-4 py-2.5">
            <summary className="cursor-pointer font-heading text-sm font-extrabold uppercase text-ink hover:text-primary">
              {t("fans.showOriginal")} ({fromDbLocale(post.originalLocale)})
            </summary>
            <p className="mt-2 whitespace-pre-wrap text-[14px] leading-relaxed text-ink">
              {post.bodyOriginal}
            </p>
          </details>
        ) : null}

        <footer className="mt-6 flex items-center justify-between border-t border-dashed border-dash pt-4">
          <VoteButton
            postId={post.id}
            initialVotes={post.voteCount}
            signedIn={Boolean(session?.user)}
            labels={{
              vote: t("fans.vote"),
              voted: t("fans.voted"),
              loginToVote: t("fans.loginToVote"),
            }}
          />
          <Link
            href="/contact"
            className="text-[12.5px] text-gray underline underline-offset-2 hover:text-primary"
          >
            {t("fans.report")}
          </Link>
        </footer>
      </article>
    </div>
  );
}
