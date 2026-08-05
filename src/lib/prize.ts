import { prisma } from "@/lib/prisma";
import { TOKYO_TZ } from "@/lib/site";

/**
 * 週次プライズ(§9)。サイクル: 月曜 00:00 〜 日曜 23:59(Asia/Tokyo)。
 * 集計は読者投票+編集部スコアだが、最終決定は編集部の審査
 * (単純な投票数1位の自動確定にしない)。
 */

/** 1ユーザーがサイクル内に投票できる上限 */
export const MAX_VOTES_PER_CYCLE = 10;

/** 与えられた時刻が属する週の月曜0:00(Asia/Tokyo)をUTCで返す */
export function cycleStartFor(now = new Date()): Date {
  const tz = process.env.PRIZE_TIMEZONE || TOKYO_TZ;
  // Asia/Tokyo での年月日と曜日を取得
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
    hour: "2-digit",
    hour12: false,
  });
  const parts = Object.fromEntries(
    fmt.formatToParts(now).map((p) => [p.type, p.value])
  );
  const weekdayIndex = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(
    parts.weekday as string
  );
  // 当日の 00:00 JST を UTC で求める(JST = UTC+9 固定)
  const dayStartUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    -9,
    0,
    0
  );
  return new Date(dayStartUtc - weekdayIndex * 24 * 60 * 60 * 1000);
}

export function cycleEndFor(startAt: Date): Date {
  return new Date(startAt.getTime() + 7 * 24 * 60 * 60 * 1000 - 1000);
}

/** 現在の週のサイクルを取得または作成する */
export async function ensureCurrentCycle(now = new Date()) {
  const startAt = cycleStartFor(now);
  const endAt = cycleEndFor(startAt);
  return prisma.prizeCycle.upsert({
    where: { startAt_region: { startAt, region: "global" } },
    create: { startAt, endAt, region: "global", status: "open" },
    update: {},
  });
}

/**
 * 週次締め処理(cron。JST月曜0時)。
 * 終了したサイクルを judging にして候補を編集部へ提示し、新しい週のサイクルを開く。
 */
export async function rolloverCycles(now = new Date()): Promise<{
  closed: number;
  opened: boolean;
}> {
  const result = { closed: 0, opened: false };
  const ended = await prisma.prizeCycle.findMany({
    where: { status: "open", endAt: { lt: now } },
  });
  for (const cycle of ended) {
    await prisma.prizeCycle.update({
      where: { id: cycle.id },
      data: { status: "judging" },
    });
    result.closed++;
  }
  await ensureCurrentCycle(now);
  result.opened = true;
  return result;
}

/** 投票(1ユーザー1投稿1票、サイクル内の総投票数に上限) */
export async function castVote(
  userId: string,
  postId: string,
  now = new Date()
): Promise<{ ok: boolean; error?: string }> {
  const cycle = await ensureCurrentCycle(now);
  if (cycle.status !== "open") return { ok: false, error: "cycle_closed" };

  const post = await prisma.fanPost.findFirst({
    where: { id: postId, status: "approved" },
    select: { id: true, authorId: true },
  });
  if (!post) return { ok: false, error: "post_not_found" };
  if (post.authorId === userId) return { ok: false, error: "own_post" };

  const count = await prisma.fanPostVote.count({
    where: { userId, cycleId: cycle.id },
  });
  if (count >= MAX_VOTES_PER_CYCLE) return { ok: false, error: "vote_limit" };

  try {
    await prisma.$transaction([
      prisma.fanPostVote.create({
        data: { userId, postId, cycleId: cycle.id },
      }),
      prisma.fanPost.update({
        where: { id: postId },
        data: { voteCount: { increment: 1 }, score: { increment: 1 } },
      }),
    ]);
    return { ok: true };
  } catch {
    // @@unique([postId, userId, cycleId]) 違反 = 投票済み
    return { ok: false, error: "already_voted" };
  }
}

/** 地域→賞品のマッピング(RewardCatalog)から有効な賞品を引く */
export function rewardForRegion(region: string) {
  return prisma.rewardCatalog.findFirst({
    where: { region, isActive: true },
  });
}
