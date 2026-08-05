import type { Category, CategoryTranslation } from "@prisma/client";
import { toDbLocale } from "@/lib/locale";

export type CategoryWithTranslations = Category & {
  translations: CategoryTranslation[];
};

/** カテゴリー表示名: 当該ロケール → en → slug の順でフォールバック */
export function categoryName(
  category: CategoryWithTranslations,
  locale: string
): string {
  const db = toDbLocale(locale);
  return (
    category.translations.find((t) => t.locale === db)?.name ??
    category.translations.find((t) => t.locale === "en")?.name ??
    category.slug
  );
}
