import { NextResponse } from "next/server";
import { importAllFeeds, backfillMissingThumbnails } from "@/lib/rss-import";
import { isAuthorizedCron } from "@/lib/cron-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * ソース収集(§6.2): 10分毎に有効フィードを取得する。
 * 頻度・件数上限はフィード単位の設定に従う。
 */
export async function GET(req: Request) {
  if (!isAuthorizedCron(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const results = await importAllFeeds();
  const backfilled = await backfillMissingThumbnails();
  return NextResponse.json({ results, backfilled });
}
