import { describe, expect, it } from "vitest";
import type { JSONContent } from "@tiptap/core";
import {
  applyTranslations,
  changedBlockIndexes,
  docHashes,
  splitBlocks,
} from "@/lib/blocks";

const doc: JSONContent = {
  type: "doc",
  content: [
    { type: "paragraph", content: [{ type: "text", text: "第一段落。" }] },
    { type: "image", attrs: { src: "/uploads/x.webp" } },
    {
      type: "heading",
      attrs: { level: 2 },
      content: [{ type: "text", text: "見出し" }],
    },
    { type: "paragraph", content: [{ type: "text", text: "[IMAGE_1]" }] },
  ],
};

describe("splitBlocks", () => {
  it("splits top-level nodes and collects translatable texts only", () => {
    const blocks = splitBlocks(doc);
    expect(blocks).toHaveLength(4);
    // 画像ブロック・[IMAGE_n]マーカーは翻訳対象にならない
    expect(blocks[0].texts).toEqual([{ id: "b0_t0", text: "第一段落。" }]);
    expect(blocks[1].texts).toEqual([]);
    expect(blocks[2].texts).toEqual([{ id: "b2_t0", text: "見出し" }]);
    expect(blocks[3].texts).toEqual([]);
  });
});

describe("changedBlockIndexes (ブロック差分)", () => {
  it("detects only changed blocks when structure matches", () => {
    const before = docHashes(doc);
    const edited: JSONContent = JSON.parse(JSON.stringify(doc));
    edited.content![2].content![0].text = "新しい見出し";
    const after = docHashes(edited);
    expect(changedBlockIndexes(after, before)).toEqual(new Set([2]));
  });

  it("returns null (retranslate all) when block count changes", () => {
    const before = docHashes(doc);
    const edited: JSONContent = {
      ...doc,
      content: [...(doc.content ?? []), { type: "paragraph" }],
    };
    expect(changedBlockIndexes(docHashes(edited), before)).toBeNull();
  });
});

describe("applyTranslations", () => {
  it("replaces text nodes and keeps images / markers untouched", () => {
    const translated = applyTranslations(
      doc,
      new Map([
        ["b0_t0", "First paragraph."],
        ["b2_t0", "Heading"],
      ])
    );
    expect(translated.content![0].content![0].text).toBe("First paragraph.");
    expect(translated.content![1]).toEqual(doc.content![1]);
    expect(translated.content![2].content![0].text).toBe("Heading");
    expect(translated.content![3].content![0].text).toBe("[IMAGE_1]");
  });
});
