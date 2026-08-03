import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { categoryName, type CategoryWithTranslations } from "@/lib/categories";
import { localeMeta } from "@/lib/locale";
import { formatTokyo, SITE_NAME, TOKYO_TZ } from "@/lib/site";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { SearchForm } from "./SearchForm";

export async function SiteHeader({
  categories,
  locale,
}: {
  categories: CategoryWithTranslations[];
  locale: string;
}) {
  const t = await getTranslations();
  const now = new Date();
  const intl = localeMeta(locale).intl;
  const weekday = new Intl.DateTimeFormat(intl, {
    weekday: "short",
    timeZone: TOKYO_TZ,
  }).format(now);

  return (
    <header className="border-b border-line bg-bg">
      {/* 上段: 日付+ユーティリティ */}
      <div className="border-b border-line bg-bg-sub">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-1 text-[11.5px] text-gray">
          <p>
            {formatTokyo(now, intl, {
              year: "numeric",
              month: "2-digit",
              day: "2-digit",
            })}
            ({weekday})
          </p>
          <nav className="flex items-center gap-3">
            <Link href="/about" className="hover:text-primary">
              {t("footer.about")}
            </Link>
            <Link href="/contact" className="hover:text-primary">
              {t("footer.contact")}
            </Link>
            <a href={`/rss/${locale}.xml`} className="hover:text-primary">
              RSS
            </a>
          </nav>
        </div>
      </div>

      {/* 中段: ロゴ+検索+言語 */}
      <div className="mx-auto max-w-6xl px-4">
        <div className="flex items-center justify-between gap-4 py-2.5">
          <Link href="/" className="flex items-baseline gap-2 shrink-0">
            <span className="text-[26px] font-black tracking-tight text-primary leading-none">
              {SITE_NAME}
            </span>
          </Link>
          <div className="flex items-center gap-3">
            <SearchForm
              placeholder={t("search.placeholder")}
              buttonLabel={t("search.button")}
            />
            <LanguageSwitcher />
          </div>
        </div>
      </div>

      {/* 下段: カテゴリーナビ(sticky) */}
      <nav
        aria-label={t("nav.allCategories")}
        className="sticky top-0 z-40 border-t-2 border-primary bg-bg shadow-[0_1px_0_var(--color-line)]"
      >
        <div className="mx-auto max-w-6xl px-4">
          <ul className="-mx-1 flex items-center overflow-x-auto text-[14px] font-bold whitespace-nowrap">
            <li>
              <Link
                href="/"
                className="block border-b-2 border-transparent px-2.5 py-2 hover:border-primary hover:text-primary transition-colors"
              >
                {t("nav.home")}
              </Link>
            </li>
            {categories
              .filter((c) => c.slug !== "latest" && c.slug !== "fan")
              .map((c) => (
                <li key={c.id}>
                  <Link
                    href={`/category/${c.slug}`}
                    className="block border-b-2 border-transparent px-2.5 py-2 hover:border-primary hover:text-primary transition-colors"
                  >
                    {categoryName(c, locale)}
                  </Link>
                </li>
              ))}
            <li>
              <Link
                href="/fans"
                className="block border-b-2 border-transparent px-2.5 py-2 hover:border-primary hover:text-primary transition-colors"
              >
                {t("nav.fans")}
              </Link>
            </li>
            <li>
              <Link
                href="/prize"
                className="block border-b-2 border-transparent px-2.5 py-2 hover:border-primary hover:text-primary transition-colors"
              >
                {t("nav.prize")}
              </Link>
            </li>
          </ul>
        </div>
      </nav>
    </header>
  );
}
