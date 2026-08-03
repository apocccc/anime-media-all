import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { saveCategoryAction } from "../../actions";
import { ALL_DB_LOCALES, fromDbLocale } from "@/lib/locale";

export const dynamic = "force-dynamic";

/** カテゴリー管理: 表示名は6ロケール(ja + 公開5言語) */
export default async function CategoriesPage() {
  const session = await auth();
  if (
    !session?.user ||
    (session.user.role !== "admin" && session.user.role !== "editor")
  ) {
    redirect("/admin");
  }
  const t = await getTranslations("admin.categories");
  const categories = await prisma.category.findMany({
    orderBy: { order: "asc" },
    include: { translations: true },
  });

  const localeInputs = (
    translations?: { locale: string; name: string }[]
  ) => (
    <div className="grid w-full grid-cols-2 gap-1.5 sm:grid-cols-3">
      {ALL_DB_LOCALES.map((l) => (
        <label key={l} className="flex items-center gap-1 text-xs">
          <span className="w-14 shrink-0 font-mono text-gray">
            {fromDbLocale(l)}
          </span>
          <input
            name={`name_${l}`}
            defaultValue={translations?.find((x) => x.locale === l)?.name ?? ""}
            className="min-w-0 flex-1 rounded border border-line px-2 py-1"
          />
        </label>
      ))}
    </div>
  );

  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-black">{t("title")}</h1>

      <div className="mt-6 flex flex-col gap-3">
        {categories.map((c) => (
          <form
            key={c.id}
            action={saveCategoryAction}
            className="flex flex-col gap-2 rounded-lg border border-line bg-bg p-3 text-sm"
          >
            <input type="hidden" name="id" value={c.id} />
            <input type="hidden" name="slug" value={c.slug} />
            <div className="flex flex-wrap items-center gap-2">
              <span className="w-28 font-mono text-xs text-gray">{c.slug}</span>
              <input
                name="order"
                type="number"
                defaultValue={c.order}
                aria-label={t("order")}
                className="w-16 rounded border border-line px-2 py-1.5"
              />
              <label className="flex items-center gap-1.5">
                <input
                  type="checkbox"
                  name="isVisible"
                  defaultChecked={c.isVisible}
                />
                {t("visible")}
              </label>
              <button
                type="submit"
                className="ml-auto rounded bg-primary px-3 py-1.5 text-xs font-bold text-white hover:bg-primary-dark"
              >
                {t("save")}
              </button>
            </div>
            {localeInputs(c.translations)}
          </form>
        ))}
      </div>

      <h2 className="mt-8 text-lg font-bold">{t("add")}</h2>
      <form
        action={saveCategoryAction}
        className="mt-3 flex flex-col gap-2 rounded-lg border border-line bg-bg p-3 text-sm"
      >
        <div className="flex flex-wrap items-center gap-2">
          <input
            name="slug"
            placeholder={t("slug")}
            required
            pattern="[a-z0-9][a-z0-9-]*"
            className="w-28 rounded border border-line px-2 py-1.5 font-mono text-xs"
          />
          <input
            name="order"
            type="number"
            defaultValue={categories.length + 1}
            className="w-16 rounded border border-line px-2 py-1.5"
          />
          <label className="flex items-center gap-1.5">
            <input type="checkbox" name="isVisible" defaultChecked />
            {t("visible")}
          </label>
          <button
            type="submit"
            className="ml-auto rounded bg-primary px-3 py-1.5 text-xs font-bold text-white hover:bg-primary-dark"
          >
            {t("add")}
          </button>
        </div>
        {localeInputs()}
      </form>
    </div>
  );
}
