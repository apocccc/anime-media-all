import { afterEach, describe, expect, it, vi } from "vitest";
import {
  AiDisabledError,
  aiComplete,
  aiRoleEnabled,
  type AiRole,
} from "@/lib/ai/provider";

const ROLE_ENV: Record<AiRole, string> = {
  write: "AI_WRITE_ENABLED",
  translate: "AI_TRANSLATE_ENABLED",
  moderate: "AI_MODERATE_ENABLED",
};

/** 役割別フラグを未設定状態にする(既定値の検証用) */
function clearRoleEnv() {
  for (const v of Object.values(ROLE_ENV)) vi.stubEnv(v, "");
}

describe("aiRoleEnabled の既定値", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("write は既定で停止(記事は人手で執筆する運用)", () => {
    clearRoleEnv();
    expect(aiRoleEnabled("write")).toBe(false);
  });

  it("translate は既定で停止", () => {
    clearRoleEnv();
    expect(aiRoleEnabled("translate")).toBe(false);
  });

  it("moderate は既定で有効(投稿の安全性に直結するため)", () => {
    clearRoleEnv();
    expect(aiRoleEnabled("moderate")).toBe(true);
  });
});

describe("aiRoleEnabled の明示設定", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it.each(["true", "TRUE", "1", "on", "yes", " true "])(
    "%s は有効と解釈する",
    (value) => {
      vi.stubEnv("AI_WRITE_ENABLED", value);
      expect(aiRoleEnabled("write")).toBe(true);
    }
  );

  it.each(["false", "0", "off", "no", "disabled", "maybe"])(
    "%s は無効と解釈する",
    (value) => {
      vi.stubEnv("AI_MODERATE_ENABLED", value);
      expect(aiRoleEnabled("moderate")).toBe(false);
    }
  );

  it("空文字は未設定として既定値に従う", () => {
    vi.stubEnv("AI_MODERATE_ENABLED", "");
    expect(aiRoleEnabled("moderate")).toBe(true);
    vi.stubEnv("AI_WRITE_ENABLED", "");
    expect(aiRoleEnabled("write")).toBe(false);
  });

  it("役割ごとに独立して切り替わる", () => {
    clearRoleEnv();
    vi.stubEnv("AI_TRANSLATE_ENABLED", "true");
    expect(aiRoleEnabled("translate")).toBe(true);
    expect(aiRoleEnabled("write")).toBe(false);
  });
});

/**
 * 呼び出し側のガード漏れが課金に化けないことの担保(§最終防壁)。
 * provider は mock であっても無効な役割を実行しない。
 */
describe("aiComplete は無効な役割を実行しない", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it.each(["write", "translate"] as const)(
    "%s が停止中なら AiDisabledError を投げる",
    async (role) => {
      clearRoleEnv();
      vi.stubEnv("AI_PROVIDER", "mock");
      await expect(
        aiComplete({ role, system: "s", user: "u" })
      ).rejects.toBeInstanceOf(AiDisabledError);
    }
  );

  it("エラーメッセージが再開に必要な環境変数名を示す", async () => {
    clearRoleEnv();
    vi.stubEnv("AI_PROVIDER", "mock");
    await expect(
      aiComplete({ role: "write", system: "s", user: "u" })
    ).rejects.toThrow("AI_WRITE_ENABLED");
  });

  it("有効な役割は実行される(mock で確認)", async () => {
    clearRoleEnv();
    vi.stubEnv("AI_PROVIDER", "mock");
    const out = await aiComplete({ role: "moderate", system: "s", user: "u" });
    expect(JSON.parse(out).verdict).toBe("pass");
  });
});
