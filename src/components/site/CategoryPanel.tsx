import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { pickTranslation, type ArticleListItem } from "@/lib/data";
import { categoryName, type CategoryWithTranslations } from "@/lib/categories";
import { categoryAccent } from "@/lib/category-style";
import { localeMeta } from "@/lib/locale";
import { articlePath, formatTokyoShort } from "@/lib/site";

/**
 * 下段カテゴリーパネル(§18〜§21)。
 * 左上からはみ出す斜体見出しタブ+高密度3行リスト。区切りは1px破線。
 */
export async function CategoryPanel({
  category,
  articles,
  locale,
}: {
  category: CategoryWithTranslations;
  articles: ArticleListItem[];
  locale: string;
}) {
  const t = await getTranslations();
  const accent = categoryAccent(category.slug);
  const rows = articles.slice(0, 3);
  if (rows.length === 0) return null;

  return (
    <section
      aria-label={categoryName(category, locale)}
      className="relative rounded-[13px] border-2 border-ink bg-surface px-[12px] pb-[10px] lg:h-[243px]"
    >
      {/* 見出しタブ(左上からはみ出す斜体タブ) */}
      <div className="-mt-[14px] flex items-end justify-between">
        <Link
          href={`/category/${category.slug}`}
          className={`comic-tab -ml-[18px] flex h-[40px] items-center border-2 border-ink px-[18px] font-heading text-[24px] font-extrabold uppercase leading-none xl:text-[27px] ${accent.chip}`}
        >
          <span>{categoryName(category, locale)}</span>
        </Link>
        <Link
          href={`/category/${category.slug}`}
          className="pb-1 font-heading text-[11px] font-extrabold uppercase text-ink hover:text-primary"
        >
          {t("labels.viewAll")} <span aria-hidden="true">→</span>
        </Link>
      </div>

      {/* 記事行 */}
      <ul>
        {rows.map((article, i) => {
          const tr = pickTranslation(article);
          if (!tr) return null;
          return (
            <li
              key={article.id}
              className={`grid h-[59px] grid-cols-[110px_1fr] items-center gap-[10px] xl:grid-cols-[128px_1fr] ${
                i < rows.length - 1 ? "border-b border-dashed border-dash" : ""
              }`}
            >
              <div className="relative h-[48px] w-[110px] overflow-hidden rounded-[7px] border-2 border-ink bg-bg-sub xl:h-[54px] xl:w-[128px]">
                {article.heroImage ? (
                  <Image
                    src={article.heroImage.url}
                    alt=""
                    fill
                    sizes="128px"
                    className="object-cover"
                  />
                ) : (
                  <span
                    aria-hidden="true"
                    className="flex h-full w-full items-center justify-center font-display text-xl text-dash"
                  >
                    A
                  </span>
                )}
              </div>
              <div className="min-w-0">
                <Link
                  href={articlePath(article.category.slug, article.slug)}
                  className="font-heading text-[14.5px] font-extrabold leading-[1.12] text-ink line-clamp-2 hover:text-primary"
                >
                  {tr.title}
                </Link>
                <div className="mt-1 flex items-center gap-2">
                  <time
                    dateTime={(article.publishedAt ?? article.createdAt).toISOString()}
                    className="text-[11.5px] font-semibold text-gray"
                  >
                    {formatTokyoShort(
                      article.publishedAt ?? article.createdAt,
                      localeMeta(locale).intl
                    )}
                  </time>
                  <span
                    className={`flex h-[18px] items-center rounded-[4px] px-[7px] font-heading text-[10px] font-extrabold uppercase ${accent.chip}`}
                  >
                    {categoryName(article.category, locale)}
                  </span>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
