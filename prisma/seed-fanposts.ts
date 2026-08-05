/**
 * ファン投稿(埋め込み)の一括登録スクリプト。
 * 指定した SNS 投稿URLを FanPost(type: embed, status: approved)として登録する。
 * 作品(Series)紐付けは必須のため、汎用の「ファンコミュニティ」作品に紐付ける
 * (後から /admin で各作品へ付け替え可能)。
 *
 * 実行(本番): DATABASE_URL='<本番pooler URL>' pnpm exec tsx prisma/seed-fanposts.ts
 * ※ 既に同じ embedUrl が登録済みならスキップ(冪等)。
 */
import { PrismaClient, type Locale } from "@prisma/client";

const prisma = new PrismaClient();

const URLS = [
  "https://www.facebook.com/groups/1014925085703099/permalink/2432847373910856/",
  "https://www.facebook.com/groups/1583391013299344/permalink/1586606079644504/",
  "https://www.facebook.com/reel/37322684327379499",
  "https://fb.watch/IOrVwXWoAB/",
  "https://www.facebook.com/groups/hololiveocg/permalink/4472128769742730/",
  "https://fb.watch/IOrWMD7d80/",
  "https://www.facebook.com/groups/367555341235548/permalink/1721752629149139/",
];

/** URLのホストから配信元名を判定(SNS埋め込みの許可ホスト) */
function providerOf(url: string): string | null {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    if (host === "fb.watch" || host.endsWith("facebook.com")) return "Facebook";
    if (host === "x.com" || host.endsWith("twitter.com")) return "X";
    if (host.endsWith("instagram.com")) return "Instagram";
    if (host.endsWith("tiktok.com")) return "TikTok";
    if (host === "youtu.be" || host.endsWith("youtube.com")) return "YouTube";
    return null;
  } catch {
    return null;
  }
}

async function main() {
  // 投稿者: 最初の管理者アカウント
  const author = await prisma.user.findFirst({
    where: { role: "admin" },
    orderBy: { createdAt: "asc" },
  });
  if (!author) throw new Error("管理者ユーザーが見つかりません。先に db:seed:prod を実行してください。");

  // 紐付け先の汎用作品(ファンコミュニティ)
  const series = await prisma.series.upsert({
    where: { slug: "community" },
    update: {},
    create: {
      slug: "community",
      titleJa: "ファンコミュニティ",
      status: "approved",
      translations: {
        create: [
          { locale: "en" as Locale, title: "Fan Community" },
          { locale: "ja" as Locale, title: "ファンコミュニティ" },
        ],
      },
    },
  });

  let created = 0;
  let skipped = 0;
  for (const url of URLS) {
    const provider = providerOf(url);
    if (!provider) {
      console.log("skip (未対応ホスト):", url);
      skipped++;
      continue;
    }
    const exists = await prisma.fanPost.findFirst({
      where: { embedUrl: url },
      select: { id: true },
    });
    if (exists) {
      console.log("skip (登録済み):", url);
      skipped++;
      continue;
    }
    await prisma.fanPost.create({
      data: {
        authorId: author.id,
        seriesId: series.id,
        type: "embed",
        status: "approved",
        bodyOriginal: "",
        originalLocale: "ja" as Locale,
        embedUrl: url,
        embedProvider: provider,
        publishedAt: new Date(),
      },
    });
    console.log("created:", url);
    created++;
  }

  console.log(`\n✅ fan posts: ${created} 件登録 / ${skipped} 件スキップ`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
