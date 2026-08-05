import { getTranslations } from "next-intl/server";
import Image from "next/image";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { moderateFanPostAction } from "../../community-actions";
import { fromDbLocale } from "@/lib/locale";

export const dynamic = "force-dynamic";

/** モデレーション(§8.2): AIスコア付きの人手承認キュー + 監査ログ */
export default async function ModerationPage() {
  const session = await auth();
  if (
    !session?.user ||
    (session.user.role !== "admin" && session.user.role !== "editor")
  ) {
    redirect("/admin");
  }
  const t = await getTranslations("admin.moderation");

  const [pending, recentLogs] = await Promise.all([
    prisma.fanPost.findMany({
      where: { status: "pending" },
      orderBy: { createdAt: "asc" },
      take: 30,
      include: {
        author: { select: { name: true, role: true } },
        series: { select: { titleJa: true } },
      },
    }),
    prisma.moderationLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 20,
      include: { actor: { select: { name: true } } },
    }),
  ]);

  const mediaIds = [...new Set(pending.flatMap((p) => p.mediaIds.slice(0, 1)))];
  const media = await prisma.media.findMany({ where: { id: { in: mediaIds } } });
  const mediaById = new Map(media.map((m) => [m.id, m.url]));

  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-black">{t("title")}</h1>

      <div className="mt-6 flex flex-col gap-3">
        {pending.length === 0 ? (
          <p className="py-10 text-center text-gray">{t("empty")}</p>
        ) : (
          pending.map((post) => {
            const scores = (post.aiModerationScore ?? {}) as Record<string, unknown>;
            const firstMedia = post.mediaIds[0]
              ? mediaById.get(post.mediaIds[0])
              : null;
            return (
              <div key={post.id} className="rounded-lg border border-line bg-bg p-3">
                <div className="flex gap-4">
                  {firstMedia ? (
                    <div className="relative h-28 w-28 shrink-0 overflow-hidden rounded-md bg-bg-sub">
                      <Image src={firstMedia} alt="" fill sizes="112px" className="object-cover" />
                    </div>
                  ) : null}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-gray">
                      <span className="rounded-sm bg-bg-sub px-1.5 py-0.5 font-bold">
                        {post.type}
                      </span>
                      <span>{post.series.titleJa}</span>
                      <span>
                        {post.author.name}
                        {post.author.role === "influencer" ? " ★" : ""}
                      </span>
                      <span className="font-mono">
                        {fromDbLocale(post.originalLocale)}
                      </span>
                    </div>
                    <p className="mt-1.5 line-clamp-3 whitespace-pre-wrap text-sm">
                      {post.bodyOriginal || post.embedUrl}
                    </p>
                    {Object.keys(scores).length > 0 ? (
                      <p className="mt-1.5 font-mono text-[11px] text-gray">
                        AI:{" "}
                        {Object.entries(scores)
                          .filter(([k]) => k !== "reason")
                          .map(([k, v]) => `${k}=${v}`)
                          .join(" ")}
                        {typeof scores.reason === "string" && scores.reason
                          ? ` — ${scores.reason}`
                          : ""}
                      </p>
                    ) : null}
                  </div>
                </div>
                <form
                  action={moderateFanPostAction}
                  className="mt-2 flex flex-wrap items-center gap-2 border-t border-line pt-2"
                >
                  <input type="hidden" name="id" value={post.id} />
                  <input
                    name="reason"
                    placeholder={t("reasonPlaceholder")}
                    className="min-w-0 flex-1 rounded border border-line bg-bg px-2 py-1.5 text-xs"
                  />
                  <button
                    type="submit"
                    name="moderation"
                    value="approve"
                    className="rounded bg-green-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-green-700"
                  >
                    ✓ {t("approve")}
                  </button>
                  <button
                    type="submit"
                    name="moderation"
                    value="reject"
                    className="rounded bg-breaking px-3 py-1.5 text-xs font-bold text-white hover:opacity-80"
                  >
                    ✗ {t("reject")}
                  </button>
                </form>
              </div>
            );
          })
        )}
      </div>

      <h2 className="mt-10 text-lg font-bold">{t("auditLog")}</h2>
      <ul className="mt-3 divide-y divide-line rounded-lg border border-line bg-bg text-sm">
        {recentLogs.map((log) => (
          <li key={log.id} className="flex flex-wrap items-center gap-2 px-3 py-2">
            <span className="font-mono text-xs text-gray">
              {log.createdAt.toISOString().slice(0, 16).replace("T", " ")}
            </span>
            <span className="rounded-sm bg-bg-sub px-1.5 py-0.5 text-[11px] font-bold">
              {log.targetType}
            </span>
            <span className="font-medium">{log.action}</span>
            {log.reason ? (
              <span className="text-xs text-gray">{log.reason}</span>
            ) : null}
            <span className="ml-auto text-xs text-gray">
              {log.actor?.name ?? "AI"}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
