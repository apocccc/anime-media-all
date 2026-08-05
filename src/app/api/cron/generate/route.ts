import { NextResponse } from "next/server";
import { generateMasterArticles } from "@/lib/generate";
import { isAuthorizedCron } from "@/lib/cron-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * 日本語マスター記事の生成(§6.2 step4): 1日3回 + 管理画面から手動実行。
 */
export async function GET(req: Request) {
  if (!isAuthorizedCron(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const summary = await generateMasterArticles();
  return NextResponse.json(summary);
}
