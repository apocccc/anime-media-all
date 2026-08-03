import {
  Anton,
  Barlow_Condensed,
  Inter,
  Noto_Sans_KR,
  Noto_Sans_TC,
  Noto_Sans_SC,
  Noto_Sans_Thai,
} from "next/font/google";

/*
 * フォント構成(デザイン仕様書 §4)
 * - ロゴ・大見出し: Anton
 * - セクション見出し: Barlow Condensed 700/800
 * - 本文・UI: Inter(欧文)+ ロケール別 Noto Sans(全部を常時読み込まない)
 * CJK・タイ語の見出しは各ロケールの本文フォントへフォールバックする。
 */

export const anton = Anton({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-anton",
  display: "swap",
});

export const barlowCondensed = Barlow_Condensed({
  weight: ["600", "700", "800"],
  subsets: ["latin"],
  variable: "--font-barlow",
  display: "swap",
});

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

/** 見出し・ロゴ用フォント変数(全ロケール共通で読み込む) */
export function displayFontVariables(): string {
  return `${anton.variable} ${barlowCondensed.variable}`;
}

/** タイ語のみ行間1.95(声調記号が潰れるため)。他は既定1.8 */
export function lineHeightClassForLocale(locale: string): string {
  return locale === "th" ? "leading-[1.95]" : "leading-[1.8]";
}
