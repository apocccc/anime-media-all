import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * ダッシュボード(§12): 公開本数、翻訳キュー滞留、needs_review、
 * pending 用語、モデレーション待ち、PR承認待ち、ジョブ失敗を常時表示。
 */
export default async function AdminDashboard() {
  const session = await auth();
  const t = await getTranslations("admin.dashboard");

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const startOfWeek = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [
    publishedToday,
    publishedThisWeek,
    inReview,
    drafts,
    queuedJobs,
    failedJobs,
    pendingTerms,
    moderationQueue,
    partnerQueue,
    topArticles,
    reviewQueue,
    recentDrafts,
  ] = await Promise.all([
    prisma.article.count({
      where: { status: "published", publishedAt: { gte: startOfDay } },
    }),
    prisma.article.count({
      where: { status: "published", publishedAt: { gte: startOfWeek } },
    }),
    prisma.article.count({ where: { status: "review" } }),
    prisma.article.count({ where: { status: "draft" } }),
    prisma.job.count({ where: { status: { in: ["queued", "running"] } } }),
    prisma.job.count({ where: { status: "failed" } }),
    prisma.term.count({ where: { status: "pending" } }),
    prisma.fanPost.count({ where: { status: "pending" } }),
    prisma.organization.count({ where: { status: "pending" } }),
    prisma.article.findMany({
      where: { status: "published" },
      orderBy: { viewCount: "desc" },
      take: 5,
      select: {
        id: true,
        viewCount: true,
        translations: {
          where: { locale: "ja" },
          select: { title: true },
        },
      },
    }),
    prisma.article.findMany({
      where: { status: "review" },
      orderBy: { updatedAt: "desc" },
      take: 5,
      select: {
        id: true,
        author: { select: { name: true } },
        translations: { where: { locale: "ja" }, select: { title: true } },
      },
    }),
    prisma.article.findMany({
      where: {
        status: "draft",
        ...(session?.user.role === "admin" || session?.user.role === "editor"
          ? {}
          : { authorId: session?.user.id }),
      },
      orderBy: { updatedAt: "desc" },
      take: 5,
      select: {
        id: true,
        translations: { where: { locale: "ja" }, select: { title: true } },
      },
    }),
  ]);

  const stats = [
    { label: t("publishedToday"), value: publishedToday, href: "/admin/articles?status=published" },
    { label: t("publishedThisWeek"), value: publishedThisWeek, href: "/admin/articles?status=published" },
    { label: t("inReview"), value: inReview, href: "/admin/articles?status=review" },
    { label: t("drafts"), value: drafts, href: "/admin/articles?status=draft" },
  ];

  const monitors = [
    { label: t("translationQueue"), value: queuedJobs, href: "/admin/jobs", warn: false },
    { label: t("pendingTerms"), value: pendingTerms, href: "/admin/glossary?status=pending", warn: pendingTerms > 0 },
    { label: t("moderationQueue"), value: moderationQueue, href: "/admin/moderation", warn: moderationQueue > 0 },
    { label: t("partnerQueue"), value: partnerQueue, href: "/admin/partners", warn: partnerQueue > 0 },
    { label: t("failedJobs"), value: failedJobs, href: "/admin/jobs?status=failed", warn: failedJobs > 0 },
  ];

  return (
    <div>
      <h1 className="text-2xl font-black">{t("title")}</h1>

      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((s) => (
          <Link key={s.label} href={s.href} className="rounded-lg border border-line bg-bg p-4 hover:border-primary">
            <p className="text-xs font-medium text-gray">{s.label}</p>
            <p className="mt-1 text-3xl font-black text-primary">{s.value}</p>
          </Link>
        ))}
      </div>

      {/* 監視: キュー滞留・失敗 */}
      <div className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-6">
        {monitors.map((m) => (
          <Link
            key={m.label}
            href={m.href}
            className={`rounded-lg border p-3 hover:border-primary ${
              m.warn ? "border-amber-300 bg-amber-50" : "border-line bg-bg"
            }`}
          >
            <p className="text-[11px] font-medium text-gray">{m.label}</p>
            <p
              className={`mt-0.5 text-xl font-black ${m.warn ? "text-amber-700" : "text-ink"}`}
            >
              {m.value}
            </p>
          </Link>
        ))}
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        <Panel title={t("topArticles")}>
          {topArticles.length === 0 ? (
            <Empty label={t("empty")} />
          ) : (
            <ul className="divide-y divide-line">
              {topArticles.map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-2 py-2">
                  <Link
                    href={`/admin/articles/${a.id}`}
                    className="line-clamp-1 text-sm font-medium hover:text-primary"
                  >
                    {a.translations[0]?.title || "—"}
                  </Link>
                  <span className="shrink-0 text-xs text-gray">
                    {a.viewCount.toLocaleString()} {t("views")}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel title={t("reviewQueue")}>
          {reviewQueue.length === 0 ? (
            <Empty label={t("empty")} />
          ) : (
            <ul className="divide-y divide-line">
              {reviewQueue.map((a) => (
                <li key={a.id} className="py-2">
                  <Link
                    href={`/admin/articles/${a.id}`}
                    className="line-clamp-1 text-sm font-medium hover:text-primary"
                  >
                    {a.translations[0]?.title || "—"}
                  </Link>
                  <p className="text-xs text-gray">{a.author.name}</p>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel title={t("recentDrafts")}>
          {recentDrafts.length === 0 ? (
            <Empty label={t("empty")} />
          ) : (
            <ul className="divide-y divide-line">
              {recentDrafts.map((a) => (
                <li key={a.id} className="py-2">
                  <Link
                    href={`/admin/articles/${a.id}`}
                    className="line-clamp-1 text-sm font-medium hover:text-primary"
                  >
                    {a.translations[0]?.title || "—"}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-line bg-bg p-4">
      <h2 className="text-sm font-bold">{title}</h2>
      <div className="mt-2">{children}</div>
    </section>
  );
}

function Empty({ label }: { label: string }) {
  return <p className="py-4 text-center text-sm text-gray">{label}</p>;
}
