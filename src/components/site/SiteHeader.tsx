import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { categoryName, type CategoryWithTranslations } from "@/lib/categories";
import { SITE_NAME } from "@/lib/site";
import { StarSpark } from "./Doodads";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { SearchForm } from "./SearchForm";

/**
 * ヘッダー(デザイン仕様書 §6〜§11)。
 * 高さ88px・下罫線2px。ロゴ / ナビ / 検索 / 言語 / マスコットの1段構成。
 * 影・グラデーション不使用。
 */
export async function SiteHeader({
  categories,
  locale,
}: {
  categories: CategoryWithTranslations[];
  locale: string;
}) {
  const t = await getTranslations();
  const [logoMain, ...logoRest] = SITE_NAME.split(" ");
  const logoSub = logoRest.join(" ") || "MEDIA";

  return (
    <header className="border-b-2 border-ink bg-surface">
      <div className="mx-auto flex h-[88px] max-w-[1632px] items-center gap-3 px-3 xl:px-5">
        {/* TODO: 正式なロゴ素材に差し替える。占有サイズと位置は変更しないこと。 */}
        <Link
          href="/"
          className="relative block w-[190px] shrink-0 pl-4 xl:w-[240px]"
        >
          <StarSpark size={16} className="absolute -top-1 left-0" />
          <StarSpark
            size={12}
            color="#139a9f"
            className="absolute bottom-1 right-2"
          />
          <span
            className="block font-display text-[42px] uppercase leading-[0.82] tracking-[-1px] text-primary [-webkit-text-stroke:2px_#141d28] [transform:skewX(-7deg)_rotate(-2deg)] xl:text-[54px]"
          >
            {logoMain}
          </span>
          <span className="mt-1 block pl-1 font-heading text-[12px] font-bold uppercase tracking-[5px] text-ink">
            ★ {logoSub}
          </span>
        </Link>

        {/* ナビゲーション(§9)。HOMEのみコーラルのピル */}
        <nav
          aria-label={t("nav.allCategories")}
          className="min-w-0 flex-1 overflow-x-auto"
        >
          <ul className="flex items-center gap-1 whitespace-nowrap font-heading text-[15px] font-bold uppercase xl:gap-3">
            <li>
              <Link
                href="/"
                className="flex h-[50px] w-[62px] flex-col items-center justify-center gap-0.5 rounded-[7px] bg-primary text-[12px] leading-none text-white hover:bg-primary-dark"
              >
                <svg
                  aria-hidden="true"
                  width="16"
                  height="14"
                  viewBox="0 0 16 14"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinejoin="round"
                >
                  <path d="M1 7 L8 1 L15 7 M3 6 V13 H13 V6" />
                </svg>
                {t("nav.home")}
              </Link>
            </li>
            {categories
              .filter((c) => c.slug !== "latest" && c.slug !== "fan")
              .map((c) => (
                <li key={c.id}>
                  <Link
                    href={`/category/${c.slug}`}
                    className="block px-1.5 py-2 text-ink hover:text-primary xl:px-2"
                  >
                    {categoryName(c, locale)}
                  </Link>
                </li>
              ))}
            <li>
              <Link
                href="/fans"
                className="block px-1.5 py-2 text-ink hover:text-primary xl:px-2"
              >
                {t("nav.fans")}
              </Link>
            </li>
            <li>
              <Link
                href="/prize"
                className="block px-1.5 py-2 text-ink hover:text-primary xl:px-2"
              >
                {t("nav.prize")}
              </Link>
            </li>
          </ul>
        </nav>

        <SearchForm
          placeholder={t("search.placeholder")}
          buttonLabel={t("search.button")}
        />
        <LanguageSwitcher />

        {/* TODO: 正式な右上マスコット素材に差し替える。82 × 78 pxの表示領域は維持すること。 */}
        <div className="hidden h-[78px] w-[82px] shrink-0 lg:block">
          <Image
            src="/assets/temp/mascot-placeholder.svg"
            alt=""
            width={82}
            height={78}
            className="h-full w-full object-contain"
          />
        </div>
      </div>
    </header>
  );
}
