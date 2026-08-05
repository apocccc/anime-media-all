import { prisma } from "@/lib/prisma";
import type { Job, Prisma } from "@prisma/client";

/**
 * DBキュー(Job テーブル)。外部キューは使わない。
 * cron /api/cron/jobs が毎回 drainJobs() で取り出して実行する。
 * 指数バックオフで最大5回、超過は failed(dead-letter)として管理画面に表示。
 */

export const MAX_ATTEMPTS = 5;

export type JobType =
  | "translate_article" // payload: { articleId, locale }
  | "translate_fan_post" // payload: { postId }
  | "moderate_fan_post" // payload: { postId }
  | "retranslate_term" // payload: { termId } 用語表記変更の波及再翻訳
  | "glossary_extract" // payload: { articleId } 翻訳準備(固有名詞分析→翻訳fan-out)
  | "articleify_press_release"; // payload: { articleId } PR原文→独自AI記事化

export async function enqueueJob(
  type: JobType,
  payload: Prisma.InputJsonValue,
  idempotencyKey: string,
  runAfter = new Date()
): Promise<void> {
  await prisma.job.upsert({
    where: { idempotencyKey },
    create: { type, payload, idempotencyKey, runAfter },
    // 既に done/failed のジョブを同じキーで再投入した場合はリセットして再実行
    update: { status: "queued", attempts: 0, lastError: null, runAfter, payload },
  });
}

/** 実行対象のジョブを取り出して running にする(取りこぼしより二重実行回避を優先) */
async function claimNextJob(): Promise<Job | null> {
  return prisma.$transaction(async (tx) => {
    const job = await tx.job.findFirst({
      where: { status: "queued", runAfter: { lte: new Date() } },
      orderBy: { runAfter: "asc" },
    });
    if (!job) return null;
    const updated = await tx.job.updateMany({
      where: { id: job.id, status: "queued" },
      data: { status: "running", attempts: { increment: 1 } },
    });
    if (updated.count === 0) return null;
    return { ...job, status: "running" as const, attempts: job.attempts + 1 };
  });
}

export type JobHandler = (job: Job) => Promise<void>;

export type DrainSummary = {
  processed: number;
  succeeded: number;
  failed: number;
  details: string[];
};

/**
 * キューを時間予算内で処理する。ハンドラーはジョブ種別ごとに登録する。
 */
export async function drainJobs(
  handlers: Record<string, JobHandler>,
  opts: { budgetMs?: number; maxJobs?: number } = {}
): Promise<DrainSummary> {
  const deadline = Date.now() + (opts.budgetMs ?? 240_000);
  const maxJobs = opts.maxJobs ?? 20;
  const summary: DrainSummary = {
    processed: 0,
    succeeded: 0,
    failed: 0,
    details: [],
  };

  while (summary.processed < maxJobs && Date.now() < deadline) {
    const job = await claimNextJob();
    if (!job) break;
    summary.processed++;
    const handler = handlers[job.type];
    try {
      if (!handler) throw new Error(`No handler for job type: ${job.type}`);
      await handler(job);
      await prisma.job.update({
        where: { id: job.id },
        data: { status: "done", lastError: null },
      });
      summary.succeeded++;
      summary.details.push(`ok ${job.type} ${job.idempotencyKey}`);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      const exhausted = job.attempts >= MAX_ATTEMPTS;
      await prisma.job.update({
        where: { id: job.id },
        data: {
          status: exhausted ? "failed" : "queued",
          lastError: message.slice(0, 1000),
          // 指数バックオフ: 2^attempts 分
          runAfter: exhausted
            ? undefined
            : new Date(Date.now() + Math.pow(2, job.attempts) * 60_000),
        },
      });
      summary.failed++;
      summary.details.push(
        `${exhausted ? "dead" : "retry"} ${job.type} ${job.idempotencyKey}: ${message.slice(0, 120)}`
      );
    }
  }
  return summary;
}
