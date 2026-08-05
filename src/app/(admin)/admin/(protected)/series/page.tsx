import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { deleteSeriesAction, saveSeriesAction } from "../../community-actions";
import { ALL_DB_LOCALES, fromDbLocale } from "@/lib/locale";
import type { SeriesKind } from "@prisma/client";

export const dynamic = "force-dynamic";

const KINDS: SeriesKind[] = ["tv", "movie", "ova", "web", "other"];

/** 作品(Series)管理: 別名・公式リンク・放送情報(§12) */
export default async function SeriesAdminPage() {
  const session = await auth();
  if (
    !session?.user ||
    (session.user.role !== "admin" && session.user.role !== "editor")
  ) {
    redirect("/admin");
  }
  const t = await getTranslations("admin.series");

  const seriesList = await prisma.series.findMany({
    orderBy: { updatedAt: "desc" },
    take: 100,
    include: {
      translations: true,
      _count: { select: { articles: true, fanPosts: true } },
    },
  });

  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-black">{t("title")}</h1>

      <div className="mt-6 flex flex-col gap-3">
        {seriesList.map((s) => {
          const broadcast = (s.broadcast ?? {}) as {
            season?: string;
            broadcast?: string;
            episodes?: number;
          };
          const links = (s.links ?? {}) as { official?: string };
          return (
            <div key={s.id} className="rounded-lg border border-line bg-bg p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-lg font-black">{s.titleJa}</span>
                <span className="font-mono text-xs text-gray">/{s.slug}</span>
                <span className="rounded-sm bg-bg-sub px-1.5 py-0.5 text-[11px] font-bold text-gray">
                  {s.kind}
                </span>
                <span className="text-xs text-gray">
                  {t("counts", {
                    articles: s._count.articles,
                    fans: s._count.fanPosts,
                  })}
                </span>
              </div>
              <details className="mt-1.5">
                <summary className="cursor-pointer text-xs font-medium text-primary">
                  {t("edit")}
                </summary>
                <SeriesForm
                  series={{
                    id: s.id,
                    slug: s.slug,
                    kind: s.kind,
                    titleJa: s.titleJa,
                    officialUrl: links.official ?? "",
                    season: broadcast.season ?? "",
                    broadcast: broadcast.broadcast ?? "",
                    episodes: broadcast.episodes ? String(broadcast.episodes) : "",
                    translations: s.translations,
                  }}
                  submitLabel={t("save")}
                />
                <form action={deleteSeriesAction} className="mt-2">
                  <input type="hidden" name="id" value={s.id} />
                  <button
                    type="submit"
                    className="rounded border border-line px-2 py-1 text-xs text-gray hover:border-breaking hover:text-breaking"
                  >
                    {t("delete")}
                  </button>
                </form>
              </details>
            </div>
          );
        })}
      </div>

      <h2 className="mt-8 text-lg font-bold">{t("add")}</h2>
      <SeriesForm submitLabel={t("add")} />
    </div>
  );
}

function SeriesForm({
  series,
  submitLabel,
}: {
  series?: {
    id: string;
    slug: string;
    kind: SeriesKind;
    titleJa: string;
    officialUrl: string;
    season: string;
    broadcast: string;
    episodes: string;
    translations: { locale: string; title: string; synopsis: string }[];
  };
  submitLabel: string;
}) {
  return (
    <form
      action={saveSeriesAction}
      className="mt-3 flex flex-col gap-2 rounded-lg border border-line bg-bg-sub p-3 text-sm"
    >
      {series ? <input type="hidden" name="id" value={series.id} /> : null}
      <div className="flex flex-wrap items-center gap-2">
        <input
          name="titleJa"
          defaultValue={series?.titleJa ?? ""}
          placeholder="作品名(日本語)"
          required
          className="w-56 rounded border border-line bg-bg px-2 py-1.5"
        />
        <input
          name="slug"
          defaultValue={series?.slug ?? ""}
          placeholder="sousou-no-frieren"
          required
          pattern="[a-z0-9][a-z0-9-]*"
          className="w-52 rounded border border-line bg-bg px-2 py-1.5 font-mono text-xs"
        />
        <select
          name="kind"
          defaultValue={series?.kind ?? "tv"}
          className="rounded border border-line bg-bg px-2 py-1.5"
        >
          {KINDS.map((k) => (
            <option key={k} value={k}>
              {k}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <input
          name="officialUrl"
          defaultValue={series?.officialUrl ?? ""}
          placeholder="公式サイトURL"
          className="min-w-0 flex-1 rounded border border-line bg-bg px-2 py-1.5 text-xs"
        />
        <input
          name="season"
          defaultValue={series?.season ?? ""}
          placeholder="2024冬"
          className="w-28 rounded border border-line bg-bg px-2 py-1.5 text-xs"
        />
        <input
          name="broadcast"
          defaultValue={series?.broadcast ?? ""}
          placeholder="放送情報"
          className="w-48 rounded border border-line bg-bg px-2 py-1.5 text-xs"
        />
        <input
          name="episodes"
          defaultValue={series?.episodes ?? ""}
          placeholder="話数"
          className="w-16 rounded border border-line bg-bg px-2 py-1.5 text-xs"
        />
      </div>
      <div className="grid gap-1.5 sm:grid-cols-2">
        {ALL_DB_LOCALES.map((l) => (
          <label key={l} className="flex items-center gap-1.5 text-xs">
            <span className="w-14 shrink-0 font-mono text-gray">
              {fromDbLocale(l)}
            </span>
            <input
              name={`title_${l}`}
              defaultValue={
                series?.translations.find((x) => x.locale === l)?.title ?? ""
              }
              placeholder="タイトル"
              className="min-w-0 flex-1 rounded border border-line bg-bg px-2 py-1"
            />
          </label>
        ))}
      </div>
      <button
        type="submit"
        className="self-start rounded bg-primary px-4 py-1.5 text-xs font-bold text-white hover:bg-primary-dark"
      >
        {submitLabel}
      </button>
    </form>
  );
}
