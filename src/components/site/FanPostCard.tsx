import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { FanPostItem } from "@/lib/data-community";
import { fanPostBody, seriesTitle } from "@/lib/data-community";
import { EmbedPreview } from "@/components/site/EmbedRenderer";
import { VoteButton } from "@/components/site/VoteButton";
import { toDbLocale } from "@/lib/locale";

/** 投稿タイプ別の固定チップ配色(マット単色) */
const TYPE_CHIP: Record<string, string> = {
  illustration: "bg-teal text-white",
  cosplay: "bg-primary text-white",
  photo: "bg-yellow text-ink",
  text: "bg-purple text-white",
  embed: "bg-navy text-white",
};

/** 投稿タイプチップのクラス(一覧・詳細で共通) */
export function fanTypeChip(type: string): string {
  return `inline-flex h-[18px] items-center rounded-[4px] px-[7px] font-heading text-[10px] font-extrabold uppercase ${
    TYPE_CHIP[type] ?? "bg-ink text-white"
  }`;
}

/** ファン投稿の一覧カード */
export async function FanPostCard({
  post,
  locale,
  mediaUrl,
}: {
  post: FanPostItem;
  locale: string;
  mediaUrl?: string | null;
}) {
  const t = await getTranslations();
  const db = toDbLocale(locale);
  const { body } = fanPostBody(post, db);
  const isEmbed = post.type === "embed" && Boolean(post.embedUrl);
  const href = `/fans/${post.id}`;
  // 投稿者名: 埋め込みの元アカウント名(posterName)を優先、無ければ投稿者名
  const displayName = post.posterName ?? post.author.name;

  // メディア枠(サムネイル / 埋め込みプレビュー / テキストプレースホルダー)
  const media = mediaUrl ? (
    <div className="relative aspect-[4/3] overflow-hidden rounded-[8px] border-2 border-ink bg-bg-sub">
      <Image
        src={mediaUrl}
        alt=""
        fill
        sizes="(min-width: 1024px) 25vw, 50vw"
        className="object-cover"
      />
    </div>
  ) : isEmbed ? (
    // 埋め込みは実プレビュー(iframe)を表示。iframe はインタラクティブ要素のため
    // <a> の中に入れない(HTML的に不正)。この枠だけリンク外に置く
    <div className="relative aspect-[4/3] overflow-hidden rounded-[8px] border-2 border-ink bg-navy">
      <EmbedPreview url={post.embedUrl!} provider={post.embedProvider} />
    </div>
  ) : (
    <div className="flex aspect-[4/3] items-center justify-center overflow-hidden rounded-[8px] border-2 border-ink bg-bg-sub px-4">
      <p className="line-clamp-5 text-sm text-gray">{body}</p>
    </div>
  );

  // 詳細ページへ飛ぶ本文リンク(タイプチップ・作品名・本文)
  const linkedBody = (
    <>
      <div className="flex items-center gap-2">
        <span className={`shrink-0 ${fanTypeChip(post.type)}`}>
          {t(`fans.types.${post.type}`)}
        </span>
        <span className="truncate text-[11px] font-semibold text-gray">
          {seriesTitle(post.series, db)}
        </span>
      </div>
      {mediaUrl && body ? (
        <p className="mt-1.5 line-clamp-2 text-[13px] leading-snug text-ink group-hover:text-primary">
          {body}
        </p>
      ) : null}
    </>
  );

  return (
    <article className="group flex flex-col rounded-[13px] border-2 border-ink bg-surface p-[10px]">
      {/* メディア: 埋め込みはリンク外(iframeは<a>に入れられない)、通常は詳細リンク */}
      {isEmbed ? media : <Link href={href} className="block">{media}</Link>}
      <Link href={href} className="block pt-2">
        {linkedBody}
      </Link>
      {/* 投稿者名 + 投票ボタン(リンク外=この一覧上で投票できる) */}
      <div className="mt-2 flex items-center justify-between gap-2 border-t border-dashed border-dash pt-1.5">
        <span className="min-w-0 truncate text-[11.5px] text-gray">
          {t("fans.postedBy")}{" "}
          <span className="font-semibold text-ink">{displayName}</span>
        </span>
        <VoteButton
          postId={post.id}
          initialVotes={post.voteCount}
          size="sm"
          labels={{ vote: t("fans.vote"), voted: t("fans.voted") }}
        />
      </div>
    </article>
  );
}
