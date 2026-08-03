import { getTranslations } from "next-intl/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { FanPostForm } from "@/components/my/FanPostForm";

export const dynamic = "force-dynamic";

/** 会員マイページ: プロフィール + 自分の投稿 + 新規投稿 */
export default async function MyPage() {
  const session = await auth();
  const t = await getTranslations("my");

  if (!session?.user) {
    return (
      <div className="rounded-lg border border-line bg-bg p-8 text-center">
        <h1 className="text-xl font-black">{t("title")}</h1>
        <p className="mt-2 text-sm text-gray">{t("signInPrompt")}</p>
        {/* ロケール外ルートへの遷移のため <a> を使用 */}
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a
          href="/api/auth/signin"
          className="mt-5 inline-block rounded bg-primary px-6 py-2 text-sm font-bold text-white hover:bg-primary-dark"
        >
          {t("signIn")}
        </a>
      </div>
    );
  }

  const [user, myPosts, seriesList] = await Promise.all([
    prisma.user.findUnique({ where: { id: session.user.id } }),
    prisma.fanPost.findMany({
      where: { authorId: session.user.id },
      orderBy: { createdAt: "desc" },
      take: 30,
      include: { series: { select: { titleJa: true, slug: true } } },
    }),
    prisma.series.findMany({
      where: { status: "approved" },
      orderBy: { titleJa: "asc" },
      select: { id: true, titleJa: true, slug: true },
    }),
  ]);

  return (
    <div>
      <h1 className="text-2xl font-black">{t("title")}</h1>
      <p className="mt-1 text-sm text-gray">
        {user?.name} ({user?.email}) — {user?.role}
      </p>

      <section className="mt-6 rounded-lg border border-line bg-bg p-5">
        <h2 className="text-lg font-bold">{t("newPost")}</h2>
        <p className="mt-1 text-xs text-gray">{t("moderationNote")}</p>
        <FanPostForm
          seriesOptions={seriesList.map((s) => ({ id: s.id, label: s.titleJa }))}
          hasBirthMonth={Boolean(user?.birthMonth)}
        />
      </section>

      <h2 className="mt-8 text-lg font-bold">{t("myPosts")}</h2>
      <ul className="mt-3 divide-y divide-line rounded-lg border border-line bg-bg">
        {myPosts.length === 0 ? (
          <li className="px-4 py-8 text-center text-sm text-gray">
            {t("empty")}
          </li>
        ) : (
          myPosts.map((post) => (
            <li key={post.id} className="flex items-center gap-3 px-4 py-3 text-sm">
              <span className="rounded-sm bg-bg-sub px-1.5 py-0.5 text-[11px] font-bold text-gray">
                {post.type}
              </span>
              <span className="min-w-0 flex-1 truncate">
                {post.series.titleJa}
                {post.bodyOriginal ? ` — ${post.bodyOriginal.slice(0, 60)}` : ""}
              </span>
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                  post.status === "approved"
                    ? "bg-green-100 text-green-800"
                    : post.status === "pending"
                      ? "bg-amber-100 text-amber-800"
                      : "bg-gray-200 text-gray-600"
                }`}
              >
                {t(`status.${post.status}`)}
              </span>
              {post.status === "rejected" && post.rejectReason ? (
                <span className="text-xs text-gray">{post.rejectReason}</span>
              ) : null}
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
