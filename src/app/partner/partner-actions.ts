"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { auth, signIn } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { articleSlug, slugify } from "@/lib/slug";
import { verifyTurnstile } from "@/lib/turnstile";
import { queueArticleTranslations } from "@/lib/translate";
import { PUBLIC_DB_LOCALES } from "@/lib/locale";
import type { Locale as DbLocale } from "@prisma/client";

/**
 * 事業者ポータル(§7.1)。
 * 登録 → 管理者審査(Organization.status: pending → approved)→ 投稿可能。
 * 信頼済み(autoApprove)は即時公開、それ以外は編集部レビューへ。
 */

const registerSchema = z.object({
  companyName: z.string().min(1).max(200),
  websiteUrl: z.string().url().max(500),
  contactName: z.string().min(1).max(100),
  email: z.string().email(),
  password: z.string().min(8),
});

export async function registerPartnerAction(
  _prev: { error: string | null },
  formData: FormData
): Promise<{ error: string | null }> {
  if (!(await verifyTurnstile(formData.get("cf-turnstile-response") as string | null))) {
    return { error: "turnstile" };
  }
  let parsed;
  try {
    parsed = registerSchema.parse({
      companyName: formData.get("companyName"),
      websiteUrl: formData.get("websiteUrl"),
      contactName: formData.get("contactName"),
      email: formData.get("email"),
      password: formData.get("password"),
    });
  } catch {
    return { error: "invalid" };
  }

  const email = parsed.email.toLowerCase();
  if (await prisma.user.findUnique({ where: { email } })) {
    return { error: "email_taken" };
  }

  const orgSlugBase = slugify(parsed.companyName) || "company";
  let orgSlug = orgSlugBase;
  for (
    let i = 2;
    await prisma.organization.findUnique({ where: { slug: orgSlug } });
    i++
  ) {
    orgSlug = `${orgSlugBase}-${i}`;
  }

  const userSlugBase = slugify(parsed.contactName) || "partner";
  let userSlug = userSlugBase;
  for (let i = 2; await prisma.user.findUnique({ where: { slug: userSlug } }); i++) {
    userSlug = `${userSlugBase}-${i}`;
  }

  await prisma.organization.create({
    data: {
      slug: orgSlug,
      name: parsed.companyName,
      status: "pending",
      websiteUrl: parsed.websiteUrl,
      contactEmail: email,
      members: {
        create: {
          email,
          name: parsed.contactName,
          slug: userSlug,
          role: "partner",
          passwordHash: await bcrypt.hash(parsed.password, 12),
        },
      },
    },
  });

  // 登録後そのままログイン
  await signIn("credentials", {
    email,
    password: parsed.password,
    redirect: false,
  });
  redirect("/partner");
}

export async function partnerLoginAction(
  _prev: { error: boolean },
  formData: FormData
): Promise<{ error: boolean }> {
  try {
    await signIn("credentials", {
      email: formData.get("email"),
      password: formData.get("password"),
      redirect: false,
    });
  } catch {
    return { error: true };
  }
  redirect("/partner");
}

const submitSchema = z.object({
  title: z.string().min(1).max(300),
  body: z.string().min(1).max(50000),
  lead: z.string().max(500),
  originalLocale: z.enum(["ja", "en", "ko", "zh_Hant", "th", "zh_Hans"]),
  // all = AI翻訳して全言語 / none = 投稿言語のみ / それ以外 = 個別選択
  translationMode: z.enum(["all", "none", "custom"]),
  embargoAt: z.string().optional(),
  contact: z.string().max(500).optional(),
});

/** プレスリリース投稿(§7.1)。翻訳オプション必須要件を含む */
export async function submitPressReleaseAction(
  _prev: { error: string | null; ok: boolean },
  formData: FormData
): Promise<{ error: string | null; ok: boolean }> {
  const session = await auth();
  if (!session?.user || session.user.role !== "partner") {
    return { error: "unauthorized", ok: false };
  }
  if (!(await verifyTurnstile(formData.get("cf-turnstile-response") as string | null))) {
    return { error: "turnstile", ok: false };
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: { organization: true },
  });
  const org = user?.organization;
  if (!org || org.status !== "approved") {
    return { error: "org_not_approved", ok: false };
  }

  let parsed;
  try {
    parsed = submitSchema.parse({
      title: formData.get("title"),
      body: formData.get("body"),
      lead: (formData.get("lead") as string) ?? "",
      originalLocale: formData.get("originalLocale"),
      translationMode: formData.get("translationMode"),
      embargoAt: (formData.get("embargoAt") as string) || undefined,
      contact: (formData.get("contact") as string) || undefined,
    });
  } catch {
    return { error: "invalid", ok: false };
  }

  const category = await prisma.category.findUnique({
    where: { slug: "press-release" },
  });
  if (!category) return { error: "no_category", ok: false };

  // 個別選択された翻訳先ロケール
  const customLocales = PUBLIC_DB_LOCALES.filter(
    (l) => formData.get(`translate_${l}`) === "on"
  );

  const bodyDoc = {
    type: "doc",
    content: parsed.body
      .split(/\n{2,}/)
      .map((p) => p.trim())
      .filter(Boolean)
      .map((p) =>
        p.startsWith("## ")
          ? {
              type: "heading",
              attrs: { level: 2 },
              content: [{ type: "text", text: p.slice(3).trim() }],
            }
          : {
              type: "paragraph",
              content: [{ type: "text", text: p }],
            }
      ),
  };

  const embargoAt = parsed.embargoAt ? new Date(parsed.embargoAt) : null;
  const slug = articleSlug(
    slugify(parsed.title) || `pr-${Date.now().toString(36)}`,
    embargoAt ?? new Date()
  );

  const article = await prisma.article.create({
    data: {
      slug,
      // 承認フロー: submitted(review)→ scheduled/published。信頼済みは即時
      status: org.autoApprove ? (embargoAt ? "scheduled" : "published") : "review",
      publishAt: embargoAt,
      publishedAt: org.autoApprove && !embargoAt ? new Date() : null,
      kind: "press_release",
      masterLocale: parsed.originalLocale,
      organizationId: org.id,
      pressContact: parsed.contact ?? null,
      categoryId: category.id,
      authorId: session.user.id,
      translations: {
        create: [
          {
            locale: parsed.originalLocale,
            title: parsed.title,
            lead: parsed.lead,
            body: bodyDoc,
            status: "approved",
            translatedBy: "human",
          },
          // 翻訳不要 or 個別選択で外れたロケールは excluded として存在させない
          ...PUBLIC_DB_LOCALES.filter((l) => l !== parsed.originalLocale)
            .filter((l) =>
              parsed.translationMode === "none"
                ? true
                : parsed.translationMode === "custom"
                  ? !customLocales.includes(l)
                  : false
            )
            .map((locale: DbLocale) => ({
              locale,
              title: "",
              lead: "",
              body: { type: "doc", content: [] },
              status: "excluded" as const,
            })),
        ],
      },
    },
  });

  // AI翻訳対象のロケールをキューへ(excluded はジョブ側でスキップされる)
  if (parsed.translationMode !== "none") {
    await queueArticleTranslations(article.id);
  }

  revalidatePath("/partner");
  return { error: null, ok: true };
}
