import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PressReleaseForm } from "@/components/partner/PressReleaseForm";

export const dynamic = "force-dynamic";

/** 事業者ダッシュボード: 自社PR一覧 + 投稿フォーム */
export default async function PartnerHome() {
  const session = await auth();
  const t = await getTranslations("partner");

  if (!session?.user || session.user.role !== "partner") {
    return (
      <div className="rounded-lg border border-line bg-bg p-8 text-center">
        <h1 className="text-xl font-black">{t("title")}</h1>
        <p className="mt-2 text-sm text-gray">{t("intro")}</p>
        <div className="mt-5 flex justify-center gap-3">
          <Link
            href="/partner/login"
            className="rounded bg-primary px-5 py-2 text-sm font-bold text-white hover:bg-primary-dark"
          >
            {t("login")}
          </Link>
          <Link
            href="/partner/register"
            className="rounded border border-primary px-5 py-2 text-sm font-bold text-primary hover:bg-primary-light"
          >
            {t("register")}
          </Link>
        </div>
      </div>
    );
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: { organization: true },
  });
  const org = user?.organization;

  if (!org) {
    return (
      <p className="rounded-lg border border-line bg-bg p-8 text-center text-gray">
        {t("noOrganization")}
      </p>
    );
  }

  const releases = await prisma.article.findMany({
    where: { organizationId: org.id, kind: "press_release" },
    orderBy: { createdAt: "desc" },
    take: 30,
    include: { translations: true },
  });

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black">{org.name}</h1>
          <p className="mt-0.5 text-sm text-gray">
            {t(`orgStatus.${org.status}`)}
            {org.autoApprove ? ` · ${t("trusted")}` : ""}
          </p>
        </div>
        <Link
          href={`/en/press/${org.slug}`}
          className="text-sm text-primary underline underline-offset-2"
        >
          {t("publicPage")} →
        </Link>
      </div>

      {org.status === "pending" ? (
        <p className="mt-4 rounded-md bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {t("pendingNotice")}
        </p>
      ) : null}
      {org.status === "suspended" ? (
        <p className="mt-4 rounded-md bg-red-50 px-4 py-3 text-sm text-red-800">
          {t("suspendedNotice")}
        </p>
      ) : null}

      {org.status === "approved" ? (
        <section className="mt-6 rounded-lg border border-line bg-bg p-5">
          <h2 className="text-lg font-bold">{t("submit.title")}</h2>
          <PressReleaseForm />
        </section>
      ) : null}

      <h2 className="mt-8 text-lg font-bold">{t("myReleases")}</h2>
      <ul className="mt-3 divide-y divide-line rounded-lg border border-line bg-bg">
        {releases.length === 0 ? (
          <li className="px-4 py-8 text-center text-sm text-gray">
            {t("empty")}
          </li>
        ) : (
          releases.map((r) => {
            const master = r.translations.find((x) => x.locale === r.masterLocale);
            return (
              <li key={r.id} className="flex items-center gap-3 px-4 py-3 text-sm">
                <span className="min-w-0 flex-1 truncate font-medium">
                  {master?.title || r.slug}
                </span>
                <span className="rounded-full bg-bg-sub px-2 py-0.5 text-xs font-bold text-gray">
                  {t(`status.${r.status}`)}
                </span>
                <span className="font-mono text-xs text-gray">
                  {r.createdAt.toISOString().slice(0, 10)}
                </span>
              </li>
            );
          })
        )}
      </ul>
    </div>
  );
}
