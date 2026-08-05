import type { JSONContent } from "@tiptap/core";
import { SITE_NAME, SITE_URL } from "@/lib/site";

/**
 * 記事本文(Tiptap JSON)⇔「テキスト+[IMAGE_n]マーカー」変換ヘルパー。
 * AI記事生成(src/lib/generate.ts)が使用する。
 * 本文内の画像は位置関係を保ったまま [IMAGE_n] マーカーで受け渡しする。
 */

export class RewriteError extends Error {}

/** Tiptap doc から「テキスト+画像マーカー」の素材と画像ノード一覧を抽出 */
export function extractSource(body: JSONContent): {
  text: string;
  images: JSONContent[];
} {
  const lines: string[] = [];
  const images: JSONContent[] = [];

  for (const node of body.content ?? []) {
    if (node.type === "image") {
      images.push(node);
      lines.push(`[IMAGE_${images.length}]`);
      continue;
    }
    const textOf = (n: JSONContent): string =>
      n.type === "text"
        ? (n.text ?? "")
        : (n.content ?? []).map(textOf).join("");
    const text = textOf(node).trim();
    if (!text) continue;
    if (node.type === "heading") {
      lines.push(`## ${text}`);
    } else {
      lines.push(text);
    }
  }
  return { text: lines.join("\n\n"), images };
}

/** 生成結果と保持画像から Tiptap doc を再構築 */
export function buildRewrittenBody(
  paragraphs: string[],
  images: JSONContent[]
): JSONContent {
  const content: JSONContent[] = [];
  for (const raw of paragraphs) {
    const p = raw.trim();
    if (!p) continue;
    const imageMatch = p.match(/^\[IMAGE_(\d+)\]$/);
    if (imageMatch) {
      const img = images[parseInt(imageMatch[1], 10) - 1];
      if (img) content.push(img);
      continue;
    }
    if (p.startsWith("## ")) {
      content.push({
        type: "heading",
        attrs: { level: 2 },
        content: [{ type: "text", text: p.slice(3).trim() }],
      });
      continue;
    }
    // 段落中に画像マーカーが混ざっている場合は分離する
    const parts = p.split(/(\[IMAGE_\d+\])/).filter((s) => s.trim());
    for (const part of parts) {
      const m = part.match(/^\[IMAGE_(\d+)\]$/);
      if (m) {
        const img = images[parseInt(m[1], 10) - 1];
        if (img) content.push(img);
      } else {
        content.push({
          type: "paragraph",
          content: [{ type: "text", text: part.trim() }],
        });
      }
    }
  }
  if (content.length === 0) {
    throw new RewriteError("Rewritten body is empty");
  }
  return { type: "doc", content };
}

/**
 * 元記事ページの本文テキストを取得する(RSS抜粋より情報量が多いことが
 * 多いため、生成の素材として渡す)。失敗時は null
 */
export async function fetchPageText(pageUrl: string): Promise<string | null> {
  try {
    const res = await fetch(pageUrl, {
      signal: AbortSignal.timeout(15_000),
      headers: {
        "User-Agent": `${SITE_NAME.replace(/\s+/g, "")}Bot/1.0 (+${SITE_URL}/about)`,
      },
    });
    if (!res.ok) return null;
    const html = await res.text();
    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<nav[\s\S]*?<\/nav>/gi, " ")
      .replace(/<footer[\s\S]*?<\/footer>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/\s+/g, " ")
      .trim();
    return text.length > 100 ? text.slice(0, 8000) : null;
  } catch {
    return null;
  }
}
