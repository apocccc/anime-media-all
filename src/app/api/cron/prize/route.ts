import { NextResponse } from "next/server";
import { rolloverCycles } from "@/lib/prize";
import { isAuthorizedCron } from "@/lib/cron-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * 週次プライズ(§9): JST月曜0時に週次集計を締め、
 * 終了サイクルを judging(編集部の審査待ち)にして新サイクルを開く。
 * 受賞の最終確定は管理画面で行う(自動確定しない)。
 */
export async function GET(req: Request) {
  if (!isAuthorizedCron(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const result = await rolloverCycles();
  return NextResponse.json(result);
}
