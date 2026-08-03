import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import {
  bulkVerifyTermsAction,
  deleteTermAction,
  saveTermAction,
  setTermStatusAction,
} from "../../glossary-actions";
import { fromDbLocale, PUBLIC_DB_LOCALES } from "@/lib/locale";
import type { Prisma, TermStatus, TermType } from "@prisma/client";

export const dynamic = "force-dynamic";

const TYPES: TermType[] = [
  "series", "character", "person", "studio", "company",
  "event", "product", "music", "term",
];
const STATUSES: TermStatus[] = ["pending", "verified", "locked", "deprecated"];

const STATUS_STYLES: Record<TermStatus, string> = {
  pending: "bg-amber-100 text-amber-800",
  verified: "bg-green-100 text-green-800",
  locked: "bg-blue-100 text-blue-800",
  deprecated: "bg-gray-200 text-gray-500",
};

/** 用語辞書(§5.4): 検索・pendingキュー・一括承認・ロケール別確定表記 */
export default async function GlossaryPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; type?: string; page?: string }>;
}) {
  const session = await auth();
  if (
    !session?.user ||
    (session.user.role !== "admin" && session.user.role !== "editor")
  ) {
    redirect("/admin");
  }
  const t = await getTranslations("admin.glossary");
  const { q, status, type, page: pageParam } = await searchParams;
  const page = Math.max(1, parseInt(pageParam ?? "1", 10) || 1);
  const perPage = 20;

  const where: Prisma.TermWhereInput = {
    ...(status && STATUSES.includes(status as TermStatus)
      ? { status: status as TermStatus }
      : {}),
    ...(type && TYPES.includes(type as TermType)
      ? { type: type as TermType }
      : {}),
    ...(q
      ? {
          OR: [
            { nameJa: { contains: q } },
            { romaji: { contains: q, mode: "insensitive" as const } },
            { forms: { some: { value: { contains: q, mode: "insensitive" as const } } } },
            { aliases: { some: { value: { contains: q } } } },
          ],
        }
      : {}),
  };

  const [terms, total, pendingCount] = await Promise.all([
    prisma.term.findMany({
      where,
      orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
      skip: (page - 1) * perPage,
      take: perPage,
      include: { forms: true, aliases: true },
    }),
    prisma.term.count({ where }),
    prisma.term.count({ where: { status: "pending" } }),
  ]);

  return (
    <div className="max-w-5xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-black">{t("title")}</h1>
        <span className="rounded-full bg-amber-100 px-3 py-1 text-sm font-bold text-amber-800">
          {t("pendingCount", { count: pendingCount })}
        </span>
      </div>

      <form method="get" className="mt-4 flex flex-wrap items-center gap-2 text-sm">
        <input
          type="search"
          name="q"
          defaultValue={q ?? ""}
          placeholder={t("searchPlaceholder")}
          className="rounded border border-line bg-bg px-3 py-1.5"
        />
        <select name="status" defaultValue={status ?? ""} className="rounded border border-line bg-bg px-2 py-1.5">
          <option value="">{t("allStatuses")}</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {t(`status.${s}`)}
            </option>
          ))}
        </select>
        <select name="type" defaultValue={type ?? ""} className="rounded border border-line bg-bg px-2 py-1.5">
          <option value="">{t("allTypes")}</option>
          {TYPES.map((tp) => (
            <option key={tp} value={tp}>
              {t(`type.${tp}`)}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="rounded border border-line bg-bg px-3 py-1.5 font-medium hover:border-primary hover:text-primary"
        >
          →
        </button>
      </form>

      {/* 一括承認(チェックボックスは form 属性でこのフォームに紐付く) */}
      <form id="bulk-verify" action={bulkVerifyTermsAction} className="mt-4">
        <div className="flex items-center gap-2 rounded-lg border border-line bg-bg px-3 py-2 text-sm">
          <button
            type="submit"
            className="rounded bg-green-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-green-700"
          >
            ✓ {t("bulkVerify")}
          </button>
          <span className="text-xs text-gray">{t("bulkHint")}</span>
        </div>
      </form>

      <div className="mt-3 flex flex-col gap-3">
          {terms.map((term) => (
            <div key={term.id} className="rounded-lg border border-line bg-bg p-3">
              <div className="flex flex-wrap items-center gap-2">
                <input type="checkbox" name="ids" value={term.id} form="bulk-verify" aria-label={term.nameJa} />
                <span className="text-lg font-black">{term.nameJa}</span>
                {term.readingJa ? (
                  <span className="text-xs text-gray">({term.readingJa})</span>
                ) : null}
                <span className="rounded-sm bg-bg-sub px-1.5 py-0.5 text-[11px] font-bold text-gray">
                  {t(`type.${term.type}`)}
                </span>
                <span
                  className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${STATUS_STYLES[term.status]}`}
                >
                  {t(`status.${term.status}`)}
                </span>
                {term.doNotTranslate ? (
                  <span className="rounded-sm border border-line px-1.5 py-0.5 text-[10px] text-gray">
                    {t("doNotTranslate")}
                  </span>
                ) : null}
                {term.sourceUrl ? (
                  <a
                    href={term.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-primary underline"
                  >
                    {t("source")}
                  </a>
                ) : null}
              </div>
              <div className="mt-2 grid gap-1 text-sm sm:grid-cols-2 lg:grid-cols-5">
                {PUBLIC_DB_LOCALES.map((l) => {
                  const form = term.forms.find((f) => f.locale === l);
                  return (
                    <div key={l} className="flex items-center gap-1.5">
                      <span className="w-14 shrink-0 font-mono text-[11px] text-gray">
                        {fromDbLocale(l)}
                      </span>
                      <span className={form ? "" : "text-gray/50"}>
                        {form?.value ?? "—"}
                        {form?.isOfficial ? (
                          <span className="ml-1 text-[10px] text-green-700">✓官方</span>
                        ) : null}
                      </span>
                    </div>
                  );
                })}
              </div>
              {term.aliases.length > 0 ? (
                <p className="mt-1.5 text-xs text-gray">
                  {t("aliases")}: {term.aliases.map((a) => a.value).join(" / ")}
                </p>
              ) : null}
              <details className="mt-2">
                <summary className="cursor-pointer text-xs font-medium text-primary">
                  {t("edit")}
                </summary>
                <TermForm term={term} labels={{ save: t("save") }} />
                <div className="mt-2 flex flex-wrap gap-2">
                  {STATUSES.filter((s) => s !== term.status).map((s) => (
                    <form key={s} action={setTermStatusAction}>
                      <input type="hidden" name="id" value={term.id} />
                      <input type="hidden" name="status" value={s} />
                      <button
                        type="submit"
                        className="rounded border border-line px-2 py-1 text-xs hover:border-primary hover:text-primary"
                      >
                        → {t(`status.${s}`)}
                      </button>
                    </form>
                  ))}
                  <form action={deleteTermAction}>
                    <input type="hidden" name="id" value={term.id} />
                    <button
                      type="submit"
                      className="rounded border border-line px-2 py-1 text-xs text-gray hover:border-breaking hover:text-breaking"
                    >
                      {t("delete")}
                    </button>
                  </form>
                </div>
              </details>
            </div>
          ))}
      </div>

      {total > perPage ? (
        <p className="mt-4 text-center text-sm text-gray">
          {page} / {Math.ceil(total / perPage)}
        </p>
      ) : null}

      <h2 className="mt-8 text-lg font-bold">{t("add")}</h2>
      <TermForm labels={{ save: t("add") }} />
    </div>
  );
}

function TermForm({
  term,
  labels,
}: {
  term?: {
    id: string;
    type: TermType;
    nameJa: string;
    readingJa: string | null;
    romaji: string;
    notes: string | null;
    sourceUrl: string | null;
    doNotTranslate: boolean;
    forms: { locale: string; value: string; isOfficial: boolean; sourceUrl: string | null }[];
    aliases: { value: string }[];
  };
  labels: { save: string };
}) {
  return (
    <form
      action={saveTermAction}
      className="mt-3 flex flex-col gap-2 rounded-lg border border-line bg-bg-sub p-3 text-sm"
    >
      {term ? <input type="hidden" name="id" value={term.id} /> : null}
      <div className="flex flex-wrap items-center gap-2">
        <select name="type" defaultValue={term?.type ?? "series"} className="rounded border border-line bg-bg px-2 py-1.5">
          {TYPES.map((tp) => (
            <option key={tp} value={tp}>
              {tp}
            </option>
          ))}
        </select>
        <input
          name="nameJa"
          defaultValue={term?.nameJa ?? ""}
          placeholder="正規表記(日本語)"
          required
          className="w-48 rounded border border-line bg-bg px-2 py-1.5"
        />
        <input
          name="readingJa"
          defaultValue={term?.readingJa ?? ""}
          placeholder="かな"
          className="w-36 rounded border border-line bg-bg px-2 py-1.5"
        />
        <input
          name="romaji"
          defaultValue={term?.romaji ?? ""}
          placeholder="romaji (hepburn)"
          className="w-44 rounded border border-line bg-bg px-2 py-1.5 font-mono text-xs"
        />
        <label className="flex items-center gap-1.5 text-xs">
          <input
            type="checkbox"
            name="doNotTranslate"
            defaultChecked={term?.doNotTranslate}
          />
          原語のまま
        </label>
      </div>
      <div className="grid gap-1.5 sm:grid-cols-2">
        {PUBLIC_DB_LOCALES.map((l) => {
          const form = term?.forms.find((f) => f.locale === l);
          return (
            <div key={l} className="flex items-center gap-1.5">
              <span className="w-14 shrink-0 font-mono text-[11px] text-gray">
                {fromDbLocale(l)}
              </span>
              <input
                name={`form_${l}`}
                defaultValue={form?.value ?? ""}
                className="min-w-0 flex-1 rounded border border-line bg-bg px-2 py-1"
              />
              <label className="flex items-center gap-1 text-[10px] text-gray">
                <input
                  type="checkbox"
                  name={`official_${l}`}
                  defaultChecked={form?.isOfficial}
                />
                官方
              </label>
            </div>
          );
        })}
      </div>
      <div className="flex flex-wrap gap-2">
        <input
          name="sourceUrl"
          defaultValue={term?.sourceUrl ?? ""}
          placeholder="一次情報URL"
          className="min-w-0 flex-1 rounded border border-line bg-bg px-2 py-1.5 text-xs"
        />
        <input
          name="notes"
          defaultValue={term?.notes ?? ""}
          placeholder="備考(同名作品の区別など)"
          className="min-w-0 flex-1 rounded border border-line bg-bg px-2 py-1.5 text-xs"
        />
      </div>
      <textarea
        name="aliases"
        defaultValue={term?.aliases.map((a) => a.value).join("\n") ?? ""}
        placeholder="エイリアス・略称・誤記(1行1つ)"
        rows={2}
        className="rounded border border-line bg-bg px-2 py-1.5 text-xs"
      />
      <button
        type="submit"
        className="self-start rounded bg-primary px-4 py-1.5 text-xs font-bold text-white hover:bg-primary-dark"
      >
        {labels.save}
      </button>
    </form>
  );
}

