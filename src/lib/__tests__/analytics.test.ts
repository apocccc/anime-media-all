import { afterEach, describe, expect, it, vi } from "vitest";

/** site.ts はモジュール読み込み時に env を評価するため、都度リセットして再読込する */
async function loadVerification(value: string | undefined) {
  vi.resetModules();
  if (value === undefined) {
    vi.stubEnv("GOOGLE_SITE_VERIFICATION", "");
  } else {
    vi.stubEnv("GOOGLE_SITE_VERIFICATION", value);
  }
  const mod = await import("@/lib/site");
  return mod.GOOGLE_SITE_VERIFICATION;
}

describe("GOOGLE_SITE_VERIFICATION (Search Console HTMLタグ認証)", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("未設定なら空配列(metaタグを出力しない)", async () => {
    expect(await loadVerification(undefined)).toEqual([]);
  });

  it("単一トークンを配列で返す", async () => {
    expect(await loadVerification("abc123token")).toEqual(["abc123token"]);
  });

  it("カンマ区切りで複数プロパティを同時に認証できる", async () => {
    expect(await loadVerification("tokenA, tokenB ,tokenC")).toEqual([
      "tokenA",
      "tokenB",
      "tokenC",
    ]);
  });

  it("空要素・空白のみの要素は捨てる", async () => {
    expect(await loadVerification(" , tokenA , ")).toEqual(["tokenA"]);
  });
});

/**
 * GA4 測定IDの検証。値はインラインスクリプトへ埋め込まれるため、
 * 想定外の文字を含む env をそのまま出力しないことを担保する
 * (パターンは GoogleAnalytics.tsx と同一)。
 */
const GA_ID_PATTERN = /^G-[A-Z0-9]+$/i;

describe("GA4 測定IDの形式検証", () => {
  it("正しい測定IDを受け入れる", () => {
    expect(GA_ID_PATTERN.test("G-ABCDE12345")).toBe(true);
    expect(GA_ID_PATTERN.test("G-1234567890")).toBe(true);
  });

  it("旧UAプロパティ・空文字・プレースホルダを弾く", () => {
    expect(GA_ID_PATTERN.test("UA-12345-1")).toBe(false);
    expect(GA_ID_PATTERN.test("")).toBe(false);
    expect(GA_ID_PATTERN.test("G-")).toBe(false);
  });

  it("スクリプトを閉じられる文字を含む値を弾く", () => {
    expect(GA_ID_PATTERN.test("G-X';alert(1);//")).toBe(false);
    expect(GA_ID_PATTERN.test("G-X</script>")).toBe(false);
  });
});
