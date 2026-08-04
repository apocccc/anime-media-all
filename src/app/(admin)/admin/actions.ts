"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { z } from "zod";
import { auth, canEditArticle, canPublish, isStaff, signIn, signOut } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { articleSlug, isValidArticleSlug, slugify } from "@/lib/slug";
import { revalidateArticle } from "@/lib/revalidate";
import { articlePath } from "@/lib/site";
import { queueArticleTranslations } from "@/lib/translate";
import { enqueueJob } from "@/lib/jobs";
import { ALL_DB_LOCALES, PUBLIC_DB_LOCALES } from "@/lib/locale";
import type { ArticleStatus, Locale as DbLocale } from "@prisma/client";

async function requireUser() {
  const session = await auth();
  if (!session?.user) redirect("/admin/login");
  return session.user;
}

async function requireStaff() {
  const user = await requireUser();
  if (!isStaff(user)) redirect("/admin/login");
  return user;
}

async function requireArticleAccess(articleId: string) {
  const user = await requireStaff();
  const article = await prisma.article.findUnique({
    where: { id: articleId },
    include: { category: true },
  });
  if (!article) throw new Error("Article not found");
  if (!canEditArticle(user, article)) throw new Error("Forbidden");
  return { user, article };
}

/* ---------- ログイン ---------- */

export async function loginAction(
  _prev: { error: boolean },
  formData: FormData
): Promise<{ error: boolean }> {
  const email = formData.get("email");
  try {
    await signIn("credentials", {
      email,
      password: formData.get("password"),
      redirect: false,
    });
  } catch {
    return { error: true };
  }

  // 管理画面の表示言語(プロフィール設定)をクッキーへ同期
  if (typeof email === "string") {
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      select: { adminLocale: true },
    });
    if (user) {
      const store = await cookies();
      store.set("ADMIN_LOCALE", user.adminLocale, { path: "/" });
    }
  }
  redirect("/admin");
}

export async function logoutAction() {
  await signOut({ redirect: false });
  redirect("/admin/login");
}

export async function setAdminLocaleAction(locale: string) {
  const user = await requireUser();
  const parsed = z.enum(["ja", "en"]).safeParse(locale);
  if (!parsed.success) return;
  await prisma.user.update({
    where: { id: user.id },
    data: { adminLocale: parsed.data },
  });
  const store = await cookies();
  store.set("ADMIN_LOCALE", parsed.data, { path: "/" });
  revalidatePath("/admin", "layout");
}

/* ---------- 記事 ---------- */

export async function createArticleAction() {
  const user = await requireStaff();
  const category = await prisma.category.findFirst({
    where: { isVisible: true, slug: { notIn: ["latest", "fan"] } },
    orderBy: { order: "asc" },
  });
  if (!category) throw new Error("No category available");

  const article = await prisma.article.create({
    data: {
      slug: articleSlug(`draft-${Date.now().toString(36)}`),
      status: "draft",
      kind: "editorial",
      masterLocale: "ja",
      categoryId: category.id,
      authorId: user.id,
      translations: {
        create: {
          locale: "ja",
          title: "",
          lead: "",
          body: { type: "doc", content: [{ type: "paragraph" }] },
          status: "approved",
          translatedBy: "human",
        },
      },
    },
  });
  redirect(`/admin/articles/${article.id}`);
}

const saveSchema = z.object({
  id: z.string(),
  locale: z.enum(["ja", "en", "ko", "zh_Hant", "th", "zh_Hans"]),
  title: z.string().max(300),
  lead: z.string().max(500),
  slug: z.string(),
  body: z.any(),
  categoryId: z.string(),
  tags: z.string(),
  isBreaking: z.boolean(),
  isPinned: z.boolean(),
  heroImageId: z.string().nullable(),
  publishAt: z.string().nullable(),
});

export type SaveArticleInput = z.infer<typeof saveSchema>;

export async function saveArticleAction(input: SaveArticleInput) {
  const parsed = saveSchema.parse(input);
  const { user, article } = await requireArticleAccess(parsed.id);

  // 公開後のスラッグ変更不可(§2.4)。未公開時の変更は許可、
  // 公開済みで変更された場合は全ロケール分の 301 を Redirect に自動登録
  let slug = article.slug;
  if (parsed.slug !== article.slug) {
    const requested = isValidArticleSlug(parsed.slug)
      ? parsed.slug
      : articleSlug(slugify(parsed.slug) || article.slug.slice(9));
    if (article.status === "published") {
      const category = await prisma.category.findUnique({
        where: { id: parsed.categoryId },
      });
      await prisma.redirect.upsert({
        where: { fromPath: articlePath(article.category.slug, article.slug) },
        create: {
          fromPath: articlePath(article.category.slug, article.slug),
          toPath: articlePath(category?.slug ?? article.category.slug, requested),
        },
        update: {
          toPath: articlePath(category?.slug ?? article.category.slug, requested),
        },
      });
    }
    slug = requested;
  }

  // カテゴリー移動時も旧URLから301
  if (
    article.status === "published" &&
    parsed.categoryId !== article.categoryId
  ) {
    const newCategory = await prisma.category.findUnique({
      where: { id: parsed.categoryId },
    });
    if (newCategory) {
      await prisma.redirect.upsert({
        where: { fromPath: articlePath(article.category.slug, article.slug) },
        create: {
          fromPath: articlePath(article.category.slug, article.slug),
          toPath: articlePath(newCategory.slug, slug),
        },
        update: { toPath: articlePath(newCategory.slug, slug) },
      });
    }
  }

  // タグ: カンマ区切り文字列を upsert して張り替え
  const tagNames = parsed.tags
    .split(/[,、,]/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 20);
  const tagIds: string[] = [];
  for (const name of tagNames) {
    const tagSlug =
      slugify(name) || `tag-${Buffer.from(name).toString("hex").slice(0, 12)}`;
    const tag = await prisma.tag.upsert({
      where: { slug: tagSlug },
      create: { slug: tagSlug, name },
      update: { name },
    });
    tagIds.push(tag.id);
  }

  const updated = await prisma.article.update({
    where: { id: parsed.id },
    data: {
      slug,
      categoryId: parsed.categoryId,
      isBreaking: parsed.isBreaking,
      isPinned: parsed.isPinned,
      heroImageId: parsed.heroImageId || null,
      publishAt: parsed.publishAt ? new Date(parsed.publishAt) : null,
      tags: {
        deleteMany: {},
        create: tagIds.map((tagId) => ({ tagId })),
      },
    },
    include: { category: true },
  });

  // 当該ロケールの翻訳本文を保存。人手編集は translatedBy: human。
  // マスター(ja)は approved、他ロケールは人手修正時点で approved 扱い
  const translation = await prisma.articleTranslation.upsert({
    where: { articleId_locale: { articleId: parsed.id, locale: parsed.locale } },
    create: {
      articleId: parsed.id,
      locale: parsed.locale,
      title: parsed.title,
      lead: parsed.lead,
      body: parsed.body,
      status: "approved",
      translatedBy: "human",
      reviewedById: user.id,
      reviewedAt: new Date(),
    },
    update: {
      title: parsed.title,
      lead: parsed.lead,
      body: parsed.body,
      status: "approved",
      translatedBy: "human",
      reviewedById: user.id,
      reviewedAt: new Date(),
    },
  });

  // リビジョン(保存ごとのスナップショット。ArticleTranslation 単位)
  await prisma.revision.create({
    data: {
      translationId: translation.id,
      editedBy: user.id,
      snapshot: {
        title: parsed.title,
        lead: parsed.lead,
        body: parsed.body,
      },
    },
  });

  if (updated.status === "published") {
    revalidateArticle(updated.category.slug, updated.slug);
  }

  return { ok: true, slug: updated.slug };
}

export async function changeStatusAction(
  articleId: string,
  status: ArticleStatus
) {
  const { user, article } = await requireArticleAccess(articleId);

  if ((status === "published" || status === "archived") && !canPublish(user)) {
    throw new Error("Forbidden");
  }

  const data: {
    status: ArticleStatus;
    publishedAt?: Date;
    publishAt?: null;
  } = { status };
  if (status === "published" && !article.publishedAt) {
    data.publishedAt = new Date();
  }
  if (status === "published") {
    data.publishAt = null;
  }

  const updated = await prisma.article.update({
    where: { id: articleId },
    data,
    include: { category: true },
  });

  revalidateArticle(updated.category.slug, updated.slug);
  revalidatePath("/admin/articles");
  return { ok: true, status: updated.status };
}

/**
 * プレスリリースの事後却下(2026-08 指示: 申請は即時公開 → 不適切なものを後から却下)。
 * 原文PR(press_release)と、そこから派生したAI記事(derivatives)をまとめて archived にする。
 */
export async function rejectPressReleaseAction(articleId: string) {
  const { user, article } = await requireArticleAccess(articleId);
  if (!canPublish(user)) throw new Error("Forbidden");

  const targets = await prisma.article.findMany({
    where: { OR: [{ id: articleId }, { derivedFromId: articleId }] },
    include: { category: true },
  });
  for (const t of targets) {
    await prisma.article.update({
      where: { id: t.id },
      data: { status: "archived", publishAt: null },
    });
    revalidateArticle(t.category.slug, t.slug);
  }

  revalidateArticle(article.category.slug, article.slug);
  revalidatePath("/admin/articles");
  return { ok: true, archived: targets.length };
}

/** 翻訳キュー投入(マスター確定後に全公開ロケールへ) */
export async function queueTranslationsAction(articleId: string) {
  await requireArticleAccess(articleId);
  const queued = await queueArticleTranslations(articleId);
  revalidatePath(`/admin/articles/${articleId}`);
  return { ok: true, queued };
}

/** 翻訳の承認(needs_review / machine → approved) */
export async function approveTranslationAction(
  articleId: string,
  locale: DbLocale
) {
  const { user, article } = await requireArticleAccess(articleId);
  await prisma.articleTranslation.update({
    where: { articleId_locale: { articleId, locale } },
    data: { status: "approved", reviewedById: user.id, reviewedAt: new Date() },
  });
  revalidateArticle(article.category.slug, article.slug);
  revalidatePath(`/admin/articles/${articleId}`);
  return { ok: true };
}

/** 個別ロケールの再翻訳をジョブキューへ */
export async function retranslateAction(articleId: string, locale: DbLocale) {
  await requireArticleAccess(articleId);
  await enqueueJob(
    "translate_article",
    { articleId, locale },
    `translate:${articleId}:${locale}:${Date.now()}`
  );
  revalidatePath(`/admin/articles/${articleId}`);
  return { ok: true };
}

/** 翻訳オプトアウト(excluded = そのロケールでは記事を存在させない) */
export async function excludeTranslationAction(
  articleId: string,
  locale: DbLocale,
  excluded: boolean
) {
  const { article } = await requireArticleAccess(articleId);
  if (excluded) {
    await prisma.articleTranslation.upsert({
      where: { articleId_locale: { articleId, locale } },
      create: {
        articleId,
        locale,
        title: "",
        lead: "",
        body: { type: "doc", content: [] },
        status: "excluded",
      },
      update: { status: "excluded" },
    });
  } else {
    await prisma.articleTranslation.updateMany({
      where: { articleId, locale, status: "excluded" },
      data: { status: "pending" },
    });
  }
  revalidateArticle(article.category.slug, article.slug);
  revalidatePath(`/admin/articles/${articleId}`);
  return { ok: true };
}

/**
 * 記事一覧の一括操作。選択した記事のステータスをまとめて変更する。
 */
export async function bulkStatusAction(formData: FormData) {
  const user = await requireStaff();

  const ids = formData.getAll("ids").map(String).filter(Boolean).slice(0, 100);
  const action = z
    .enum(["publish", "draft", "archive", "queueTranslations"])
    .parse(formData.get("bulkAction"));
  if (ids.length === 0) return;

  if ((action === "publish" || action === "archive") && !canPublish(user)) {
    throw new Error("Forbidden");
  }

  const articles = await prisma.article.findMany({
    where: {
      id: { in: ids },
      // author/contributor は自分の記事のみ対象
      ...(user.role === "admin" || user.role === "editor"
        ? {}
        : { authorId: user.id }),
    },
    include: {
      category: true,
      translations: { select: { locale: true, status: true } },
    },
  });

  for (const article of articles) {
    if (action === "queueTranslations") {
      await queueArticleTranslations(article.id);
      continue;
    }
    if (action === "publish") {
      if (article.status === "published") continue;
      // 誤公開ガード: マスター(ja)が確定していない生ソースは対象外
      const master = article.translations.find(
        (t) => t.locale === "ja" && t.status === "approved"
      );
      if (!master && article.sourceFeedId) continue;
      await prisma.article.update({
        where: { id: article.id },
        data: {
          status: "published",
          publishedAt: article.publishedAt ?? new Date(),
          publishAt: null,
        },
      });
      revalidateArticle(article.category.slug, article.slug);
    } else if (action === "draft") {
      if (article.status === "draft") continue;
      await prisma.article.update({
        where: { id: article.id },
        data: { status: "draft", publishAt: null },
      });
      if (article.status === "published") {
        revalidateArticle(article.category.slug, article.slug);
      }
    } else {
      if (article.status === "archived") continue;
      await prisma.article.update({
        where: { id: article.id },
        data: { status: "archived", publishAt: null },
      });
      if (article.status === "published") {
        revalidateArticle(article.category.slug, article.slug);
      }
    }
  }

  revalidatePath("/admin/articles");
}

export async function deleteArticleAction(articleId: string) {
  const { article } = await requireArticleAccess(articleId);
  await prisma.article.delete({ where: { id: articleId } });
  if (article.status === "published") {
    revalidateArticle(article.category.slug, article.slug);
  }
  redirect("/admin/articles");
}

export async function restoreRevisionAction(revisionId: string) {
  const revision = await prisma.revision.findUnique({
    where: { id: revisionId },
    include: { translation: true },
  });
  if (!revision) throw new Error("Revision not found");
  await requireArticleAccess(revision.translation.articleId);

  const snapshot = revision.snapshot as {
    title?: string;
    lead?: string;
    body?: unknown;
  };
  await prisma.articleTranslation.update({
    where: { id: revision.translationId },
    data: {
      title: snapshot.title ?? "",
      lead: snapshot.lead ?? "",
      body: (snapshot.body ?? { type: "doc" }) as object,
    },
  });
  revalidatePath(`/admin/articles/${revision.translation.articleId}`);
}

/* ---------- カテゴリー ---------- */

const categorySchema = z.object({
  id: z.string().optional(),
  slug: z
    .string()
    .regex(/^[a-z0-9][a-z0-9-]*$/)
    .max(50),
  order: z.coerce.number().int(),
  isVisible: z.boolean(),
});

export async function saveCategoryAction(formData: FormData) {
  const user = await requireStaff();
  if (user.role !== "admin" && user.role !== "editor") {
    throw new Error("Forbidden");
  }
  const parsed = categorySchema.parse({
    id: (formData.get("id") as string) || undefined,
    slug: formData.get("slug"),
    order: formData.get("order"),
    isVisible: formData.get("isVisible") === "on",
  });

  // 6ロケール分の表示名(name_{locale})
  const names: { locale: DbLocale; name: string }[] = [];
  for (const locale of ALL_DB_LOCALES) {
    const value = formData.get(`name_${locale}`);
    if (typeof value === "string" && value.trim()) {
      names.push({ locale, name: value.trim().slice(0, 60) });
    }
  }

  const category = parsed.id
    ? await prisma.category.update({
        where: { id: parsed.id },
        data: { order: parsed.order, isVisible: parsed.isVisible },
      })
    : await prisma.category.create({
        data: {
          slug: parsed.slug,
          order: parsed.order,
          isVisible: parsed.isVisible,
        },
      });

  for (const { locale, name } of names) {
    await prisma.categoryTranslation.upsert({
      where: { categoryId_locale: { categoryId: category.id, locale } },
      create: { categoryId: category.id, locale, name },
      update: { name },
    });
  }

  revalidatePath("/admin/categories");
  revalidatePath("/", "layout");
}

/* ---------- 手動実行(生成) ---------- */

export async function runGenerateAction() {
  const user = await requireStaff();
  if (user.role !== "admin" && user.role !== "editor") {
    throw new Error("Forbidden");
  }
  const { generateMasterArticles } = await import("@/lib/generate");
  const summary = await generateMasterArticles();
  revalidatePath("/admin/articles");
  return summary;
}

/** ダッシュボード等から全ロケール一覧に使う */
export async function listPublicLocalesAction() {
  return PUBLIC_DB_LOCALES;
}
