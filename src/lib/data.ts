import { prisma } from "@/lib/prisma";
import type { Locale as DbLocale, Prisma, ArticleTranslation } from "@prisma/client";
import { PUBLIC_DB_LOCALES } from "@/lib/locale";

/**
 * 公開サイト用のデータ取得層(多言語)。
 * 公開判定は Article.status === published かつ
 * 当該ロケールの ArticleTranslation.status ∈ {approved, machine}。
 * excluded のロケールでは記事を存在しないものとして扱う。
 * ビルド時にDBへ到達できない環境でもビルドが失敗しないよう、
 * 読み取りクエリは safe() でラップして空データへフォールバックする。
 */
async function safe<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    if (process.env.NODE_ENV === "development") {
      console.error("[data] query failed:", e);
    }
    return fallback;
  }
}

/** 公開扱いになる翻訳ステータス */
export const PUBLIC_TRANSLATION_STATUSES = ["approved", "machine"] as const;

const publicTranslationWhere = (locale: DbLocale) => ({
  locale,
  status: { in: [...PUBLIC_TRANSLATION_STATUSES] },
});

const publishedWhere = (locale: DbLocale): Prisma.ArticleWhereInput => ({
  status: "published",
  translations: { some: publicTranslationWhere(locale) },
});

export const articleListInclude = (locale: DbLocale) =>
  ({
    category: { include: { translations: true } },
    author: { select: { name: true, slug: true, avatarUrl: true } },
    heroImage: true,
    translations: { where: publicTranslationWhere(locale) },
  }) satisfies Prisma.ArticleInclude;

export type ArticleListItem = Prisma.ArticleGetPayload<{
  include: {
    category: { include: { translations: true } };
    author: { select: { name: true; slug: true; avatarUrl: true } };
    heroImage: true;
    translations: true;
  };
}>;

export type ArticleFull = Prisma.ArticleGetPayload<{
  include: {
    category: { include: { translations: true } };
    author: { select: { name: true; slug: true; avatarUrl: true; bio: true } };
    heroImage: true;
    organization: true;
    tags: { include: { tag: true } };
    sources: true;
    seriesLinks: {
      include: { series: { include: { translations: true } } };
    };
    translations: true;
  };
}>;

/** 一覧アイテムから当該ロケールの翻訳を取り出す(includeでロケール絞り込み済み) */
export function pickTranslation(article: {
  translations: ArticleTranslation[];
}): ArticleTranslation | null {
  return article.translations[0] ?? null;
}

export function getVisibleCategories() {
  return safe(
    () =>
      prisma.category.findMany({
        where: { isVisible: true },
        orderBy: { order: "asc" },
        include: { translations: true },
      }),
    []
  );
}

export function getCategoryBySlug(slug: string) {
  return safe(
    () =>
      prisma.category.findUnique({
        where: { slug },
        include: { translations: true },
      }),
    null
  );
}

/** トップ・「最新」用: 全カテゴリー横断の最新記事(press-release除く) */
export function getLatestArticles(
  locale: DbLocale,
  limit = 20,
  excludePressRelease = true
) {
  return safe(
    () =>
      prisma.article.findMany({
        where: {
          ...publishedWhere(locale),
          ...(excludePressRelease
            ? { category: { isNot: { slug: "press-release" } } }
            : {}),
        },
        orderBy: { publishedAt: "desc" },
        take: limit,
        include: articleListInclude(locale),
      }),
    []
  );
}

export function getPinnedArticles(locale: DbLocale, limit = 5) {
  return safe(
    () =>
      prisma.article.findMany({
        where: {
          ...publishedWhere(locale),
          isPinned: true,
          category: { isNot: { slug: "press-release" } },
        },
        orderBy: { publishedAt: "desc" },
        take: limit,
        include: articleListInclude(locale),
      }),
    []
  );
}

export function getBreakingArticles(locale: DbLocale, limit = 3) {
  return safe(
    () =>
      prisma.article.findMany({
        where: { ...publishedWhere(locale), isBreaking: true },
        orderBy: { publishedAt: "desc" },
        take: limit,
        include: articleListInclude(locale),
      }),
    []
  );
}

export function getArticlesByCategory(
  locale: DbLocale,
  categorySlug: string,
  page = 1,
  perPage = 20
) {
  return safe(
    async () => {
      const where =
        categorySlug === "latest"
          ? {
              ...publishedWhere(locale),
              category: { isNot: { slug: "press-release" } },
            }
          : {
              ...publishedWhere(locale),
              category: { is: { slug: categorySlug } },
            };
      const [items, total] = await Promise.all([
        prisma.article.findMany({
          where,
          orderBy: { publishedAt: "desc" },
          skip: (page - 1) * perPage,
          take: perPage,
          include: articleListInclude(locale),
        }),
        prisma.article.count({ where }),
      ]);
      return { items, total };
    },
    { items: [] as ArticleListItem[], total: 0 }
  );
}

/** 閲覧数ランキング(サイドバー用。PR含む) */
export function getPopularArticles(locale: DbLocale, limit = 10) {
  return safe(
    () =>
      prisma.article.findMany({
        where: publishedWhere(locale),
        orderBy: { viewCount: "desc" },
        take: limit,
        include: articleListInclude(locale),
      }),
    []
  );
}

/** カテゴリー別ダイジェスト(トップのセクション群用) */
export function getCategoryDigests(locale: DbLocale, perCategory = 4) {
  return safe(
    async () => {
      const categories = await prisma.category.findMany({
        where: {
          isVisible: true,
          slug: { notIn: ["latest", "fan"] },
        },
        orderBy: { order: "asc" },
        include: { translations: true },
      });
      const digests = await Promise.all(
        categories.map(async (category) => ({
          category,
          articles: await prisma.article.findMany({
            where: { ...publishedWhere(locale), categoryId: category.id },
            orderBy: { publishedAt: "desc" },
            take: perCategory,
            include: articleListInclude(locale),
          }),
        }))
      );
      return digests.filter((d) => d.articles.length > 0);
    },
    [] as {
      category: Prisma.CategoryGetPayload<{ include: { translations: true } }>;
      articles: ArticleListItem[];
    }[]
  );
}

export function getPressReleases(locale: DbLocale, limit = 6) {
  return safe(
    () =>
      prisma.article.findMany({
        where: {
          ...publishedWhere(locale),
          category: { is: { slug: "press-release" } },
        },
        orderBy: { publishedAt: "desc" },
        take: limit,
        include: articleListInclude(locale),
      }),
    []
  );
}

/**
 * 記事詳細。当該ロケールの公開翻訳が無い場合は null。
 * hreflang 用に全ロケールの翻訳ステータスも返す。
 */
export function getArticleBySlug(
  locale: DbLocale,
  categorySlug: string,
  articleSlug: string
) {
  return safe<ArticleFull | null>(
    () =>
      prisma.article.findFirst({
        where: {
          slug: articleSlug,
          status: "published",
          category: { is: { slug: categorySlug } },
          translations: { some: publicTranslationWhere(locale) },
        },
        include: {
          category: { include: { translations: true } },
          author: {
            select: { name: true, slug: true, avatarUrl: true, bio: true },
          },
          heroImage: true,
          organization: true,
          tags: { include: { tag: true } },
          sources: true,
          seriesLinks: {
            include: { series: { include: { translations: true } } },
          },
          // hreflang 出力用に全ロケール分を取得し、表示側でロケールを選ぶ
          translations: true,
        },
      }),
    null
  );
}

/** 記事が(当該ロケール以外で)公開されているロケール一覧。302 フォールバック判定用 */
export function getArticlePublishedLocales(
  categorySlug: string,
  articleSlug: string
) {
  return safe<DbLocale[]>(async () => {
    const article = await prisma.article.findFirst({
      where: {
        slug: articleSlug,
        status: "published",
        category: { is: { slug: categorySlug } },
      },
      select: {
        translations: { select: { locale: true, status: true } },
      },
    });
    if (!article) return [];
    return article.translations
      .filter(
        (t) =>
          (PUBLIC_TRANSLATION_STATUSES as readonly string[]).includes(
            t.status
          ) && (PUBLIC_DB_LOCALES as DbLocale[]).includes(t.locale)
      )
      .map((t) => t.locale);
  }, []);
}

export function getRelatedArticles(
  locale: DbLocale,
  articleId: string,
  categoryId: string,
  limit = 4
) {
  return safe(
    () =>
      prisma.article.findMany({
        where: {
          ...publishedWhere(locale),
          categoryId,
          id: { not: articleId },
        },
        orderBy: { publishedAt: "desc" },
        take: limit,
        include: articleListInclude(locale),
      }),
    []
  );
}

export function getArticlesByTag(
  locale: DbLocale,
  tagSlug: string,
  page = 1,
  perPage = 20
) {
  return safe(
    async () => {
      const tag = await prisma.tag.findUnique({ where: { slug: tagSlug } });
      if (!tag) return { tag: null, items: [] as ArticleListItem[], total: 0 };
      const where = {
        ...publishedWhere(locale),
        tags: { some: { tagId: tag.id } },
      };
      const [items, total] = await Promise.all([
        prisma.article.findMany({
          where,
          orderBy: { publishedAt: "desc" },
          skip: (page - 1) * perPage,
          take: perPage,
          include: articleListInclude(locale),
        }),
        prisma.article.count({ where }),
      ]);
      return { tag, items, total };
    },
    { tag: null, items: [] as ArticleListItem[], total: 0 }
  );
}

export function getAuthorWithArticles(
  locale: DbLocale,
  slug: string,
  page = 1,
  perPage = 20
) {
  return safe(
    async () => {
      const author = await prisma.user.findUnique({
        where: { slug },
        select: { id: true, name: true, slug: true, avatarUrl: true, bio: true },
      });
      if (!author)
        return { author: null, items: [] as ArticleListItem[], total: 0 };
      const where = { ...publishedWhere(locale), authorId: author.id };
      const [items, total] = await Promise.all([
        prisma.article.findMany({
          where,
          orderBy: { publishedAt: "desc" },
          skip: (page - 1) * perPage,
          take: perPage,
          include: articleListInclude(locale),
        }),
        prisma.article.count({ where }),
      ]);
      return { author, items, total };
    },
    { author: null, items: [] as ArticleListItem[], total: 0 }
  );
}

export function searchArticles(
  locale: DbLocale,
  query: string,
  page = 1,
  perPage = 20
) {
  return safe(
    async () => {
      // 異常に長いクエリでのDB負荷を防ぐ
      const q = query.slice(0, 100);
      const where: Prisma.ArticleWhereInput = {
        status: "published",
        translations: {
          some: {
            ...publicTranslationWhere(locale),
            OR: [
              { title: { contains: q, mode: "insensitive" } },
              { lead: { contains: q, mode: "insensitive" } },
            ],
          },
        },
      };
      const [items, total] = await Promise.all([
        prisma.article.findMany({
          where,
          orderBy: { publishedAt: "desc" },
          skip: (page - 1) * perPage,
          take: perPage,
          include: articleListInclude(locale),
        }),
        prisma.article.count({ where }),
      ]);
      return { items, total };
    },
    { items: [] as ArticleListItem[], total: 0 }
  );
}

/** RSS / Atom / JSON Feed 用 */
export function getFeedArticles(
  locale: DbLocale,
  categorySlug?: string,
  limit = 50
) {
  return safe(
    () =>
      prisma.article.findMany({
        where: {
          ...publishedWhere(locale),
          ...(categorySlug ? { category: { is: { slug: categorySlug } } } : {}),
        },
        orderBy: { publishedAt: "desc" },
        take: limit,
        include: articleListInclude(locale),
      }),
    []
  );
}

/** sitemap 用: 当該ロケールで公開されている記事 + hreflang 用の全公開ロケール */
export function getAllPublishedForSitemap(locale: DbLocale) {
  return safe(
    () =>
      prisma.article.findMany({
        where: publishedWhere(locale),
        orderBy: { publishedAt: "desc" },
        select: {
          slug: true,
          updatedAt: true,
          publishedAt: true,
          category: { select: { slug: true } },
          translations: { select: { locale: true, status: true } },
        },
      }),
    []
  );
}

/** Googleニュース用: 直近48時間(当該ロケール) */
export function getNewsSitemapArticles(locale: DbLocale) {
  const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000);
  return safe(
    () =>
      prisma.article.findMany({
        where: { ...publishedWhere(locale), publishedAt: { gte: cutoff } },
        orderBy: { publishedAt: "desc" },
        take: 1000,
        select: {
          slug: true,
          publishedAt: true,
          category: { select: { slug: true } },
          translations: {
            where: publicTranslationWhere(locale),
            select: { title: true },
          },
        },
      }),
    []
  );
}

export function findRedirect(fromPath: string) {
  return safe(() => prisma.redirect.findUnique({ where: { fromPath } }), null);
}

export function incrementViewCount(articleId: string) {
  // fire-and-forget。失敗しても表示へ影響させない
  prisma.article
    .update({ where: { id: articleId }, data: { viewCount: { increment: 1 } } })
    .catch(() => {});
}
