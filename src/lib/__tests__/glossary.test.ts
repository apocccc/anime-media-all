import { describe, expect, it } from "vitest";
import { glossaryForLocale, verifyGlossary } from "@/lib/glossary";
import type { TermWithRelations } from "@/lib/glossary";

function term(over: Partial<TermWithRelations> = {}): TermWithRelations {
  return {
    id: "t1",
    type: "series",
    status: "verified",
    nameJa: "葬送のフリーレン",
    readingJa: null,
    romaji: "sousou no frieren",
    seriesId: null,
    notes: null,
    sourceUrl: null,
    doNotTranslate: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    forms: [
      {
        id: "f1",
        termId: "t1",
        locale: "en",
        value: "Frieren: Beyond Journey's End",
        isOfficial: true,
        sourceUrl: null,
        verifiedById: null,
        verifiedAt: null,
      },
    ],
    aliases: [],
    ...over,
  } as TermWithRelations;
}

describe("glossaryForLocale", () => {
  it("returns the confirmed form for the locale", () => {
    const pairs = glossaryForLocale([term()], "en");
    expect(pairs).toEqual([
      { source: "葬送のフリーレン", target: "Frieren: Beyond Journey's End" },
    ]);
  });

  it("omits terms with no form for the locale (not verifiable)", () => {
    expect(glossaryForLocale([term()], "ko")).toEqual([]);
  });

  it("keeps the original for doNotTranslate terms", () => {
    const pairs = glossaryForLocale([term({ doNotTranslate: true })], "en");
    expect(pairs).toEqual([
      { source: "葬送のフリーレン", target: "葬送のフリーレン" },
    ]);
  });
});

describe("verifyGlossary (§5.3 出力の機械検証)", () => {
  const pairs = glossaryForLocale([term()], "en");

  it("passes when the confirmed form appears in the output", () => {
    const violations = verifyGlossary(
      "『葬送のフリーレン』第2期が決定",
      "Season 2 of Frieren: Beyond Journey's End was announced",
      pairs
    );
    expect(violations).toEqual([]);
  });

  it("flags outputs that use a different form", () => {
    const violations = verifyGlossary(
      "『葬送のフリーレン』第2期が決定",
      "Season 2 of Sousou no Frieren was announced",
      pairs
    );
    expect(violations).toEqual([
      {
        source: "葬送のフリーレン",
        expected: "Frieren: Beyond Journey's End",
      },
    ]);
  });

  it("ignores terms that do not appear in the source", () => {
    const violations = verifyGlossary("別作品のニュース", "Other news", pairs);
    expect(violations).toEqual([]);
  });
});
