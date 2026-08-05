import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { moderateOrganizationAction } from "../../community-actions";

export const dynamic = "force-dynamic";

/** 事業者管理(§7.1): 審査・信頼フラグ(autoApprove) */
export default async function PartnersPage() {
  const session = await auth();
  if (
    !session?.user ||
    (session.user.role !== "admin" && session.user.role !== "editor")
  ) {
    redirect("/admin");
  }
  const t = await getTranslations("admin.partners");

  const organizations = await prisma.organization.findMany({
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    include: {
      members: { select: { name: true, email: true } },
      _count: { select: { articles: true } },
    },
  });

  const STATUS_STYLES: Record<string, string> = {
    pending: "bg-amber-100 text-amber-800",
    approved: "bg-green-100 text-green-800",
    suspended: "bg-gray-200 text-gray-600",
  };

  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-black">{t("title")}</h1>

      <div className="mt-6 flex flex-col gap-3">
        {organizations.length === 0 ? (
          <p className="py-10 text-center text-gray">{t("empty")}</p>
        ) : (
          organizations.map((org) => (
            <div key={org.id} className="rounded-lg border border-line bg-bg p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-lg font-black">{org.name}</span>
                <span className="font-mono text-xs text-gray">/{org.slug}</span>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-bold ${STATUS_STYLES[org.status]}`}
                >
                  {t(`status.${org.status}`)}
                </span>
                {org.autoApprove ? (
                  <span className="rounded-sm bg-blue-100 px-1.5 py-0.5 text-[11px] font-bold text-blue-800">
                    {t("trusted")}
                  </span>
                ) : null}
                <span className="text-xs text-gray">
                  {t("prCount", { count: org._count.articles })}
                </span>
              </div>
              {org.websiteUrl ? (
                <p className="mt-1 text-xs">
                  <a
                    href={org.websiteUrl}
                    target="_blank"
                    rel="noreferrer nofollow"
                    className="text-primary underline"
                  >
                    {org.websiteUrl}
                  </a>
                </p>
              ) : null}
              <p className="mt-1 text-xs text-gray">
                {org.members.map((m) => `${m.name} <${m.email}>`).join(", ") ||
                  t("noMembers")}
                {org.contactEmail ? ` / ${org.contactEmail}` : ""}
              </p>
              <div className="mt-2 flex flex-wrap gap-2 border-t border-line pt-2">
                {org.status !== "approved" ? (
                  <OrgActionButton id={org.id} action="approve" label={`✓ ${t("approve")}`} primary />
                ) : null}
                {org.status !== "suspended" ? (
                  <OrgActionButton id={org.id} action="suspend" label={t("suspend")} />
                ) : null}
                {org.autoApprove ? (
                  <OrgActionButton id={org.id} action="untrust" label={t("untrust")} />
                ) : (
                  <OrgActionButton id={org.id} action="trust" label={t("trust")} />
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function OrgActionButton({
  id,
  action,
  label,
  primary = false,
}: {
  id: string;
  action: string;
  label: string;
  primary?: boolean;
}) {
  return (
    <form action={moderateOrganizationAction}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="orgAction" value={action} />
      <button
        type="submit"
        className={
          primary
            ? "rounded bg-green-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-green-700"
            : "rounded border border-line px-3 py-1.5 text-xs hover:border-primary hover:text-primary"
        }
      >
        {label}
      </button>
    </form>
  );
}
