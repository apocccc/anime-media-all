"use client";

import { useLocale } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { LOCALE_META } from "@/lib/locale";

/** 言語セレクター(§11)。地球アイコン+コード表示。2px罫線・影なし */
export function LanguageSwitcher() {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  return (
    <label className="relative flex h-[46px] w-[102px] shrink-0 items-center gap-1.5 rounded-[11px] border-2 border-ink bg-surface pl-2.5 pr-1">
      <span className="sr-only">Language</span>
      <svg
        aria-hidden="true"
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        className="shrink-0 text-ink"
      >
        <circle cx="12" cy="12" r="9" />
        <path d="M3 12 h18 M12 3 c3 3 3 15 0 18 c-3 -3 -3 -15 0 -18" />
      </svg>
      <select
        value={locale}
        onChange={(e) =>
          router.replace(pathname, {
            locale: e.target.value as (typeof routing.locales)[number],
          })
        }
        className="w-full appearance-none bg-transparent pr-4 font-heading text-[15px] font-bold uppercase text-ink outline-none"
      >
        {routing.locales.map((l) => (
          <option key={l} value={l} title={LOCALE_META[l].label}>
            {LOCALE_META[l].short}
          </option>
        ))}
      </select>
      <svg
        aria-hidden="true"
        width="12"
        height="12"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        className="pointer-events-none absolute right-2 text-ink"
      >
        <path d="m6 9 6 6 6-6" />
      </svg>
    </label>
  );
}
