import Image from "next/image";
import { Link } from "@/i18n/navigation";
import { pickTranslation, type ArticleListItem } from "@/lib/data";
import { categoryName } from "@/lib/categories";
import { categoryAccent } from "@/lib/category-style";
import { localeMeta } from "@/lib/locale";
import { articlePath, formatTokyoShort } from "@/lib/site";

/**
 * 上段中央のサイドカード(§15)。
 * サムネイル+カテゴリータグ+見出し+時刻+ブックマークアイコン。
 */
export function SideStoryCard({
  article,
  locale,
}: {
  article: ArticleListItem;
  locale: string;
}) {
  const tr = pickTranslation(article);
  if (!tr) return null;
  const accent = categoryAccent(article.category.slug);

  return (
    <article className="overflow-hidden rounded-[13px] border-2 border-ink bg-surface">
      <Link href={articlePath(article.category.slug, article.slug)} className="group block">
        <div className="relative mx-[10px] mt-[10px] h-[110px] overflow-hidden rounded-[8px] border-2 border-ink bg-bg-sub">
          {article.heroImage ? (
            <Image
              src={article.heroImage.url}
              alt={article.heroImage.alt}
              fill
              sizes="278px"
              className="object-cover"
            />
          ) : (
            <span
              aria-hidden="true"
              className="flex h-full w-full items-center justify-center font-display text-3xl text-dash"
            >
              A
            </span>
          )}
          <span
            className={`absolute left-0 top-0 flex h-[24px] items-center px-[9px] font-heading text-[14px] font-extrabold uppercase ${accent.chip}`}
          >
            {categoryName(article.category, locale)}
          </span>
        </div>
        <div className="px-[12px] pb-[10px] pt-[8px]">
          <h3 className="font-heading text-[17px] font-extrabold leading-[1.12] text-ink line-clamp-3 group-hover:text-primary">
            {tr.title}
          </h3>
          <div className="mt-1.5 flex items-center justify-between">
            <time
              dateTime={(article.publishedAt ?? article.createdAt).toISOString()}
              className="flex items-center gap-1 text-[12px] font-semibold text-gray"
            >
              <svg
                aria-hidden="true"
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
              >
                <circle cx="12" cy="12" r="9" />
                <path d="M12 7 v5 l3 3" />
              </svg>
              {formatTokyoShort(
                article.publishedAt ?? article.createdAt,
                localeMeta(locale).intl
              )}
            </time>
            <svg
              aria-hidden="true"
              width="14"
              height="16"
              viewBox="0 0 14 16"
              fill="none"
              stroke="#141d28"
              strokeWidth="2"
              strokeLinejoin="round"
            >
              <path d="M2 1 h10 v14 l-5 -4 -5 4 Z" />
            </svg>
          </div>
        </div>
      </Link>
    </article>
  );
}
