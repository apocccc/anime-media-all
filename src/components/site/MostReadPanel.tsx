import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { pickTranslation, type ArticleListItem } from "@/lib/data";
import { articlePath } from "@/lib/site";
import { Bang, Crown, StarSpark } from "./Doodads";

/**
 * Most Read パネル(§16)。コーラルのヘッダー+番号付きランキング5行。
 * 区切りは1px破線、右下に左端ギザギザの黒ステッカーボタン。影なし。
 */
export async function MostReadPanel({
  articles,
  locale,
}: {
  articles: ArticleListItem[];
  locale: string;
}) {
  void locale;
  const t = await getTranslations();
  const rows = articles.slice(0, 5);

  return (
    <section
      aria-label={t("labels.ranking")}
      className="flex flex-col overflow-hidden rounded-[14px] border-2 border-ink bg-surface lg:h-[438px]"
    >
      {/* ヘッダー */}
      <div className="flex h-[51px] shrink-0 items-center gap-2.5 bg-primary px-4">
        <Crown size={28} />
        <h2 className="font-heading text-[26px] font-extrabold uppercase leading-none text-white xl:text-[29px]">
          {t("labels.ranking")}
        </h2>
        <div className="ml-auto flex items-center gap-1.5">
          <Bang size={22} color="#fffdf9" />
          <StarSpark size={16} />
        </div>
      </div>

      {/* ランキング行 */}
      <ol className="flex-1 px-[12px]">
        {rows.map((article, i) => {
          const tr = pickTranslation(article);
          if (!tr) return null;
          return (
            <li
              key={article.id}
              className={`grid h-[68px] grid-cols-[44px_1fr_105px] items-center gap-[10px] ${
                i < rows.length - 1 ? "border-b border-dashed border-dash" : ""
              }`}
            >
              <span
                aria-hidden="true"
                className="flex h-[40px] w-[40px] items-center justify-center rounded-[7px] bg-primary font-heading text-[28px] font-extrabold text-white"
              >
                {i + 1}
              </span>
              <Link
                href={articlePath(article.category.slug, article.slug)}
                className="font-heading text-[15px] font-extrabold leading-[1.12] text-ink line-clamp-3 hover:text-primary"
              >
                {tr.title}
              </Link>
              {article.heroImage ? (
                <div className="relative h-[55px] w-[105px] overflow-hidden rounded-[6px] border-2 border-ink">
                  <Image
                    src={article.heroImage.url}
                    alt=""
                    fill
                    sizes="105px"
                    className="object-cover"
                  />
                </div>
              ) : (
                <span
                  aria-hidden="true"
                  className="flex h-[55px] w-[105px] items-center justify-center rounded-[6px] border-2 border-ink bg-teal font-display text-[18px] uppercase text-white"
                >
                  TOP {rows.length}
                </span>
              )}
            </li>
          );
        })}
      </ol>

      {/* 下部ボタン(黒ステッカー・左端ギザギザ) */}
      <div className="flex shrink-0 justify-end pb-2.5 pr-0">
        <Link
          href="/category/latest"
          className="jagged-left flex h-[35px] items-center gap-1.5 bg-ink pl-6 pr-5 font-heading text-[13px] font-extrabold uppercase text-white hover:bg-ink-soft"
        >
          {t("home.viewAllRankings")}
          <span aria-hidden="true">→</span>
        </Link>
      </div>
    </section>
  );
}
