"use client";

import { useLocale } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { LOCALE_META } from "@/lib/locale";

export function LanguageSwitcher() {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  return (
    <label className="relative">
      <span className="sr-only">Language</span>
      <select
        value={locale}
        onChange={(e) =>
          router.replace(pathname, {
            locale: e.target.value as (typeof routing.locales)[number],
          })
        }
        className="rounded-full border border-line bg-bg px-3 py-1.5 text-[13px] font-medium text-ink"
      >
        {routing.locales.map((l) => (
          <option key={l} value={l}>
            {LOCALE_META[l].label}
          </option>
        ))}
      </select>
    </label>
  );
}
