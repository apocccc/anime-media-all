/**
 * カテゴリー別のアクセント配色(マット単色)。
 * タグチップ・パネル見出しタブで共通利用する。
 * 黄色系のみ文字を ink にしてコントラストを確保する。
 */

export type CategoryAccent = {
  /** タグチップ・見出しタブの背景+文字色クラス */
  chip: string;
  /** 単色HEX(SVG装飾用) */
  hex: string;
};

const ACCENTS: Record<string, CategoryAccent> = {
  news: { chip: "bg-primary text-white", hex: "#eb4e5d" },
  anime: { chip: "bg-teal text-white", hex: "#139a9f" },
  manga: { chip: "bg-purple text-white", hex: "#89649b" },
  event: { chip: "bg-yellow text-ink", hex: "#fad157" },
  "press-release": { chip: "bg-navy text-white", hex: "#141d28" },
  fan: { chip: "bg-coral-light text-white", hex: "#f17285" },
  latest: { chip: "bg-ink text-white", hex: "#141d28" },
};

export function categoryAccent(slug: string): CategoryAccent {
  return ACCENTS[slug] ?? { chip: "bg-ink text-white", hex: "#141d28" };
}
