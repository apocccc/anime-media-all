import { afterEach, describe, expect, it, vi } from "vitest";
import { isAuthorizedCron } from "@/lib/cron-auth";

function req(auth?: string): Request {
  return new Request("http://localhost/api/cron/publish", {
    headers: auth ? { authorization: auth } : {},
  });
}

describe("isAuthorizedCron (fail-closed)", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("rejects when CRON_SECRET is unset in production on Vercel (fail-closed)", () => {
    vi.stubEnv("CRON_SECRET", "");
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("VERCEL", "1");
    expect(isAuthorizedCron(req())).toBe(false);
  });

  it("accepts the correct bearer token", () => {
    vi.stubEnv("CRON_SECRET", "s3cret");
    expect(isAuthorizedCron(req("Bearer s3cret"))).toBe(true);
  });

  it("rejects a wrong token", () => {
    vi.stubEnv("CRON_SECRET", "s3cret");
    expect(isAuthorizedCron(req("Bearer nope"))).toBe(false);
  });

  it("allows local development without a secret", () => {
    vi.stubEnv("CRON_SECRET", "");
    vi.stubEnv("NODE_ENV", "development");
    expect(isAuthorizedCron(req())).toBe(true);
  });
});
