import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { pickTranslation, type ArticleListItem } from "@/lib/data";
import { categoryName } from "@/lib/categories";
import { categoryAccent } from "@/lib/category-style";
import { localeMeta } from "@/lib/locale";
import { articlePath, formatTokyoShort } from "@/lib/site";

/** 日時+カテゴリー+見出しの高密度テキストリスト(区切りは1px破線) */
export async function HeadlineList({
  articles,
  locale,
  showCategory = true,
}: {
  articles: ArticleListItem[];
  locale: string;
  showCategory?: boolean;
}) {
  const t = await getTranslations();
  return (
    <ul>
      {articles.map((a, i) => {
        const tr = pickTranslation(a);
        if (!tr) return null;
        const accent = categoryAccent(a.category.slug);
        return (
          <li
            key={a.id}
            className={
              i < articles.length - 1
                ? "border-b border-dashed border-dash"
                : ""
            }
          >
            <Link
              href={articlePath(a.category.slug, a.slug)}
              className="group flex items-baseline gap-2.5 py-2"
            >
              <time
                dateTime={(a.publishedAt ?? a.createdAt).toISOString()}
                className="shrink-0 font-mono text-[11.5px] font-semibold text-gray tabular-nums"
              >
                {formatTokyoShort(a.publishedAt ?? a.createdAt, localeMeta(locale).intl)}
              </time>
              {a.isBreaking ? (
                <span className="shrink-0 rounded-[4px] bg-breaking px-1.5 py-px font-heading text-[10px] font-extrabold uppercase text-white">
                  {t("labels.breaking")}
                </span>
              ) : null}
              {showCategory ? (
                <span
                  className={`shrink-0 rounded-[4px] px-[7px] py-px font-heading text-[10px] font-extrabold uppercase ${accent.chip}`}
                >
                  {categoryName(a.category, locale)}
                </span>
              ) : null}
              <span className="min-w-0 font-heading text-[15px] font-bold leading-snug text-ink line-clamp-2 group-hover:text-primary group-hover:underline underline-offset-2">
                {tr.title}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
