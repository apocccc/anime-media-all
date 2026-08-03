import { createHash } from "crypto";
import type { JSONContent } from "@tiptap/core";

/**
 * 翻訳パイプライン用のブロック分割・ハッシュ管理。
 * Tiptap doc のトップレベルノードを1ブロックとし、テキストノードのみを
 * 翻訳対象にする。画像・埋め込み・リンク先URLは不変で通す。
 */

export function blockHash(text: string): string {
  return createHash("sha256").update(text).digest("hex").slice(0, 16);
}

/** ブロック内の翻訳対象テキストノード。id は "b{block}_t{n}" */
export type TranslatableText = {
  id: string;
  text: string;
};

export type Block = {
  index: number;
  node: JSONContent;
  /** ブロック内の全テキスト連結(ハッシュ対象) */
  text: string;
  hash: string;
  /** 翻訳対象のテキストノード(画像等は含まれない) */
  texts: TranslatableText[];
};

/** [IMAGE_n] マーカー・URLのみの文字列は翻訳対象にしない */
function isNonTranslatable(text: string): boolean {
  const t = text.trim();
  if (!t) return true;
  if (/^\[IMAGE_\d+\]$/.test(t)) return true;
  if (/^https?:\/\/\S+$/.test(t)) return true;
  return false;
}

function collectTexts(
  node: JSONContent,
  blockIndex: number,
  out: TranslatableText[],
  counter: { n: number }
): void {
  if (node.type === "text" && typeof node.text === "string") {
    if (!isNonTranslatable(node.text)) {
      out.push({ id: `b${blockIndex}_t${counter.n}`, text: node.text });
    }
    counter.n++;
    return;
  }
  for (const child of node.content ?? []) {
    collectTexts(child, blockIndex, out, counter);
  }
}

export function splitBlocks(doc: JSONContent): Block[] {
  return (doc.content ?? []).map((node, index) => {
    const texts: TranslatableText[] = [];
    collectTexts(node, index, texts, { n: 0 });
    const text = allTextOf(node);
    return { index, node, text, hash: blockHash(text), texts };
  });
}

function allTextOf(node: JSONContent): string {
  if (node.type === "text") return node.text ?? "";
  return (node.content ?? []).map(allTextOf).join("");
}

/** ブロックハッシュ一覧(sourceHash カラムに JSON 文字列で保存) */
export function docHashes(doc: JSONContent): string[] {
  return splitBlocks(doc).map((b) => b.hash);
}

export function serializeHashes(hashes: string[]): string {
  return JSON.stringify(hashes);
}

export function parseHashes(raw: string | null): string[] | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * 翻訳結果(id→訳文)を元の doc 構造に書き戻す。
 * 対象外ノード(画像・マーカー等)はそのまま保持される。
 */
export function applyTranslations(
  doc: JSONContent,
  translations: Map<string, string>
): JSONContent {
  const applyToNode = (
    node: JSONContent,
    blockIndex: number,
    counter: { n: number }
  ): JSONContent => {
    if (node.type === "text" && typeof node.text === "string") {
      const id = `b${blockIndex}_t${counter.n}`;
      counter.n++;
      const translated = translations.get(id);
      return translated !== undefined ? { ...node, text: translated } : node;
    }
    if (node.content) {
      return {
        ...node,
        content: node.content.map((c) => applyToNode(c, blockIndex, counter)),
      };
    }
    return node;
  };

  return {
    ...doc,
    content: (doc.content ?? []).map((node, index) =>
      applyToNode(node, index, { n: 0 })
    ),
  };
}

/**
 * 変更ブロックの差分計算: 前回の sourceHash と比較し、
 * ブロック数が同じ場合のみ変更ブロックの index 集合を返す。
 * 構造が変わった(数が違う)場合は null = 全ブロック再翻訳。
 */
export function changedBlockIndexes(
  currentHashes: string[],
  previousHashes: string[] | null
): Set<number> | null {
  if (!previousHashes || previousHashes.length !== currentHashes.length) {
    return null;
  }
  const changed = new Set<number>();
  currentHashes.forEach((h, i) => {
    if (previousHashes[i] !== h) changed.add(i);
  });
  return changed;
}
