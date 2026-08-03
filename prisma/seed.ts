/**
 * ローカル開発用シード。
 * - カテゴリー(6ロケール表示名)/ 管理者・編集部アカウント
 * - サンプル作品(Series)・用語辞書(Term)・記事(全ロケール翻訳つき)
 * - ファン投稿・プライズサイクル・賞品カタログ・サンプル事業者
 * 実行: pnpm db:seed
 */
import { PrismaClient, type Locale } from "@prisma/client";
import bcrypt from "bcryptjs";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import sharp from "sharp";

const prisma = new PrismaClient();

/* ---------- カテゴリー(§2.2) ---------- */

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

function doc(paragraphs: (string | { h2: string })[]) {
  return {
    type: "doc",
    content: paragraphs.map((p) =>
      typeof p === "string"
        ? { type: "paragraph", content: [{ type: "text", text: p }] }
        : {
            type: "heading",
            attrs: { level: 2 },
            content: [{ type: "text", text: p.h2 }],
          }
    ),
  };
}

function dateStamp(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .format(d)
    .replace(/-/g, "");
}

function hoursAgo(h: number): Date {
  return new Date(Date.now() - h * 60 * 60 * 1000);
}

/* ---------- サムネイル自動生成 ---------- */

const PALETTES: [string, string][] = [
  ["#1D2F8C", "#D7263D"],
  ["#0F7B6C", "#63D471"],
  ["#8C1D6E", "#FF6B9D"],
  ["#B8860B", "#FFD166"],
  ["#2F4858", "#86BBD8"],
  ["#6A0572", "#AB83A1"],
];

async function makeThumb(index: number, label: string): Promise<string> {
  const [from, to] = PALETTES[index % PALETTES.length];
  const svg = `<svg width="1200" height="675" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${from}"/>
      <stop offset="100%" stop-color="${to}"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="675" fill="url(#g)"/>
  <circle cx="1020" cy="120" r="220" fill="#ffffff22"/>
  <circle cx="140" cy="560" r="160" fill="#00000022"/>
  <text x="60" y="360" font-family="sans-serif" font-size="88" font-weight="900" fill="#ffffff">${label}</text>
</svg>`;
  const dir = path.join(process.cwd(), "public", "uploads", "seed");
  await mkdir(dir, { recursive: true });
  const filename = `thumb-${index}.webp`;
  const webp = await sharp(Buffer.from(svg)).webp({ quality: 82 }).toBuffer();
  await writeFile(path.join(dir, filename), webp);
  return `/uploads/seed/${filename}`;
}

/* ---------- サンプル記事(ja マスター + 各ロケール翻訳) ---------- */

type SampleArticle = {
  slugBase: string;
  category: string;
  series?: string;
  hoursAgo: number;
  isBreaking?: boolean;
  isPinned?: boolean;
  texts: Partial<
    Record<Locale, { title: string; lead: string; paragraphs: (string | { h2: string })[] }>
  >;
};

const SAMPLES: SampleArticle[] = [
  {
    slugBase: "frieren-season-2-announced",
    category: "anime",
    series: "sousou-no-frieren",
    hoursAgo: 3,
    isBreaking: true,
    isPinned: true,
    texts: {
      ja: {
        title: "『葬送のフリーレン』第2期が制作決定 ティザービジュアル公開",
        lead: "TVアニメ『葬送のフリーレン』の第2期制作が発表された。あわせてティザービジュアルと特報映像が公開されている。",
        paragraphs: [
          "TVアニメ『葬送のフリーレン』の第2期制作が正式に発表された。",
          { h2: "発表の概要" },
          "公式サイトとSNSでティザービジュアルが公開され、続報は今後のイベントで明らかになる予定だ。",
          "第1期は魔王討伐後の世界を描く「後日譚ファンタジー」として国内外で高い評価を得た。",
        ],
      },
      en: {
        title: "Frieren: Beyond Journey's End Season 2 Announced with Teaser Visual",
        lead: "A second season of the TV anime Frieren: Beyond Journey's End has been officially announced, alongside a teaser visual and trailer.",
        paragraphs: [
          "A second season of the TV anime Frieren: Beyond Journey's End has been officially announced.",
          { h2: "What was announced" },
          "A teaser visual is now available on the official site and social media, with further details to come at upcoming events.",
          "The first season earned wide acclaim at home and abroad as a 'post-quest' fantasy set after the Demon King's defeat.",
        ],
      },
      ko: {
        title: "『장송의 프리렌』 2기 제작 결정, 티저 비주얼 공개",
        lead: "TV 애니메이션 『장송의 프리렌』의 2기 제작이 발표되었다. 티저 비주얼과 특보 영상도 함께 공개되었다.",
        paragraphs: [
          "TV 애니메이션 『장송의 프리렌』의 2기 제작이 공식 발표되었다.",
          { h2: "발표 개요" },
          "공식 사이트와 SNS에서 티저 비주얼이 공개되었으며, 추가 정보는 향후 이벤트에서 밝혀질 예정이다.",
          "1기는 마왕 토벌 이후의 세계를 그린 '후일담 판타지'로 국내외에서 높은 평가를 받았다.",
        ],
      },
      zh_Hant: {
        title: "《葬送的芙莉蓮》第二季製作決定 前導視覺圖公開",
        lead: "電視動畫《葬送的芙莉蓮》宣布製作第二季,並同步公開前導視覺圖與特報影片。",
        paragraphs: [
          "電視動畫《葬送的芙莉蓮》正式宣布製作第二季。",
          { h2: "發表內容" },
          "官方網站與社群媒體已公開前導視覺圖,更多情報將於後續活動揭曉。",
          "第一季以描寫魔王討伐後世界的「後日談奇幻」廣受國內外好評。",
        ],
      },
      th: {
        title: "ประกาศสร้าง Frieren คำอธิษฐานในวันที่จากลา ซีซัน 2 พร้อมเผยภาพทีเซอร์",
        lead: "อนิเมะทีวี Frieren: Beyond Journey's End ประกาศสร้างซีซันที่ 2 อย่างเป็นทางการ พร้อมภาพทีเซอร์และตัวอย่างพิเศษ",
        paragraphs: [
          "อนิเมะทีวี Frieren: Beyond Journey's End ประกาศสร้างซีซันที่ 2 อย่างเป็นทางการแล้ว",
          { h2: "รายละเอียดการประกาศ" },
          "ภาพทีเซอร์เผยแพร่แล้วบนเว็บไซต์ทางการและโซเชียลมีเดีย โดยรายละเอียดเพิ่มเติมจะประกาศในอีเวนต์ต่อไป",
          "ซีซันแรกได้รับเสียงชื่นชมทั้งในและต่างประเทศในฐานะแฟนตาซี 'หลังการเดินทาง' ที่เล่าเรื่องหลังปราบจอมมาร",
        ],
      },
      zh_Hans: {
        title: "《葬送的芙莉莲》第二季制作决定 先导视觉图公开",
        lead: "TV动画《葬送的芙莉莲》宣布制作第二季,并同步公开先导视觉图与特报视频。",
        paragraphs: [
          "TV动画《葬送的芙莉莲》正式宣布制作第二季。",
          { h2: "发表内容" },
          "官方网站与社交媒体已公开先导视觉图,更多信息将在后续活动中揭晓。",
          "第一季以描绘魔王讨伐后世界的\"后日谈奇幻\"在国内外广受好评。",
        ],
      },
    },
  },
  {
    slugBase: "spring-anime-lineup-guide",
    category: "news",
    hoursAgo: 8,
    texts: {
      ja: {
        title: "今期アニメの注目作まとめ 放送・配信スケジュール一覧",
        lead: "今期に放送・配信が始まる注目アニメを一覧で紹介する。",
        paragraphs: [
          "今期のアニメが出そろい、各配信プラットフォームのラインナップも発表された。",
          { h2: "注目のポイント" },
          "続編ものからオリジナルまで幅広く、配信プラットフォーム独占タイトルも増えている。",
        ],
      },
      en: {
        title: "This Season's Anime: Highlights and Streaming Schedule",
        lead: "A roundup of the most anticipated anime premiering this season, with broadcast and streaming schedules.",
        paragraphs: [
          "This season's anime lineup is set, and streaming platforms have announced their schedules.",
          { h2: "What to watch" },
          "The slate spans sequels to originals, with more platform-exclusive titles than ever.",
        ],
      },
      ko: {
        title: "이번 분기 주목 애니메이션 총정리, 방송·스트리밍 일정",
        lead: "이번 분기에 방송·스트리밍이 시작되는 주목 애니메이션을 한눈에 소개한다.",
        paragraphs: [
          "이번 분기 애니메이션 라인업이 확정되고 각 스트리밍 플랫폼의 일정도 발표되었다.",
          { h2: "주목 포인트" },
          "속편부터 오리지널까지 폭넓고, 플랫폼 독점 타이틀도 늘고 있다.",
        ],
      },
      zh_Hant: {
        title: "本季動畫焦點總整理 播出與串流時程一覽",
        lead: "整理本季開播的焦點動畫與各平台串流時程。",
        paragraphs: [
          "本季動畫陣容底定,各串流平台的片單也已公布。",
          { h2: "注目重點" },
          "從續作到原創作品應有盡有,平台獨佔作品也持續增加。",
        ],
      },
      th: {
        title: "รวมอนิเมะเด่นประจำซีซันนี้ พร้อมตารางออกอากาศและสตรีมมิง",
        lead: "สรุปอนิเมะน่าจับตาที่เริ่มฉายในซีซันนี้ พร้อมตารางออกอากาศและสตรีมมิง",
        paragraphs: [
          "รายชื่ออนิเมะประจำซีซันนี้ครบแล้ว และแพลตฟอร์มสตรีมมิงต่างประกาศผังของตน",
          { h2: "จุดน่าสนใจ" },
          "มีทั้งภาคต่อและออริจินัล รวมถึงเรื่อง exclusive เฉพาะแพลตฟอร์มที่เพิ่มขึ้น",
        ],
      },
      zh_Hans: {
        title: "本季动画焦点汇总 播出与流媒体时间表一览",
        lead: "汇总本季开播的焦点动画与各平台流媒体时间表。",
        paragraphs: [
          "本季动画阵容已定,各流媒体平台的片单也已公布。",
          { h2: "关注要点" },
          "从续作到原创应有尽有,平台独占作品也在增加。",
        ],
      },
    },
  },
  {
    slugBase: "anime-industry-market-report",
    category: "news",
    hoursAgo: 26,
    texts: {
      ja: {
        title: "アニメ産業市場が過去最高を更新 海外売上が全体を牽引",
        lead: "最新の産業レポートによると、アニメ産業市場は過去最高を更新し、海外市場の伸びが全体を牽引した。",
        paragraphs: [
          "最新の産業レポートで、アニメ産業市場が過去最高を更新したことが明らかになった。",
          { h2: "海外市場の伸び" },
          "配信プラットフォームの拡大とライセンスビジネスの成長が背景にある。",
        ],
      },
      en: {
        title: "Anime Industry Market Hits Record High, Driven by Overseas Sales",
        lead: "The anime industry set a new market record, with overseas growth leading the way, according to the latest industry report.",
        paragraphs: [
          "The latest industry report shows the anime market reaching an all-time high.",
          { h2: "Overseas growth" },
          "Expanding streaming platforms and licensing business underpin the growth.",
        ],
      },
      ko: {
        title: "애니메이션 산업 시장 사상 최고치 경신, 해외 매출이 견인",
        lead: "최신 산업 리포트에 따르면 애니메이션 산업 시장이 사상 최고치를 경신했으며 해외 시장의 성장이 전체를 견인했다.",
        paragraphs: [
          "최신 산업 리포트에서 애니메이션 시장이 사상 최고치를 경신한 것으로 나타났다.",
          { h2: "해외 시장의 성장" },
          "스트리밍 플랫폼의 확대와 라이선스 비즈니스의 성장이 배경이다.",
        ],
      },
      zh_Hant: {
        title: "動畫產業市場再創新高 海外營收成長領頭",
        lead: "最新產業報告顯示,動畫產業市場再創歷史新高,海外市場成長為主要動力。",
        paragraphs: [
          "最新產業報告顯示,動畫市場規模再創歷史新高。",
          { h2: "海外市場成長" },
          "串流平台擴張與授權業務成長是主要背景。",
        ],
      },
      th: {
        title: "ตลาดอุตสาหกรรมอนิเมะทำสถิติสูงสุดใหม่ ยอดขายต่างประเทศเป็นแรงขับเคลื่อน",
        lead: "รายงานอุตสาหกรรมล่าสุดชี้ว่าตลาดอนิเมะทำสถิติสูงสุดใหม่ โดยการเติบโตของตลาดต่างประเทศเป็นตัวนำ",
        paragraphs: [
          "รายงานอุตสาหกรรมล่าสุดเผยว่าตลาดอนิเมะแตะระดับสูงสุดเป็นประวัติการณ์",
          { h2: "การเติบโตในต่างประเทศ" },
          "การขยายตัวของแพลตฟอร์มสตรีมมิงและธุรกิจไลเซนส์คือปัจจัยเบื้องหลัง",
        ],
      },
      zh_Hans: {
        title: "动画产业市场再创新高 海外营收增长领跑",
        lead: "最新产业报告显示,动画产业市场再创历史新高,海外市场增长是主要动力。",
        paragraphs: [
          "最新产业报告显示,动画市场规模再创历史新高。",
          { h2: "海外市场增长" },
          "流媒体平台扩张与授权业务增长是主要背景。",
        ],
      },
    },
  },
];

async function main() {
  console.log("Seeding categories...");
  const categoryBySlug = new Map<string, string>();
  for (const c of CATEGORIES) {
    const category = await prisma.category.upsert({
      where: { slug: c.slug },
      create: { slug: c.slug, order: c.order, isVisible: true },
      update: { order: c.order },
    });
    categoryBySlug.set(c.slug, category.id);
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

  console.log("Seeding users...");
  const admin = await prisma.user.upsert({
    where: { email: "admin@example.com" },
    create: {
      email: "admin@example.com",
      passwordHash: await bcrypt.hash("admin1234", 12),
      name: "Admin",
      slug: "admin",
      role: "admin",
      adminLocale: "ja",
    },
    update: {},
  });
  await prisma.user.upsert({
    where: { email: "editorial@example.com" },
    create: {
      email: "editorial@example.com",
      passwordHash: await bcrypt.hash("editorial1234", 12),
      name: "編集部",
      slug: "editorial",
      role: "editor",
      adminLocale: "ja",
      bio: "Editorial team",
    },
    update: {},
  });
  const member = await prisma.user.upsert({
    where: { email: "member@example.com" },
    create: {
      email: "member@example.com",
      passwordHash: await bcrypt.hash("member1234", 12),
      name: "Sample Fan",
      slug: "sample-fan",
      role: "influencer",
      handle: "samplefan",
      bio: "Illustrator. Posting fan art of my favorite series!",
      birthMonth: "1998-04",
    },
    update: {},
  });

  console.log("Seeding series...");
  const frieren = await prisma.series.upsert({
    where: { slug: "sousou-no-frieren" },
    create: {
      slug: "sousou-no-frieren",
      kind: "tv",
      status: "approved",
      titleJa: "葬送のフリーレン",
      links: {
        official: "https://frieren-anime.jp/",
        streaming: [{ name: "Crunchyroll", url: "https://www.crunchyroll.com/" }],
      },
      broadcast: { season: "2023秋", episodes: 28 },
    },
    update: {},
  });
  const SERIES_TITLES: [Locale, string][] = [
    ["en", "Frieren: Beyond Journey's End"],
    ["ko", "장송의 프리렌"],
    ["zh_Hant", "葬送的芙莉蓮"],
    ["th", "Frieren คำอธิษฐานในวันที่จากลา"],
    ["zh_Hans", "葬送的芙莉莲"],
  ];
  for (const [locale, title] of SERIES_TITLES) {
    await prisma.seriesTranslation.upsert({
      where: { seriesId_locale: { seriesId: frieren.id, locale } },
      create: { seriesId: frieren.id, locale, title },
      update: { title },
    });
  }

  console.log("Seeding glossary terms...");
  let term = await prisma.term.findFirst({
    where: { nameJa: "葬送のフリーレン" },
  });
  if (!term) {
    term = await prisma.term.create({
      data: {
        type: "series",
        status: "verified",
        nameJa: "葬送のフリーレン",
        readingJa: "そうそうのフリーレン",
        romaji: "sousou no frieren",
        seriesId: frieren.id,
        sourceUrl: "https://frieren-anime.jp/",
      },
    });
  }
  for (const [locale, value] of SERIES_TITLES) {
    await prisma.termForm.upsert({
      where: { termId_locale: { termId: term.id, locale } },
      create: { termId: term.id, locale, value, isOfficial: true },
      update: { value },
    });
  }

  console.log("Seeding articles...");
  for (const [i, sample] of SAMPLES.entries()) {
    const publishedAt = hoursAgo(sample.hoursAgo);
    const slug = `${dateStamp(publishedAt)}-${sample.slugBase}`;
    const exists = await prisma.article.findUnique({ where: { slug } });
    if (exists) continue;

    const thumbUrl = await makeThumb(i, "ANIME");
    const media = await prisma.media.create({
      data: {
        url: thumbUrl,
        width: 1200,
        height: 675,
        alt: sample.texts.en?.title ?? "",
        mimeType: "image/webp",
        uploadedBy: admin.id,
      },
    });

    const article = await prisma.article.create({
      data: {
        slug,
        status: "published",
        kind: "editorial",
        masterLocale: "ja",
        publishedAt,
        isBreaking: sample.isBreaking ?? false,
        isPinned: sample.isPinned ?? false,
        viewCount: Math.floor(Math.random() * 4000) + 200,
        categoryId: categoryBySlug.get(sample.category)!,
        authorId: admin.id,
        heroImageId: media.id,
      },
    });
    for (const [locale, text] of Object.entries(sample.texts)) {
      await prisma.articleTranslation.create({
        data: {
          articleId: article.id,
          locale: locale as Locale,
          title: text.title,
          lead: text.lead,
          body: doc(text.paragraphs),
          status: "approved",
          translatedBy: locale === "ja" ? "human" : "ai",
          publishedAt,
        },
      });
    }
    if (sample.series === "sousou-no-frieren") {
      await prisma.articleSeries.create({
        data: { articleId: article.id, seriesId: frieren.id, isPrimary: true },
      });
    }
  }

  console.log("Seeding fan posts + prize cycle...");
  const now = new Date();
  const day = (now.getUTCDay() + 6) % 7;
  const startAt = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - day, -9)
  );
  await prisma.prizeCycle.upsert({
    where: { startAt_region: { startAt, region: "global" } },
    create: {
      startAt,
      endAt: new Date(startAt.getTime() + 7 * 24 * 3600 * 1000 - 1000),
      region: "global",
      status: "open",
    },
    update: {},
  });

  const existingPost = await prisma.fanPost.findFirst({
    where: { authorId: member.id },
  });
  if (!existingPost) {
    await prisma.fanPost.create({
      data: {
        authorId: member.id,
        seriesId: frieren.id,
        type: "text",
        status: "approved",
        bodyOriginal:
          "Rewatched the final episode again — the way the series treats memory and time is still unmatched. Fern best character, fight me.",
        originalLocale: "en",
        publishedAt: hoursAgo(5),
        voteCount: 3,
        score: 3,
        translations: {
          create: [
            { locale: "ko", body: "마지막 화를 다시 봤는데, 기억과 시간을 다루는 방식은 여전히 최고다. 페른이 최고의 캐릭터.", translatedBy: "ai" },
            { locale: "zh_Hant", body: "又重看了最後一集——這部作品處理記憶與時間的方式依然無可匹敵。菲倫是最棒的角色。", translatedBy: "ai" },
            { locale: "th", body: "ดูตอนจบซ้ำอีกรอบ วิธีที่เรื่องนี้เล่าความทรงจำและเวลายังไร้เทียมทาน แฟร์นคือคาแรกเตอร์ที่ดีที่สุด", translatedBy: "ai" },
            { locale: "zh_Hans", body: "又重看了最后一集——这部作品处理记忆与时间的方式依然无可匹敌。菲伦是最棒的角色。", translatedBy: "ai" },
          ],
        },
      },
    });
  }

  console.log("Seeding reward catalog...");
  const rewards = [
    { region: "en", provider: "Amazon.com", productName: "Amazon.com Gift Card", amount: 50, currency: "USD" },
    { region: "global", provider: "Amazon.co.jp", productName: "Amazon.co.jp ギフト券", amount: 5000, currency: "JPY", notes: "地域別賞品が未確定の間の既定(§9.2 別途指示待ち)" },
  ];
  for (const r of rewards) {
    const exists = await prisma.rewardCatalog.findFirst({
      where: { region: r.region, provider: r.provider },
    });
    if (!exists) await prisma.rewardCatalog.create({ data: r });
  }

  console.log("Seeding sample organization...");
  await prisma.organization.upsert({
    where: { slug: "sample-animation-studio" },
    create: {
      slug: "sample-animation-studio",
      name: "サンプルアニメーション株式会社",
      status: "approved",
      websiteUrl: "https://example.com/",
      description: "Sample animation studio for local development.",
      contactEmail: "pr@example.com",
    },
    update: {},
  });

  console.log("✅ Seed complete.");
  console.log("   Admin:  admin@example.com / admin1234");
  console.log("   Editor: editorial@example.com / editorial1234");
  console.log("   Member: member@example.com / member1234");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
