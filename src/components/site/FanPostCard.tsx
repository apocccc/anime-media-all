import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { FanPostItem } from "@/lib/data-community";
import { fanPostBody, seriesTitle } from "@/lib/data-community";
import { toDbLocale } from "@/lib/locale";

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
    <article className="group overflow-hidden rounded-lg border border-line bg-bg">
      <Link href={`/fans/${post.id}`} className="block">
        {mediaUrl ? (
          <div className="relative aspect-[4/3] bg-bg-sub">
            <Image
              src={mediaUrl}
              alt=""
              fill
              sizes="(min-width: 1024px) 25vw, 50vw"
              className="object-cover"
            />
          </div>
        ) : (
          <div className="flex aspect-[4/3] items-center justify-center bg-bg-sub px-4">
            <p className="line-clamp-5 text-sm text-gray">{body}</p>
          </div>
        )}
        <div className="p-3">
          <div className="flex items-center gap-2 text-[11px] text-gray">
            <span className="rounded-sm bg-primary-light px-1.5 py-0.5 font-bold text-primary-dark">
              {t(`fans.types.${post.type}`)}
            </span>
            <span className="truncate">{seriesTitle(post.series, db)}</span>
          </div>
          {mediaUrl && body ? (
            <p className="mt-1.5 line-clamp-2 text-[13px] leading-snug">{body}</p>
          ) : null}
          <div className="mt-1.5 flex items-center justify-between text-[11.5px] text-gray">
            <span className="truncate">
              {t("fans.postedBy")}{" "}
              <span className="font-medium text-ink">{post.author.name}</span>
            </span>
            <span>{t("fans.votes", { count: post.voteCount })}</span>
          </div>
        </div>
      </Link>
    </article>
  );
}
