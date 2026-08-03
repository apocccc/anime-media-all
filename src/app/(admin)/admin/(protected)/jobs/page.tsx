import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { deleteJobAction, retryJobAction } from "../../community-actions";
import type { JobStatus, Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

const STATUSES: JobStatus[] = ["queued", "running", "done", "failed"];

/** ジョブキュー監視: dead-letter(failed)の再実行・削除(§4.3) */
export default async function JobsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const session = await auth();
  if (
    !session?.user ||
    (session.user.role !== "admin" && session.user.role !== "editor")
  ) {
    redirect("/admin");
  }
  const t = await getTranslations("admin.jobs");
  const { status } = await searchParams;

  const where: Prisma.JobWhereInput = STATUSES.includes(status as JobStatus)
    ? { status: status as JobStatus }
    : { status: { in: ["queued", "running", "failed"] } };

  const jobs = await prisma.job.findMany({
    where,
    orderBy: { updatedAt: "desc" },
    take: 50,
  });

  const STATUS_STYLES: Record<JobStatus, string> = {
    queued: "bg-bg-sub text-gray",
    running: "bg-blue-100 text-blue-800",
    done: "bg-green-100 text-green-800",
    failed: "bg-red-100 text-red-800",
  };

  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-black">{t("title")}</h1>

      <div className="mt-4 flex gap-2 text-sm">
        <Link
          href="/admin/jobs"
          className={`rounded-full px-3 py-1.5 font-bold ${!status ? "bg-primary text-white" : "border border-line text-gray"}`}
        >
          {t("active")}
        </Link>
        {STATUSES.map((s) => (
          <Link
            key={s}
            href={`/admin/jobs?status=${s}`}
            className={`rounded-full px-3 py-1.5 font-bold ${status === s ? "bg-primary text-white" : "border border-line text-gray"}`}
          >
            {s}
          </Link>
        ))}
      </div>

      <div className="mt-4 overflow-x-auto rounded-lg border border-line bg-bg">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-line bg-bg-sub text-left text-xs text-gray">
              <th className="px-3 py-2 font-medium">{t("columns.type")}</th>
              <th className="px-3 py-2 font-medium">{t("columns.payload")}</th>
              <th className="px-3 py-2 font-medium">{t("columns.status")}</th>
              <th className="px-3 py-2 font-medium">{t("columns.attempts")}</th>
              <th className="px-3 py-2 font-medium">{t("columns.error")}</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {jobs.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-gray">
                  {t("empty")}
                </td>
              </tr>
            ) : (
              jobs.map((job) => (
                <tr key={job.id}>
                  <td className="px-3 py-2 font-mono text-xs">{job.type}</td>
                  <td className="px-3 py-2 font-mono text-[11px] text-gray">
                    <span className="line-clamp-1 max-w-56">
                      {JSON.stringify(job.payload)}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-bold ${STATUS_STYLES[job.status]}`}
                    >
                      {job.status}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-xs">{job.attempts}</td>
                  <td className="px-3 py-2 text-[11px] text-gray">
                    <span className="line-clamp-2 max-w-64">{job.lastError}</span>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex gap-1.5">
                      <form action={retryJobAction}>
                        <input type="hidden" name="id" value={job.id} />
                        <button
                          type="submit"
                          className="rounded border border-line px-2 py-1 text-xs hover:border-primary hover:text-primary"
                        >
                          ↻
                        </button>
                      </form>
                      <form action={deleteJobAction}>
                        <input type="hidden" name="id" value={job.id} />
                        <button
                          type="submit"
                          className="rounded border border-line px-2 py-1 text-xs text-gray hover:border-breaking hover:text-breaking"
                        >
                          ✗
                        </button>
                      </form>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
