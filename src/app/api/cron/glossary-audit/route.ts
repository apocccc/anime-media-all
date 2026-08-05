import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auditPublishedArticles } from "@/lib/glossary";
import { isAuthorizedCron } from "@/lib/cron-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * 公開記事の用語表記監査(§5.3): 表記揺れを検出し、
 * 該当翻訳を needs_review に落として管理画面のキューに出す。
 */
export async function GET(req: Request) {
  if (!isAuthorizedCron(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const violations = await auditPublishedArticles();
  for (const v of violations) {
    await prisma.articleTranslation.updateMany({
      where: { articleId: v.articleId, locale: v.locale, status: "machine" },
      data: { status: "needs_review" },
    });
  }

  return NextResponse.json({
    violations: violations.length,
    details: violations.slice(0, 50),
  });
}
