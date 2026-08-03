import { describe, expect, it } from "vitest";
import { articleAlternates, publishedLocalesOf } from "@/lib/seo";

const article = {
  translations: [
    { locale: "ja" as const, status: "approved" },
    { locale: "en" as const, status: "approved" },
    { locale: "ko" as const, status: "machine" },
    { locale: "zh_Hant" as const, status: "excluded" },
    { locale: "th" as const, status: "pending" },
  ],
};

describe("publishedLocalesOf (§4.2 excluded の除外)", () => {
  it("includes approved/machine public locales only", () => {
    expect(publishedLocalesOf(article)).toEqual(["en", "ko"]);
  });

  it("never exposes the internal ja master", () => {
    expect(publishedLocalesOf(article)).not.toContain("ja");
  });
});

describe("articleAlternates (hreflang)", () => {
  it("omits excluded/pending locales and sets x-default to en", () => {
    const alternates = articleAlternates(article, "/news/anime/20260101-test");
    expect(alternates).not.toBeNull();
    const langs = Object.keys(alternates!.languages);
    expect(langs.sort()).toEqual(["en", "ko", "x-default"].sort());
    expect(alternates!.languages["x-default"]).toContain("/en/");
  });

  it("returns null when nothing is published", () => {
    expect(
      articleAlternates(
        { translations: [{ locale: "en", status: "pending" }] },
        "/x"
      )
    ).toBeNull();
  });
});
