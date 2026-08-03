import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { SITE_NAME } from "@/lib/site";
import { Heart, StarSpark } from "./Doodads";

/**
 * フッター(§23)。濃紺の1段バー+ステッカー装飾。
 * ソーシャル / ニュースレター(表示のみ・機能は将来スコープ §13)/ ステッカー。
 * 下段にサイトリンクの細い行を追加。影・グラデーション不使用。
 */

const SOCIALS: { name: string; icon: React.ReactNode; accent?: boolean }[] = [
  {
    name: "X",
    icon: (
      <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
        <path d="M3 2 h5 l5 7 6 -7 h3 l-7.6 9 L21 22 h-5 l-5.4 -7.4 L4 22 H1 l8.4 -9.8 Z" />
      </svg>
    ),
  },
  {
    name: "Instagram",
    icon: (
      <svg aria-hidden="true" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
        <rect x="3" y="3" width="18" height="18" rx="5" />
        <circle cx="12" cy="12" r="4.2" />
        <circle cx="17.2" cy="6.8" r="1.3" fill="currentColor" stroke="none" />
      </svg>
    ),
  },
  {
    name: "YouTube",
    accent: true,
    icon: (
      <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
        <path d="M22 12 c0 -3 -.3 -4.6 -.9 -5.4 C20.4 5.7 17 5.5 12 5.5 s-8.4 .2 -9.1 1.1 C2.3 7.4 2 9 2 12 s.3 4.6 .9 5.4 c.7 .9 4.1 1.1 9.1 1.1 s8.4 -.2 9.1 -1.1 c.6 -.8 .9 -2.4 .9 -5.4 Z M10 8.8 l6 3.2 -6 3.2 Z" />
      </svg>
    ),
  },
  {
    name: "TikTok",
    icon: (
      <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
        <path d="M14 2 h3 c.3 2.3 1.7 3.7 4 4 v3.2 c-1.6 0 -3 -.5 -4.2 -1.4 V15 a6.5 6.5 0 1 1 -6.5 -6.5 v3.4 a3.2 3.2 0 1 0 3.7 3.1 Z" />
      </svg>
    ),
  },
  {
    name: "Discord",
    icon: (
      <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
        <path d="M8.5 4.5 C10.8 4 13.2 4 15.5 4.5 l.6 1.2 c2 .4 3.6 1.2 4.4 2.3 c1.2 3.3 1.6 6.6 1.2 9.9 c-1.5 1.2 -3.2 2 -5.2 2.4 l-1 -1.9 c.6 -.2 1.2 -.5 1.7 -.8 l-.4 -.4 c-3 1.3 -6.6 1.3 -9.6 0 l-.4 .4 c.5 .3 1.1 .6 1.7 .8 l-1 1.9 c-2 -.4 -3.7 -1.2 -5.2 -2.4 c-.4 -3.3 0 -6.6 1.2 -9.9 c.8 -1.1 2.4 -1.9 4.4 -2.3 Z M9.7 10.6 c-.9 0 -1.6 .8 -1.6 1.9 s.7 1.9 1.6 1.9 s1.6 -.8 1.6 -1.9 s-.7 -1.9 -1.6 -1.9 Z m4.6 0 c-.9 0 -1.6 .8 -1.6 1.9 s.7 1.9 1.6 1.9 s1.6 -.8 1.6 -1.9 s-.7 -1.9 -1.6 -1.9 Z" />
      </svg>
    ),
  },
];

export async function SiteFooter({ locale }: { locale: string }) {
  const t = await getTranslations();
  const year = new Date().getFullYear();

  return (
    <footer className="mx-auto mt-[10px] w-[calc(100%-24px)] max-w-[1600px] rounded-t-[13px] border-2 border-b-0 border-ink bg-navy text-white xl:w-[calc(100%-72px)]">
      {/* 上段(§23) */}
      <div className="flex min-h-[76px] flex-wrap items-center gap-x-7 gap-y-4 px-6 py-4">
        {/* FOLLOW US + ソーシャル */}
        <div className="flex items-center gap-4">
          <p className="font-heading text-[20px] font-extrabold uppercase leading-none">
            {t("footer.followUs")}
          </p>
          <ul className="flex items-center gap-[10px]">
            {SOCIALS.map((s) => (
              <li key={s.name}>
                <a
                  href="#"
                  aria-label={s.name}
                  className={`flex h-[40px] w-[40px] items-center justify-center rounded-full hover:bg-yellow hover:text-ink ${
                    s.accent ? "bg-primary text-white" : "bg-surface text-ink"
                  }`}
                >
                  {s.icon}
                </a>
              </li>
            ))}
          </ul>
        </div>

        {/* ニュースレター(表示のみ。§13 将来スコープ) */}
        <div className="ml-auto flex flex-wrap items-center gap-4">
          <div>
            <p className="font-heading text-[18px] font-extrabold uppercase leading-none">
              {t("footer.newsletter")}
            </p>
            <p className="mt-1 max-w-[210px] text-[12px] font-medium leading-snug text-white/85">
              {t("footer.newsletterNote")}
            </p>
          </div>
          <form className="flex items-center gap-2" aria-label={t("footer.newsletter")}>
            <input
              type="email"
              placeholder={t("footer.emailPlaceholder")}
              aria-label={t("footer.emailPlaceholder")}
              className="h-[40px] w-[200px] rounded-[5px] bg-surface px-4 text-[13px] text-ink outline-none placeholder:text-[#a29fa9] xl:w-[270px]"
            />
            <button
              type="submit"
              className="h-[40px] w-[108px] rounded-[5px] bg-primary font-heading text-[14px] font-extrabold uppercase text-white hover:bg-primary-dark"
            >
              {t("footer.subscribe")}
            </button>
          </form>

          {/* ステッカー装飾 */}
          <div className="hidden items-center gap-2.5 xl:flex">
            <StarSpark size={24} />
            <Heart size={22} />
            <span
              aria-hidden="true"
              className="flex h-[26px] w-[26px] items-center justify-center rounded-full border-2 border-ink bg-teal text-[13px] leading-none"
            >
              ☻
            </span>
            <span className="rotate-2 rounded-full border-2 border-ink bg-soft-pink px-3 py-1 font-heading text-[12px] font-extrabold uppercase text-ink">
              {t("footer.stayOtaku")}
            </span>
          </div>
        </div>
      </div>

      {/* 下段: サイトリンク */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1 border-t border-dashed border-white/30 px-6 py-2.5 text-[12px] text-white/70">
        <Link href="/about" className="hover:text-white">
          {t("footer.about")}
        </Link>
        <Link href="/contact" className="hover:text-white">
          {t("footer.contact")}
        </Link>
        <Link href="/privacy" className="hover:text-white">
          {t("footer.privacy")}
        </Link>
        <Link href="/fans" className="hover:text-white">
          {t("footer.fans")}
        </Link>
        <Link href="/prize" className="hover:text-white">
          {t("footer.prize")}
        </Link>
        {/* ロケール外ルートへの遷移のため <a> を使用 */}
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a href="/partner" className="hover:text-white">
          {t("footer.forPartners")}
        </a>
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a href={`/rss/${locale}.xml`} className="hover:text-white">
          {t("footer.rss")}
        </a>
        <span className="ml-auto">
          {t("footer.copyright", { year, name: SITE_NAME })}
        </span>
      </div>
    </footer>
  );
}
