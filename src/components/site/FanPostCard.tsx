import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { FanPostItem } from "@/lib/data-community";
import { fanPostBody, seriesTitle } from "@/lib/data-community";
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

  return (
    <article className="group rounded-[13px] border-2 border-ink bg-surface p-[10px]">
      <Link href={`/fans/${post.id}`} className="block">
        {mediaUrl ? (
          <div className="relative aspect-[4/3] overflow-hidden rounded-[8px] border-2 border-ink bg-bg-sub">
            <Image
              src={mediaUrl}
              alt=""
              fill
              sizes="(min-width: 1024px) 25vw, 50vw"
              className="object-cover"
            />
          </div>
        ) : (
          <div className="flex aspect-[4/3] items-center justify-center overflow-hidden rounded-[8px] border-2 border-ink bg-bg-sub px-4">
            <p className="line-clamp-5 text-sm text-gray">{body}</p>
          </div>
        )}
        <div className="pt-2">
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
          <div className="mt-2 flex items-center justify-between gap-2 border-t border-dashed border-dash pt-1.5 text-[11.5px] text-gray">
            <span className="truncate">
              {t("fans.postedBy")}{" "}
              <span className="font-semibold text-ink">{post.author.name}</span>
            </span>
            <span className="shrink-0 font-heading text-[12px] font-extrabold uppercase text-ink">
              {t("fans.votes", { count: post.voteCount })}
            </span>
          </div>
        </div>
      </Link>
    </article>
  );
}
