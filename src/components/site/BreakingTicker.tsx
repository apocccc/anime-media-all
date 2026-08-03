import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { pickTranslation, type ArticleListItem } from "@/lib/data";
import { articlePath } from "@/lib/site";
import { Bang, StarSpark } from "./Doodads";

/**
 * Breaking / Live Now ティッカー(§12)。
 * 黄色地+2px罫線。左に黒いコミック吹き出し、右に黒ボタン。影なし。
 */
export async function BreakingTicker({
  article,
}: {
  article: ArticleListItem | null;
}) {
  if (!article) return null;
  const tr = pickTranslation(article);
  if (!tr) return null;
  const t = await getTranslations();
  const href = articlePath(article.category.slug, article.slug);

  return (
    <div className="relative mt-[14px] flex h-[51px] items-center gap-4 rounded-[14px] border-2 border-ink bg-yellow pl-2 pr-2">
      {/* 左: コミック吹き出しラベル */}
      <span className="burst-label flex h-[42px] w-[150px] shrink-0 items-center justify-center bg-ink font-display text-[19px] uppercase leading-none text-white xl:w-[172px] xl:text-[21px]">
        {t("ticker.live")}
      </span>

      {/* 装飾 */}
      <Bang size={22} className="hidden shrink-0 sm:block" />

      {/* 中央: 見出し */}
      <p className="min-w-0 flex-1 truncate text-[15px] font-bold text-ink xl:text-[16px]">
        <Link href={href} className="hover:underline underline-offset-2">
          {tr.title}
        </Link>
      </p>

      <StarSpark size={18} color="#fffdf9" className="hidden shrink-0 md:block" />

      {/* 右: READ NOW */}
      <Link
        href={href}
        className="flex h-[31px] shrink-0 items-center gap-1.5 rounded-[6px] bg-ink px-[22px] font-heading text-[13px] font-extrabold uppercase text-white hover:bg-ink-soft"
      >
        {t("ticker.readNow")}
        <span aria-hidden="true">→</span>
      </Link>
    </div>
  );
}
