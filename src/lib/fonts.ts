import {
  Inter,
  Noto_Sans_KR,
  Noto_Sans_TC,
  Noto_Sans_SC,
  Noto_Sans_Thai,
} from "next/font/google";

/**
 * ロケール単位でフォントを出し分ける(全部を常時読み込まない)。
 * layout 側で fontForLocale(locale) の variable + className だけを適用する。
 */

export const inter = Inter({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});

const notoSansKR = Noto_Sans_KR({
  subsets: ["latin"],
  weight: ["400", "500", "700", "900"],
  variable: "--font-body",
  display: "swap",
});

const notoSansTC = Noto_Sans_TC({
  subsets: ["latin"],
  weight: ["400", "500", "700", "900"],
  variable: "--font-body",
  display: "swap",
});

const notoSansSC = Noto_Sans_SC({
  subsets: ["latin"],
  weight: ["400", "500", "700", "900"],
  variable: "--font-body",
  display: "swap",
});

const notoSansThai = Noto_Sans_Thai({
  subsets: ["thai", "latin"],
  weight: ["400", "500", "700"],
  variable: "--font-body",
  display: "swap",
});

export function fontForLocale(locale: string) {
  switch (locale) {
    case "ko":
      return notoSansKR;
    case "zh-Hant":
      return notoSansTC;
    case "zh-Hans":
      return notoSansSC;
    case "th":
      return notoSansThai;
    default:
      return inter;
  }
}

/** タイ語のみ行間1.95(声調記号が潰れるため)。他は既定1.8 */
export function lineHeightClassForLocale(locale: string): string {
  return locale === "th" ? "leading-[1.95]" : "leading-[1.8]";
}
