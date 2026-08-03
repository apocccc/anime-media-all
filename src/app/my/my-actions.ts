"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { enqueueJob } from "@/lib/jobs";
import { verifyTurnstile } from "@/lib/turnstile";
import type { FanPostType, Locale as DbLocale } from "@prisma/client";

/** 規約上の最低年齢(§8.2 未成年保護) */
const MIN_AGE = 13;

const submitSchema = z.object({
  seriesId: z.string().min(1),
  type: z.enum(["illustration", "cosplay", "photo", "text", "embed"]),
  body: z.string().max(4000),
  originalLocale: z.enum(["ja", "en", "ko", "zh_Hant", "th", "zh_Hans"]),
  embedUrl: z.string().url().max(500).optional(),
  mediaIds: z.array(z.string()).max(4),
  birthMonth: z
    .string()
    .regex(/^\d{4}-\d{2}$/)
    .optional(),
  agreeTerms: z.literal(true),
});

const EMBED_HOSTS: Record<string, string> = {
  "twitter.com": "X",
  "x.com": "X",
  "www.instagram.com": "Instagram",
  "instagram.com": "Instagram",
  "www.tiktok.com": "TikTok",
  "www.youtube.com": "YouTube",
  "youtu.be": "YouTube",
};

/**
 * ファン投稿(§8.1)。作品(Series)紐付け必須・規約同意必須。
 * 全投稿が公開前レビューを通る(AIスクリーニング → 人手承認)。
 */
export async function submitFanPostAction(
  _prev: { error: string | null; ok: boolean },
  formData: FormData
): Promise<{ error: string | null; ok: boolean }> {
  const session = await auth();
  if (!session?.user) return { error: "unauthenticated", ok: false };
  if (!(await verifyTurnstile(formData.get("cf-turnstile-response") as string | null))) {
    return { error: "turnstile", ok: false };
  }

  let parsed;
  try {
    parsed = submitSchema.parse({
      seriesId: formData.get("seriesId"),
      type: formData.get("type"),
      body: (formData.get("body") as string) ?? "",
      originalLocale: formData.get("originalLocale"),
      embedUrl: (formData.get("embedUrl") as string) || undefined,
      mediaIds: formData.getAll("mediaIds").map(String).filter(Boolean),
      birthMonth: (formData.get("birthMonth") as string) || undefined,
      agreeTerms: formData.get("agreeTerms") === "on",
    });
  } catch {
    return { error: "invalid", ok: false };
  }

  // 年齢確認(生年月入力)
  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user) return { error: "unauthenticated", ok: false };
  const birthMonth = parsed.birthMonth ?? user.birthMonth;
  if (!birthMonth) return { error: "birth_month_required", ok: false };
  const [y, m] = birthMonth.split("-").map(Number);
  const age =
    (Date.now() - Date.UTC(y, (m ?? 1) - 1, 1)) / (365.25 * 24 * 3600 * 1000);
  if (age < MIN_AGE) return { error: "underage", ok: false };
  if (birthMonth !== user.birthMonth) {
    await prisma.user.update({
      where: { id: user.id },
      data: { birthMonth },
    });
  }

  const series = await prisma.series.findFirst({
    where: { id: parsed.seriesId, status: "approved" },
    select: { id: true },
  });
  if (!series) return { error: "series_not_found", ok: false };

  if (parsed.type === "embed" && !parsed.embedUrl) {
    return { error: "embed_url_required", ok: false };
  }
  if (parsed.type === "text" && !parsed.body.trim()) {
    return { error: "body_required", ok: false };
  }
  if (
    ["illustration", "cosplay", "photo"].includes(parsed.type) &&
    parsed.mediaIds.length === 0
  ) {
    return { error: "media_required", ok: false };
  }

  let embedProvider: string | null = null;
  if (parsed.embedUrl) {
    try {
      embedProvider = EMBED_HOSTS[new URL(parsed.embedUrl).hostname] ?? null;
      if (!embedProvider) return { error: "embed_host_not_allowed", ok: false };
    } catch {
      return { error: "invalid", ok: false };
    }
  }

  const post = await prisma.fanPost.create({
    data: {
      authorId: user.id,
      seriesId: series.id,
      type: parsed.type as FanPostType,
      status: "pending",
      bodyOriginal: parsed.body.trim(),
      originalLocale: parsed.originalLocale as DbLocale,
      mediaIds: parsed.mediaIds,
      embedUrl: parsed.embedUrl ?? null,
      embedProvider,
    },
  });

  // 一次AIスクリーニングとキャプション翻訳をジョブキューへ
  await enqueueJob("moderate_fan_post", { postId: post.id }, `moderate:${post.id}`);
  await enqueueJob(
    "translate_fan_post",
    { postId: post.id },
    `translate-fanpost:${post.id}`
  );

  revalidatePath("/my");
  return { error: null, ok: true };
}
