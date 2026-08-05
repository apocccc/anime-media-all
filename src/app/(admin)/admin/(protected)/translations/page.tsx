import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { auth, isStaff } from "@/lib/auth";
import { approveTranslationBulkAction } from "../../community-actions";
import { fromDbLocale } from "@/lib/locale";

export const dynamic = "force-dynamic";

/** 翻訳キュー: needs_review / machine の滞留一覧と一括承認 */
export default async function TranslationsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const session = await auth();
  if (!session?.user || !isStaff(session.user)) redirect("/admin/login");
  const t = await getTranslations("admin.translations");
  const { status } = await searchParams;
  const filterStatus =
    status === "machine" ? ("machine" as const) : ("needs_review" as const);

  const translations = await prisma.articleTranslation.findMany({
    where: { status: filterStatus },
    orderBy: { updatedAt: "desc" },
    take: 50,
    include: {
      article: {
        select: {
          id: true,
          slug: true,
          translations: {
            where: { locale: "ja" },
            select: { title: true },
          },
        },
      },
    },
  });

  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-black">{t("title")}</h1>

      <div className="mt-4 flex gap-2 text-sm">
        <Link
          href="/admin/translations"
          className={`rounded-full px-4 py-1.5 font-bold ${
            filterStatus === "needs_review"
              ? "bg-amber-500 text-white"
              : "border border-line text-gray"
          }`}
        >
          {t("needsReview")}
        </Link>
        <Link
          href="/admin/translations?status=machine"
          className={`rounded-full px-4 py-1.5 font-bold ${
            filterStatus === "machine"
              ? "bg-blue-500 text-white"
              : "border border-line text-gray"
          }`}
        >
          {t("machine")}
        </Link>
      </div>

      <form action={approveTranslationBulkAction} className="mt-4">
        <div className="flex items-center gap-2 rounded-lg border border-line bg-bg px-3 py-2 text-sm">
          <button
            type="submit"
            className="rounded bg-green-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-green-700"
          >
            ✓ {t("bulkApprove")}
          </button>
        </div>

        <div className="mt-3 overflow-x-auto rounded-lg border border-line bg-bg">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b border-line bg-bg-sub text-left text-xs text-gray">
                <th className="w-8 px-3 py-2.5" />
                <th className="px-4 py-2.5 font-medium">{t("columns.article")}</th>
                <th className="px-4 py-2.5 font-medium">{t("columns.locale")}</th>
                <th className="px-4 py-2.5 font-medium">{t("columns.translatedTitle")}</th>
                <th className="px-4 py-2.5 font-medium">{t("columns.updatedAt")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {translations.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-gray">
                    {t("empty")}
                  </td>
                </tr>
              ) : (
                translations.map((tr) => (
                  <tr key={tr.id} className="hover:bg-bg-sub/60">
                    <td className="px-3 py-2.5">
                      <input type="checkbox" name="ids" value={tr.id} />
                    </td>
                    <td className="px-4 py-2.5">
                      <Link
                        href={`/admin/articles/${tr.articleId}?locale=${tr.locale}`}
                        className="line-clamp-1 font-medium hover:text-primary"
                      >
                        {tr.article.translations[0]?.title || tr.article.slug}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5 font-mono text-xs">
                      {fromDbLocale(tr.locale)}
                    </td>
                    <td className="px-4 py-2.5 text-gray">
                      <span className="line-clamp-1">{tr.title}</span>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-gray">
                      {tr.updatedAt.toISOString().slice(0, 16).replace("T", " ")}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </form>
    </div>
  );
}
