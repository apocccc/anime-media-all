"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { enqueueJob } from "@/lib/jobs";
import { revalidateSeries } from "@/lib/revalidate";
import { isValidSeriesSlug } from "@/lib/slug";
import { ALL_DB_LOCALES } from "@/lib/locale";
import type { Locale as DbLocale, SeriesKind } from "@prisma/client";

async function requireEditor() {
  const session = await auth();
  if (!session?.user) redirect("/admin/login");
  if (session.user.role !== "admin" && session.user.role !== "editor") {
    redirect("/admin");
  }
  return session.user;
}

/* ---------- 作品(Series) ---------- */

const seriesSchema = z.object({
  id: z.string().optional(),
  slug: z.string().min(1).max(100),
  kind: z.enum(["tv", "movie", "ova", "web", "other"]),
  titleJa: z.string().min(1).max(200),
  officialUrl: z.string().max(500).optional(),
  season: z.string().max(100).optional(),
  broadcast: z.string().max(300).optional(),
  episodes: z.string().max(10).optional(),
});

export async function saveSeriesAction(formData: FormData) {
  await requireEditor();
  const parsed = seriesSchema.parse({
    id: (formData.get("id") as string) || undefined,
    slug: formData.get("slug"),
    kind: formData.get("kind"),
    titleJa: formData.get("titleJa"),
    officialUrl: (formData.get("officialUrl") as string) || undefined,
    season: (formData.get("season") as string) || undefined,
    broadcast: (formData.get("broadcast") as string) || undefined,
    episodes: (formData.get("episodes") as string) || undefined,
  });
  if (!isValidSeriesSlug(parsed.slug)) {
    throw new Error("Series slug must be romaji (lowercase, hyphen)");
  }

  const data = {
    slug: parsed.slug,
    kind: parsed.kind as SeriesKind,
    titleJa: parsed.titleJa,
    status: "approved" as const,
    links: parsed.officialUrl ? { official: parsed.officialUrl } : undefined,
    broadcast: {
      ...(parsed.season ? { season: parsed.season } : {}),
      ...(parsed.broadcast ? { broadcast: parsed.broadcast } : {}),
      ...(parsed.episodes ? { episodes: Number(parsed.episodes) || undefined } : {}),
    },
  };

  const series = parsed.id
    ? await prisma.series.update({ where: { id: parsed.id }, data })
    : await prisma.series.create({ data });

  // ロケール別タイトル(title_{locale})
  for (const locale of ALL_DB_LOCALES) {
    const title = formData.get(`title_${locale}`);
    const synopsis = formData.get(`synopsis_${locale}`);
    if (typeof title !== "string" || !title.trim()) continue;
    await prisma.seriesTranslation.upsert({
      where: { seriesId_locale: { seriesId: series.id, locale } },
      create: {
        seriesId: series.id,
        locale,
        title: title.trim(),
        synopsis: typeof synopsis === "string" ? synopsis.trim() : "",
      },
      update: {
        title: title.trim(),
        ...(typeof synopsis === "string" ? { synopsis: synopsis.trim() } : {}),
      },
    });
  }

  revalidateSeries(series.slug);
  revalidatePath("/admin/series");
}

export async function deleteSeriesAction(formData: FormData) {
  await requireEditor();
  const id = formData.get("id") as string;
  const series = await prisma.series.findUnique({ where: { id } });
  if (!series) return;
  await prisma.series.delete({ where: { id } });
  revalidateSeries(series.slug);
  revalidatePath("/admin/series");
}

/* ---------- 翻訳キュー ---------- */

export async function approveTranslationBulkAction(formData: FormData) {
  const user = await requireEditor();
  const ids = formData.getAll("ids").map(String).filter(Boolean).slice(0, 100);
  if (ids.length === 0) return;
  await prisma.articleTranslation.updateMany({
    where: { id: { in: ids }, status: { in: ["machine", "needs_review"] } },
    data: { status: "approved", reviewedById: user.id, reviewedAt: new Date() },
  });
  revalidatePath("/admin/translations");
}

/* ---------- モデレーション ---------- */

export async function moderateFanPostAction(formData: FormData) {
  const user = await requireEditor();
  const id = formData.get("id") as string;
  const action = z.enum(["approve", "reject", "hide"]).parse(formData.get("moderation"));
  const reason = ((formData.get("reason") as string) || "").slice(0, 500);

  const post = await prisma.fanPost.findUnique({ where: { id } });
  if (!post) return;

  if (action === "approve") {
    await prisma.fanPost.update({
      where: { id },
      data: {
        status: "approved",
        publishedAt: post.publishedAt ?? new Date(),
        reviewedById: user.id,
        reviewedAt: new Date(),
        rejectReason: null,
      },
    });
    // 承認時にキャプション翻訳ジョブを投入
    await enqueueJob(
      "translate_fan_post",
      { postId: id },
      `translate-fanpost:${id}`
    );
  } else {
    await prisma.fanPost.update({
      where: { id },
      data: {
        status: action === "reject" ? "rejected" : "hidden",
        reviewedById: user.id,
        reviewedAt: new Date(),
        rejectReason: reason || null,
      },
    });
  }
  await prisma.moderationLog.create({
    data: {
      targetType: "fan_post",
      targetId: id,
      action,
      reason: reason || null,
      actorId: user.id,
    },
  });
  revalidatePath("/admin/moderation");
}

/* ---------- 事業者 ---------- */

export async function moderateOrganizationAction(formData: FormData) {
  const user = await requireEditor();
  const id = formData.get("id") as string;
  const action = z
    .enum(["approve", "suspend", "trust", "untrust"])
    .parse(formData.get("orgAction"));

  if (action === "approve" || action === "suspend") {
    await prisma.organization.update({
      where: { id },
      data: { status: action === "approve" ? "approved" : "suspended" },
    });
  } else {
    await prisma.organization.update({
      where: { id },
      data: { autoApprove: action === "trust" },
    });
  }
  await prisma.moderationLog.create({
    data: {
      targetType: "organization",
      targetId: id,
      action,
      actorId: user.id,
    },
  });
  revalidatePath("/admin/partners");
}

/* ---------- プライズ ---------- */

export async function decideWinnerAction(formData: FormData) {
  const user = await requireEditor();
  const cycleId = formData.get("cycleId") as string;
  const postId = formData.get("postId") as string;
  const region = ((formData.get("region") as string) || "global").slice(0, 40);

  const post = await prisma.fanPost.findUnique({
    where: { id: postId },
    select: { id: true, authorId: true },
  });
  if (!post) return;

  const reward = await prisma.rewardCatalog.findFirst({
    where: { region, isActive: true },
  });

  await prisma.$transaction([
    prisma.prizeCycle.update({
      where: { id: cycleId },
      data: { status: "decided", winnerPostId: postId },
    }),
    prisma.prizeAward.create({
      data: {
        cycleId,
        postId,
        userId: post.authorId,
        region,
        provider: reward?.provider ?? "manual",
        amount: reward?.amount ?? 0,
        currency: reward?.currency ?? "JPY",
        status: "pending",
      },
    }),
    prisma.moderationLog.create({
      data: {
        targetType: "prize_cycle",
        targetId: cycleId,
        action: "decide_winner",
        reason: `post:${postId}`,
        actorId: user.id,
      },
    }),
  ]);
  revalidatePath("/admin/prize");
}

/** ギフトコードの発行記録(初期リリースは手動発行。§9.2) */
export async function issueAwardAction(formData: FormData) {
  const user = await requireEditor();
  const id = formData.get("id") as string;
  const code = ((formData.get("code") as string) || "").slice(0, 200);
  await prisma.prizeAward.update({
    where: { id },
    data: {
      code: code || null,
      status: code ? "issued" : undefined,
      sentAt: formData.get("markSent") === "on" ? new Date() : undefined,
    },
  });
  await prisma.moderationLog.create({
    data: {
      targetType: "prize_award",
      targetId: id,
      action: "issue_code",
      actorId: user.id,
    },
  });
  revalidatePath("/admin/prize");
}

export async function saveRewardCatalogAction(formData: FormData) {
  await requireEditor();
  const schema = z.object({
    id: z.string().optional(),
    region: z.string().min(1).max(40),
    provider: z.string().min(1).max(100),
    productName: z.string().min(1).max(200),
    amount: z.coerce.number().int().min(0),
    currency: z.string().min(1).max(10),
    isActive: z.boolean(),
    notes: z.string().max(500).optional(),
  });
  const parsed = schema.parse({
    id: (formData.get("id") as string) || undefined,
    region: formData.get("region"),
    provider: formData.get("provider"),
    productName: formData.get("productName"),
    amount: formData.get("amount"),
    currency: formData.get("currency"),
    isActive: formData.get("isActive") === "on",
    notes: (formData.get("notes") as string) || undefined,
  });
  const data = { ...parsed, id: undefined, notes: parsed.notes ?? null };
  if (parsed.id) {
    await prisma.rewardCatalog.update({ where: { id: parsed.id }, data });
  } else {
    await prisma.rewardCatalog.create({ data });
  }
  revalidatePath("/admin/prize");
}

/* ---------- ジョブ ---------- */

export async function retryJobAction(formData: FormData) {
  await requireEditor();
  const id = formData.get("id") as string;
  await prisma.job.update({
    where: { id },
    data: { status: "queued", attempts: 0, lastError: null, runAfter: new Date() },
  });
  revalidatePath("/admin/jobs");
}

export async function deleteJobAction(formData: FormData) {
  await requireEditor();
  const id = formData.get("id") as string;
  await prisma.job.delete({ where: { id } });
  revalidatePath("/admin/jobs");
}

/** ユーザーのロール変更(influencer 昇格・partner 割り当て等) */
export async function setUserRoleAction(formData: FormData) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") redirect("/admin");
  const id = formData.get("id") as string;
  const role = z
    .enum(["admin", "editor", "author", "contributor", "reader", "influencer", "partner"])
    .parse(formData.get("role"));
  const handle = ((formData.get("handle") as string) || "").trim() || null;
  await prisma.user.update({
    where: { id },
    data: { role, ...(handle !== null ? { handle } : {}) },
  });
  revalidatePath("/admin/users");
}

export type TranslationQueueLocale = DbLocale;
