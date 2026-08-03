import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import {
  decideWinnerAction,
  issueAwardAction,
  saveRewardCatalogAction,
} from "../../community-actions";

export const dynamic = "force-dynamic";

/** プライズ管理(§9): サイクル・候補・受賞確定・コード発行記録・賞品カタログ */
export default async function PrizeAdminPage() {
  const session = await auth();
  if (
    !session?.user ||
    (session.user.role !== "admin" && session.user.role !== "editor")
  ) {
    redirect("/admin");
  }
  const t = await getTranslations("admin.prize");

  const [judgingCycles, awards, catalog] = await Promise.all([
    prisma.prizeCycle.findMany({
      where: { status: { in: ["judging", "open"] } },
      orderBy: { startAt: "desc" },
      take: 5,
    }),
    prisma.prizeAward.findMany({
      orderBy: { createdAt: "desc" },
      take: 20,
      include: {
        user: { select: { name: true, email: true } },
        post: { select: { id: true } },
        cycle: true,
      },
    }),
    prisma.rewardCatalog.findMany({ orderBy: { region: "asc" } }),
  ]);

  // 各サイクルの投票上位
  const leadersByCycle = new Map<
    string,
    { postId: string; votes: number; title: string; author: string }[]
  >();
  for (const cycle of judgingCycles) {
    const grouped = await prisma.fanPostVote.groupBy({
      by: ["postId"],
      where: { cycleId: cycle.id },
      _count: { postId: true },
      orderBy: { _count: { postId: "desc" } },
      take: 5,
    });
    const posts = await prisma.fanPost.findMany({
      where: { id: { in: grouped.map((g) => g.postId) } },
      include: {
        author: { select: { name: true } },
        series: { select: { titleJa: true } },
      },
    });
    const byId = new Map(posts.map((p) => [p.id, p]));
    leadersByCycle.set(
      cycle.id,
      grouped.flatMap((g) => {
        const post = byId.get(g.postId);
        if (!post) return [];
        return [
          {
            postId: g.postId,
            votes: g._count.postId,
            title: `${post.series.titleJa} (${post.type})`,
            author: post.author.name,
          },
        ];
      })
    );
  }

  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-black">{t("title")}</h1>

      {/* サイクルと受賞確定(最終決定は編集部の審査。§9.1) */}
      <h2 className="mt-6 text-lg font-bold">{t("cycles")}</h2>
      <div className="mt-3 flex flex-col gap-3">
        {judgingCycles.length === 0 ? (
          <p className="py-6 text-center text-gray">{t("empty")}</p>
        ) : (
          judgingCycles.map((cycle) => (
            <div key={cycle.id} className="rounded-lg border border-line bg-bg p-3">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="font-bold">
                  {cycle.startAt.toISOString().slice(0, 10)} 〜{" "}
                  {cycle.endAt.toISOString().slice(0, 10)}
                </span>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                    cycle.status === "judging"
                      ? "bg-amber-100 text-amber-800"
                      : "bg-green-100 text-green-800"
                  }`}
                >
                  {cycle.status}
                </span>
              </div>
              <ul className="mt-2 divide-y divide-line text-sm">
                {(leadersByCycle.get(cycle.id) ?? []).map((leader) => (
                  <li
                    key={leader.postId}
                    className="flex flex-wrap items-center gap-2 py-2"
                  >
                    <span className="font-medium">{leader.title}</span>
                    <span className="text-xs text-gray">{leader.author}</span>
                    <span className="text-xs text-gray">
                      {t("votes", { count: leader.votes })}
                    </span>
                    {cycle.status === "judging" ? (
                      <form action={decideWinnerAction} className="ml-auto flex items-center gap-1.5">
                        <input type="hidden" name="cycleId" value={cycle.id} />
                        <input type="hidden" name="postId" value={leader.postId} />
                        <input
                          name="region"
                          placeholder="region"
                          defaultValue="global"
                          className="w-20 rounded border border-line bg-bg px-2 py-1 text-xs"
                        />
                        <button
                          type="submit"
                          className="rounded bg-primary px-3 py-1 text-xs font-bold text-white hover:bg-primary-dark"
                        >
                          🏆 {t("decide")}
                        </button>
                      </form>
                    ) : null}
                  </li>
                ))}
                {(leadersByCycle.get(cycle.id) ?? []).length === 0 ? (
                  <li className="py-2 text-xs text-gray">{t("noVotes")}</li>
                ) : null}
              </ul>
            </div>
          ))
        )}
      </div>

      {/* 発行記録(初期リリースは手動でコード発行・送付。§9.2) */}
      <h2 className="mt-8 text-lg font-bold">{t("awards")}</h2>
      <div className="mt-3 overflow-x-auto rounded-lg border border-line bg-bg">
        <table className="w-full min-w-[560px] text-sm">
          <thead>
            <tr className="border-b border-line bg-bg-sub text-left text-xs text-gray">
              <th className="px-3 py-2 font-medium">{t("columns.week")}</th>
              <th className="px-3 py-2 font-medium">{t("columns.winner")}</th>
              <th className="px-3 py-2 font-medium">{t("columns.reward")}</th>
              <th className="px-3 py-2 font-medium">{t("columns.code")}</th>
              <th className="px-3 py-2 font-medium">{t("columns.status")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {awards.map((award) => (
              <tr key={award.id}>
                <td className="px-3 py-2 font-mono text-xs">
                  {award.cycle.startAt.toISOString().slice(0, 10)}
                </td>
                <td className="px-3 py-2">
                  {award.user.name}
                  <span className="block text-xs text-gray">{award.user.email}</span>
                </td>
                <td className="px-3 py-2 text-xs">
                  {award.provider} {award.amount} {award.currency} ({award.region})
                </td>
                <td className="px-3 py-2">
                  <form action={issueAwardAction} className="flex items-center gap-1.5">
                    <input type="hidden" name="id" value={award.id} />
                    <input
                      name="code"
                      defaultValue={award.code ?? ""}
                      placeholder="gift code"
                      className="w-32 rounded border border-line bg-bg px-2 py-1 font-mono text-xs"
                    />
                    <label className="flex items-center gap-1 text-[10px] text-gray">
                      <input
                        type="checkbox"
                        name="markSent"
                        defaultChecked={Boolean(award.sentAt)}
                      />
                      {t("sent")}
                    </label>
                    <button
                      type="submit"
                      className="rounded border border-line px-2 py-1 text-xs hover:border-primary hover:text-primary"
                    >
                      {t("save")}
                    </button>
                  </form>
                </td>
                <td className="px-3 py-2 text-xs">{award.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 賞品カタログ(地域→賞品のマッピング。ハードコードしない。§9.2) */}
      <h2 className="mt-8 text-lg font-bold">{t("catalog")}</h2>
      <div className="mt-3 flex flex-col gap-2">
        {catalog.map((r) => (
          <form
            key={r.id}
            action={saveRewardCatalogAction}
            className="flex flex-wrap items-center gap-2 rounded-lg border border-line bg-bg p-2.5 text-sm"
          >
            <input type="hidden" name="id" value={r.id} />
            <input name="region" defaultValue={r.region} className="w-20 rounded border border-line bg-bg px-2 py-1" />
            <input name="provider" defaultValue={r.provider} className="w-32 rounded border border-line bg-bg px-2 py-1" />
            <input name="productName" defaultValue={r.productName} className="w-48 rounded border border-line bg-bg px-2 py-1" />
            <input name="amount" type="number" defaultValue={r.amount} className="w-20 rounded border border-line bg-bg px-2 py-1" />
            <input name="currency" defaultValue={r.currency} className="w-16 rounded border border-line bg-bg px-2 py-1" />
            <label className="flex items-center gap-1 text-xs">
              <input type="checkbox" name="isActive" defaultChecked={r.isActive} />
              {t("active")}
            </label>
            <button
              type="submit"
              className="ml-auto rounded bg-primary px-3 py-1 text-xs font-bold text-white hover:bg-primary-dark"
            >
              {t("save")}
            </button>
          </form>
        ))}
        <form
          action={saveRewardCatalogAction}
          className="flex flex-wrap items-center gap-2 rounded-lg border border-dashed border-line bg-bg-sub p-2.5 text-sm"
        >
          <input name="region" placeholder="region (en/ko/zh-Hant/th/zh-Hans/global)" className="w-40 rounded border border-line bg-bg px-2 py-1" required />
          <input name="provider" placeholder="provider" className="w-32 rounded border border-line bg-bg px-2 py-1" required />
          <input name="productName" placeholder="product" className="w-48 rounded border border-line bg-bg px-2 py-1" required />
          <input name="amount" type="number" placeholder="amount" className="w-20 rounded border border-line bg-bg px-2 py-1" required />
          <input name="currency" placeholder="USD" className="w-16 rounded border border-line bg-bg px-2 py-1" required />
          <label className="flex items-center gap-1 text-xs">
            <input type="checkbox" name="isActive" defaultChecked />
            {t("active")}
          </label>
          <button
            type="submit"
            className="ml-auto rounded bg-primary px-3 py-1 text-xs font-bold text-white hover:bg-primary-dark"
          >
            {t("add")}
          </button>
        </form>
      </div>
    </div>
  );
}
