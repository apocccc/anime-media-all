import { NextResponse } from "next/server";
import type { Locale as DbLocale } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { drainJobs } from "@/lib/jobs";
import { translateArticle, queueArticleTranslations } from "@/lib/translate";
import { aiScreenFanPost, translateFanPost } from "@/lib/moderation";
import { extractAndRegisterTerms } from "@/lib/glossary";
import { revalidateArticle } from "@/lib/revalidate";
import { isAuthorizedCron } from "@/lib/cron-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * ジョブキュー drain(§4.3): 翻訳・再翻訳・モデレーションを2分毎に処理する。
 */
export async function GET(req: Request) {
  if (!isAuthorizedCron(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const summary = await drainJobs({
    translate_article: async (job) => {
      const { articleId, locale } = job.payload as {
        articleId: string;
        locale: DbLocale;
      };
      await translateArticle(articleId, locale);
      const article = await prisma.article.findUnique({
        where: { id: articleId },
        include: { category: true },
      });
      if (article?.status === "published") {
        revalidateArticle(article.category.slug, article.slug);
      }
    },
    translate_fan_post: async (job) => {
      const { postId } = job.payload as { postId: string };
      await translateFanPost(postId);
    },
    moderate_fan_post: async (job) => {
      const { postId } = job.payload as { postId: string };
      await aiScreenFanPost(postId);
    },
    glossary_extract: async (job) => {
      const { articleId } = job.payload as { articleId: string };
      const article = await prisma.article.findUnique({
        where: { id: articleId },
        include: { translations: { where: { locale: "ja" } } },
      });
      const master = article?.translations[0];
      if (!master) return;
      await extractAndRegisterTerms(articleId, `${master.title}\n${master.lead}`);
    },
    // 用語表記変更の波及: その用語を含む公開済み記事を一括再翻訳キューへ(§5.3)
    retranslate_term: async (job) => {
      const { termId } = job.payload as { termId: string };
      const term = await prisma.term.findUnique({ where: { id: termId } });
      if (!term) return;
      const articles = await prisma.article.findMany({
        where: {
          status: "published",
          translations: {
            some: {
              locale: "ja",
              OR: [
                { title: { contains: term.nameJa } },
                { lead: { contains: term.nameJa } },
                // 本文(Json)はDBでは検索できないため title/lead でスクリーニングし、
                // 翻訳時に全ブロックへ辞書が適用される
              ],
            },
          },
        },
        select: { id: true },
        take: 100,
      });
      for (const a of articles) {
        await queueArticleTranslations(a.id);
      }
    },
  });

  return NextResponse.json(summary);
}
