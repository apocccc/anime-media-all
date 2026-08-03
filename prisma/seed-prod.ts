/**
 * 本番用の初期データ投入(サンプル記事なし)。
 * - カテゴリー7種(6ロケール表示名)
 * - 管理者アカウント(SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD)
 *
 * 実行: SEED_ADMIN_PASSWORD=... pnpm db:seed:prod
 */
import { PrismaClient, type Locale } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

type CategoryNames = Partial<Record<Locale, string>>;
const CATEGORIES: { slug: string; order: number; names: CategoryNames }[] = [
  { slug: "latest", order: 0, names: { ja: "最新", en: "Latest", ko: "최신", zh_Hant: "最新", th: "ล่าสุด", zh_Hans: "最新" } },
  { slug: "news", order: 1, names: { ja: "ニュース", en: "News", ko: "뉴스", zh_Hant: "新聞", th: "ข่าว", zh_Hans: "新闻" } },
  { slug: "anime", order: 2, names: { ja: "アニメ", en: "Anime", ko: "애니메이션", zh_Hant: "動畫", th: "อนิเมะ", zh_Hans: "动画" } },
  { slug: "manga", order: 3, names: { ja: "マンガ", en: "Manga", ko: "만화", zh_Hant: "漫畫", th: "มังงะ", zh_Hans: "漫画" } },
  { slug: "event", order: 4, names: { ja: "イベント", en: "Events", ko: "이벤트", zh_Hant: "活動", th: "อีเวนต์", zh_Hans: "活动" } },
  { slug: "press-release", order: 5, names: { ja: "プレスリリース", en: "Press Releases", ko: "보도자료", zh_Hant: "新聞稿", th: "ข่าวประชาสัมพันธ์", zh_Hans: "新闻稿" } },
  { slug: "fan", order: 6, names: { ja: "ファン投稿", en: "Fan Posts", ko: "팬 게시물", zh_Hant: "粉絲投稿", th: "โพสต์แฟนคลับ", zh_Hans: "粉丝投稿" } },
];

async function main() {
  console.log("Seeding categories...");
  for (const c of CATEGORIES) {
    const category = await prisma.category.upsert({
      where: { slug: c.slug },
      create: { slug: c.slug, order: c.order, isVisible: true },
      update: { order: c.order },
    });
    for (const [locale, name] of Object.entries(c.names)) {
      await prisma.categoryTranslation.upsert({
        where: {
          categoryId_locale: {
            categoryId: category.id,
            locale: locale as Locale,
          },
        },
        create: { categoryId: category.id, locale: locale as Locale, name },
        update: { name },
      });
    }
  }

  const email = process.env.SEED_ADMIN_EMAIL;
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (!email || !password) {
    console.error(
      "✗ SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD を環境変数で指定してください"
    );
    process.exit(1);
  }
  if (password.length < 12) {
    console.error("✗ 本番の管理者パスワードは12文字以上にしてください");
    process.exit(1);
  }

  console.log("Seeding admin user...");
  await prisma.user.upsert({
    where: { email: email.toLowerCase() },
    create: {
      email: email.toLowerCase(),
      passwordHash: await bcrypt.hash(password, 12),
      name: "Admin",
      slug: "admin",
      role: "admin",
      adminLocale: "ja",
    },
    update: {},
  });
  await prisma.user.upsert({
    where: { slug: "editorial" },
    create: {
      email: `editorial+${Date.now().toString(36)}@internal.invalid`,
      name: "編集部",
      slug: "editorial",
      role: "editor",
      adminLocale: "ja",
      passwordHash: await bcrypt.hash(password + "-editorial", 12),
    },
    update: {},
  });

  console.log("✅ Production seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
