import { prisma } from "@/lib/prisma";
import type {
  Locale as DbLocale,
  Prisma,
  SeriesTranslation,
  FanPostTranslation,
} from "@prisma/client";
import { articleListInclude, type ArticleListItem } from "@/lib/data";

/** 作品・ファン投稿・プライズ・投稿者・企業ページのデータ取得層 */
async function safe<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    if (process.env.NODE_ENV === "development") {
      console.error("[data-community] query failed:", e);
    }
    return fallback;
  }
}

// ===== Series =====

export type SeriesWithTranslations = Prisma.SeriesGetPayload<{
  include: { translations: true; heroImage: true };
}>;

export function seriesTitle(
  series: { titleJa: string; translations: SeriesTranslation[] },
  locale: DbLocale
): string {
  return (
    series.translations.find((t) => t.locale === locale)?.title ??
    series.translations.find((t) => t.locale === "en")?.title ??
    series.titleJa
  );
}

export function seriesSynopsis(
  series: { translations: SeriesTranslation[] },
  locale: DbLocale
): string {
  return (
    series.translations.find((t) => t.locale === locale)?.synopsis ??
    series.translations.find((t) => t.locale === "en")?.synopsis ??
    ""
  );
}

export function getSeriesBySlug(slug: string) {
  return safe<SeriesWithTranslations | null>(
    () =>
      prisma.series.findFirst({
        where: { slug, status: "approved" },
        include: { translations: true, heroImage: true },
      }),
    null
  );
}

export function getSeriesList(limit = 100) {
  return safe(
    () =>
      prisma.series.findMany({
        where: { status: "approved" },
        orderBy: { updatedAt: "desc" },
        take: limit,
        include: { translations: true, heroImage: true },
      }),
    []
  );
}

export function getSeriesNews(locale: DbLocale, seriesId: string, limit = 12) {
  return safe(
    () =>
      prisma.article.findMany({
        where: {
          status: "published",
          translations: {
            some: { locale, status: { in: ["approved", "machine"] } },
          },
          seriesLinks: { some: { seriesId } },
        },
        orderBy: { publishedAt: "desc" },
        take: limit,
        include: articleListInclude(locale),
      }),
    [] as ArticleListItem[]
  );
}

// ===== FanPost =====

export const fanPostInclude = {
  author: {
    select: { name: true, handle: true, avatarUrl: true, role: true },
  },
  series: { include: { translations: true } },
  translations: true,
} satisfies Prisma.FanPostInclude;

export type FanPostItem = Prisma.FanPostGetPayload<{
  include: typeof fanPostInclude;
}>;

export function fanPostBody(
  post: { bodyOriginal: string; translations: FanPostTranslation[] },
  locale: DbLocale
): { body: string; isTranslation: boolean } {
  const t = post.translations.find((x) => x.locale === locale);
  if (t) return { body: t.body, isTranslation: true };
  return { body: post.bodyOriginal, isTranslation: false };
}

export function getFanPosts(opts: {
  seriesId?: string;
  authorId?: string;
  sort?: "latest" | "popular";
  page?: number;
  perPage?: number;
}) {
  const { seriesId, authorId, sort = "latest", page = 1, perPage = 24 } = opts;
  return safe(
    async () => {
      const where: Prisma.FanPostWhereInput = {
        status: "approved",
        ...(seriesId ? { seriesId } : {}),
        ...(authorId ? { authorId } : {}),
      };
      const [items, total] = await Promise.all([
        prisma.fanPost.findMany({
          where,
          orderBy:
            sort === "popular"
              ? [{ score: "desc" }, { voteCount: "desc" }, { publishedAt: "desc" }]
              : { publishedAt: "desc" },
          skip: (page - 1) * perPage,
          take: perPage,
          include: fanPostInclude,
        }),
        prisma.fanPost.count({ where }),
      ]);
      return { items, total };
    },
    { items: [] as FanPostItem[], total: 0 }
  );
}

export function getFanPost(id: string) {
  return safe<FanPostItem | null>(
    () =>
      prisma.fanPost.findFirst({
        where: { id, status: "approved" },
        include: fanPostInclude,
      }),
    null
  );
}

export function incrementFanPostView(id: string) {
  prisma.fanPost
    .update({ where: { id }, data: { viewCount: { increment: 1 } } })
    .catch(() => {});
}

// ===== Prize =====

export function getOpenPrizeCycle(now = new Date()) {
  return safe(
    () =>
      prisma.prizeCycle.findFirst({
        where: { status: "open", startAt: { lte: now }, endAt: { gte: now } },
        orderBy: { startAt: "desc" },
      }),
    null
  );
}

export function getPastAwards(limit = 12) {
  return safe(
    () =>
      prisma.prizeAward.findMany({
        where: { status: { in: ["issued", "sent"] } },
        orderBy: { createdAt: "desc" },
        take: limit,
        include: {
          cycle: true,
          post: { include: fanPostInclude },
          user: { select: { name: true, handle: true, avatarUrl: true } },
        },
      }),
    []
  );
}

/** 今週のサイクルの投票数上位の投稿(プライズページ用) */
export function getCycleLeaders(cycleId: string, limit = 10) {
  return safe(async () => {
    const grouped = await prisma.fanPostVote.groupBy({
      by: ["postId"],
      where: { cycleId },
      _count: { postId: true },
      orderBy: { _count: { postId: "desc" } },
      take: limit,
    });
    if (grouped.length === 0) return [];
    const posts = await prisma.fanPost.findMany({
      where: { id: { in: grouped.map((g) => g.postId) }, status: "approved" },
      include: fanPostInclude,
    });
    const byId = new Map(posts.map((p) => [p.id, p]));
    return grouped
      .map((g) => {
        const post = byId.get(g.postId);
        return post ? { post, votes: g._count.postId } : null;
      })
      .filter((x): x is { post: FanPostItem; votes: number } => x !== null);
  }, []);
}

export function getUserVoteForCycle(userId: string, cycleId: string) {
  return safe(
    () =>
      prisma.fanPostVote.findMany({
        where: { userId, cycleId },
        select: { postId: true },
      }),
    []
  );
}

// ===== Creators =====

export function getCreatorByHandle(handle: string) {
  return safe(
    () =>
      prisma.user.findFirst({
        where: { handle, role: "influencer" },
        select: {
          id: true,
          name: true,
          handle: true,
          avatarUrl: true,
          bio: true,
          snsLinks: true,
        },
      }),
    null
  );
}

// ===== Organizations(企業ページ) =====

export function getOrganizationBySlug(slug: string) {
  return safe(
    () =>
      prisma.organization.findFirst({
        where: { slug, status: "approved" },
      }),
    null
  );
}

export function getOrganizationPressReleases(
  locale: DbLocale,
  organizationId: string,
  page = 1,
  perPage = 20
) {
  return safe(
    async () => {
      const where: Prisma.ArticleWhereInput = {
        status: "published",
        organizationId,
        kind: "press_release",
        translations: {
          some: { locale, status: { in: ["approved", "machine"] } },
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
