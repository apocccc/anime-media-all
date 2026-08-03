import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { renderArticleHtml } from "@/lib/tiptap";
import { articlePath, localizedUrl } from "@/lib/site";
import { fromDbLocale, isPublicLocale, toDbLocale } from "@/lib/locale";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * 提携先向けプレスリリースAPI(§7.3)。
 * GET /api/public/press-releases?locale=&since=&limit=
 * APIキー(PRESS_API_KEYS: カンマ区切り)必須・簡易レート制限つき・公開済みのみ。
 */

const RATE_LIMIT_PER_MINUTE = 60;
const hits = new Map<string, { count: number; windowStart: number }>();

function rateLimited(key: string): boolean {
  const now = Date.now();
  const entry = hits.get(key);
  if (!entry || now - entry.windowStart > 60_000) {
    hits.set(key, { count: 1, windowStart: now });
    return false;
  }
  entry.count++;
  return entry.count > RATE_LIMIT_PER_MINUTE;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const apiKey =
    req.headers.get("x-api-key") ?? url.searchParams.get("key") ?? "";
  const validKeys = (process.env.PRESS_API_KEYS ?? "")
    .split(",")
    .map((k) => k.trim())
    .filter(Boolean);
  if (validKeys.length === 0 || !validKeys.includes(apiKey)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (rateLimited(apiKey)) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const localeParam = url.searchParams.get("locale") ?? "en";
  if (!isPublicLocale(localeParam)) {
    return NextResponse.json({ error: "invalid locale" }, { status: 400 });
  }
  const locale = toDbLocale(localeParam);
  const since = url.searchParams.get("since");
  const limit = Math.min(
    100,
    Math.max(1, parseInt(url.searchParams.get("limit") ?? "20", 10) || 20)
  );

  const releases = await prisma.article.findMany({
    where: {
      kind: "press_release",
      status: "published",
      ...(since ? { publishedAt: { gte: new Date(since) } } : {}),
      translations: {
        some: { locale, status: { in: ["approved", "machine"] } },
      },
    },
    orderBy: { publishedAt: "desc" },
    take: limit,
    include: {
      organization: true,
      category: true,
      heroImage: true,
      translations: { where: { locale } },
    },
  });

  return NextResponse.json({
    locale: fromDbLocale(locale),
    items: releases.flatMap((r) => {
      const t = r.translations[0];
      if (!t) return [];
      return [
        {
          id: r.id,
          url: localizedUrl(localeParam, articlePath(r.category.slug, r.slug)),
          title: t.title,
          lead: t.lead,
          html: renderArticleHtml(t.body),
          organization: r.organization
            ? { name: r.organization.name, slug: r.organization.slug }
            : null,
          image: r.heroImage?.url ?? null,
          publishedAt: r.publishedAt?.toISOString() ?? null,
        },
      ];
    }),
  });
}
