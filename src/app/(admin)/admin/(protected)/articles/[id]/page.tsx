import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { auth, canEditArticle, canPublish, isStaff } from "@/lib/auth";
import { ArticleEditor } from "@/components/admin/ArticleEditor";
import { previewToken } from "@/lib/preview";
import { ALL_DB_LOCALES, fromDbLocale } from "@/lib/locale";
import type { Locale as DbLocale } from "@prisma/client";

export const dynamic = "force-dynamic";

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-bg-sub text-gray",
  machine: "bg-blue-100 text-blue-800",
  needs_review: "bg-amber-100 text-amber-800",
  approved: "bg-green-100 text-green-800",
  failed: "bg-red-100 text-red-800",
  excluded: "bg-gray-200 text-gray-500 line-through",
};

/** 編集画面: マスター(ja)と各ロケールをタブ切替(§12) */
export default async function ArticleEditPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ locale?: string }>;
}) {
  const session = await auth();
  if (!session?.user || !isStaff(session.user)) redirect("/admin/login");
  const { id } = await params;
  const { locale: localeParam } = await searchParams;
  const editingLocale: DbLocale = ALL_DB_LOCALES.includes(
    localeParam as DbLocale
  )
    ? (localeParam as DbLocale)
    : "ja";

  const t = await getTranslations("admin");
  const [article, categories] = await Promise.all([
    prisma.article.findUnique({
      where: { id },
      include: {
        category: true,
        heroImage: true,
        tags: { include: { tag: true } },
        translations: true,
        sources: true,
      },
    }),
    prisma.category.findMany({
      where: { slug: { notIn: ["latest", "fan"] } },
      orderBy: { order: "asc" },
      include: { translations: true },
    }),
  ]);

  if (!article) notFound();
  if (!canEditArticle(session.user, article)) redirect("/admin/articles");

  const translation = article.translations.find(
    (tr) => tr.locale === editingLocale
  );
  const revisions = translation
    ? await prisma.revision.findMany({
        where: { translationId: translation.id },
        orderBy: { createdAt: "desc" },
        take: 10,
        include: { editor: { select: { name: true } } },
      })
    : [];

  const primarySource = article.sources.find((s) => s.isPrimary) ?? article.sources[0];

  return (
    <div>
      {/* ロケールタブ(ja = マスター) */}
      <div className="mb-4 flex flex-wrap items-center gap-1 border-b border-line">
        {ALL_DB_LOCALES.map((l) => {
          const tr = article.translations.find((x) => x.locale === l);
          const isActive = l === editingLocale;
          return (
            <Link
              key={l}
              href={`/admin/articles/${id}?locale=${l}`}
              className={`flex items-center gap-1.5 rounded-t-md border border-b-0 px-3 py-1.5 text-sm font-bold ${
                isActive
                  ? "border-line bg-bg text-primary"
                  : "border-transparent text-gray hover:text-ink"
              }`}
            >
              {l === "ja" ? "ja ★" : fromDbLocale(l)}
              <span
                className={`rounded-full px-1.5 py-px text-[10px] font-medium ${STATUS_STYLES[tr?.status ?? "pending"]}`}
              >
                {tr ? t(`translationStatus.${tr.status}`) : t("translationStatus.pending")}
              </span>
            </Link>
          );
        })}
      </div>

      <ArticleEditor
        article={{
          id: article.id,
          slug: article.slug,
          status: article.status,
          kind: article.kind,
          categoryId: article.categoryId,
          categorySlug: article.category.slug,
          tags: article.tags.map((x) => x.tag.name).join(", "),
          isBreaking: article.isBreaking,
          isPinned: article.isPinned,
          heroImageId: article.heroImageId,
          heroImageUrl: article.heroImage?.url ?? null,
          publishAt: article.publishAt?.toISOString() ?? null,
          sourceName: primarySource?.name ?? null,
          isRssImported: Boolean(article.sourceFeedId),
        }}
        translation={{
          locale: editingLocale,
          title: translation?.title ?? "",
          lead: translation?.lead ?? "",
          body: translation?.body ?? {
            type: "doc",
            content: [{ type: "paragraph" }],
          },
          status: translation?.status ?? "pending",
          translatedBy: translation?.translatedBy ?? null,
          isMaster: editingLocale === article.masterLocale,
        }}
        categories={categories.map((c) => ({
          id: c.id,
          slug: c.slug,
          name:
            c.translations.find((x) => x.locale === "ja")?.name ??
            c.translations.find((x) => x.locale === "en")?.name ??
            c.slug,
        }))}
        revisions={revisions.map((r) => ({
          id: r.id,
          createdAt: r.createdAt.toISOString(),
          editorName: r.editor.name,
        }))}
        canPublish={canPublish(session.user)}
        previewToken={previewToken(article.id)}
      />
    </div>
  );
}
