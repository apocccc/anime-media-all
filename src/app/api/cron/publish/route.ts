import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { revalidateArticle } from "@/lib/revalidate";
import { isAuthorizedCron } from "@/lib/cron-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * 予約公開: 毎分呼び出され、publishAt に到達した scheduled 記事を公開して
 * revalidate する。公開時に各翻訳の publishedAt も記録する。
 */
export async function GET(req: Request) {
  if (!isAuthorizedCron(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const due = await prisma.article.findMany({
    where: { status: "scheduled", publishAt: { lte: now } },
    include: { category: true },
  });

  for (const article of due) {
    await prisma.$transaction([
      prisma.article.update({
        where: { id: article.id },
        data: {
          status: "published",
          publishedAt: article.publishedAt ?? now,
          publishAt: null,
        },
      }),
      prisma.articleTranslation.updateMany({
        where: {
          articleId: article.id,
          status: { in: ["approved", "machine"] },
          publishedAt: null,
        },
        data: { publishedAt: now },
      }),
    ]);
    revalidateArticle(article.category.slug, article.slug);
  }

  return NextResponse.json({ published: due.length });
}
