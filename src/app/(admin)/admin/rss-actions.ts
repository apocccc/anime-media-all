"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { importFeed } from "@/lib/rss-import";

async function requireFeedManager() {
  const session = await auth();
  if (!session?.user) redirect("/admin/login");
  if (session.user.role !== "admin" && session.user.role !== "editor") {
    redirect("/admin");
  }
  return session.user;
}

const INTERVAL_OPTIONS = [10, 30, 60, 180, 360, 720, 1440] as const;

const feedSchema = z.object({
  name: z.string().min(1).max(100),
  url: z.string().url().max(500),
  categoryId: z.string().min(1),
  autoPublish: z.boolean(),
  // プレスリリース源: press-release へ原文転載(即時公開)+ 独自AI記事化
  isPressRelease: z.boolean(),
  fetchLimit: z.coerce.number().int().min(1).max(30),
  fetchIntervalMinutes: z.coerce
    .number()
    .int()
    .refine((v) => (INTERVAL_OPTIONS as readonly number[]).includes(v)),
});

export async function createFeedAction(formData: FormData) {
  await requireFeedManager();
  const parsed = feedSchema.parse({
    name: formData.get("name"),
    url: formData.get("url"),
    categoryId: formData.get("categoryId"),
    autoPublish: formData.get("autoPublish") === "on",
    isPressRelease: formData.get("isPressRelease") === "on",
    fetchLimit: formData.get("fetchLimit") || 10,
    fetchIntervalMinutes: formData.get("fetchIntervalMinutes") || 60,
  });
  await prisma.rssFeed.create({
    data: { ...parsed, isEnabled: formData.get("isEnabled") === "on" },
  });
  revalidatePath("/admin/rss");
}

export async function updateFeedAction(formData: FormData) {
  await requireFeedManager();
  const id = formData.get("id") as string;
  const parsed = feedSchema
    .omit({ url: true })
    .extend({ isEnabled: z.boolean() })
    .parse({
      name: formData.get("name"),
      categoryId: formData.get("categoryId"),
      autoPublish: formData.get("autoPublish") === "on",
      isPressRelease: formData.get("isPressRelease") === "on",
      isEnabled: formData.get("isEnabled") === "on",
      fetchLimit: formData.get("fetchLimit") || 10,
      fetchIntervalMinutes: formData.get("fetchIntervalMinutes") || 60,
    });
  await prisma.rssFeed.update({ where: { id }, data: parsed });
  revalidatePath("/admin/rss");
}

export async function deleteFeedAction(formData: FormData) {
  await requireFeedManager();
  const id = formData.get("id") as string;
  await prisma.rssFeed.delete({ where: { id } });
  revalidatePath("/admin/rss");
}

/** 「今すぐ取得」ボタン */
export async function fetchFeedNowAction(formData: FormData) {
  await requireFeedManager();
  const id = formData.get("id") as string;
  const feed = await prisma.rssFeed.findUnique({ where: { id } });
  if (!feed) return;
  try {
    await importFeed(feed);
  } catch (e) {
    console.error("[rss] manual fetch failed:", e);
  }
  revalidatePath("/admin/rss");
  revalidatePath("/admin/articles");
}

/** マスター記事生成ジョブを手動実行する(ローカル検証・臨時実行用) */
export async function runDailyRewriteAction(): Promise<void> {
  await requireFeedManager();
  const { generateMasterArticles } = await import("@/lib/generate");
  const summary = await generateMasterArticles();
  console.log("[generate] manual run:", summary);
  revalidatePath("/admin/rss");
  revalidatePath("/admin/articles");
}
