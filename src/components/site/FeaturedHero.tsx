import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { pickTranslation, type ArticleListItem } from "@/lib/data";
import { articlePath } from "@/lib/site";
import { ConfettiDot, Star5, StarSpark } from "./Doodads";

/**
 * Featured Hero(§14)。左46%が濃紺のテキスト面、右54%がティールのビジュアル面。
 * 境界は clip-path の斜め切り替え。影・グラデーション不使用。
 */
export async function FeaturedHero({
  article,
}: {
  article: ArticleListItem;
}) {
  const tr = pickTranslation(article);
  if (!tr) return null;
  const t = await getTranslations();
  const href = articlePath(article.category.slug, article.slug);

  // 見出し末尾の2語を黄色でアクセント(参考画像の SEASON 2 に相当)
  const words = tr.title.split(" ");
  const splitAt = words.length > 3 ? words.length - 2 : words.length;
  const mainPart = words.slice(0, splitAt).join(" ");
  const accentPart = words.slice(splitAt).join(" ");

  return (
    <section
      aria-label={t("labels.topStories")}
      className="relative min-h-[400px] overflow-hidden rounded-[16px] border-2 border-ink bg-navy lg:h-[438px]"
    >
      {/* 右: ビジュアル面(斜めの境界) */}
      <div
        className="absolute inset-y-0 right-0 hidden w-[57%] bg-teal sm:block"
        style={{ clipPath: "polygon(15% 0, 100% 0, 100% 100%, 0 100%)" }}
      >
        <Image
          src={article.heroImage?.url ?? "/assets/temp/hero-character-placeholder.svg"}
          alt={article.heroImage?.alt ?? ""}
          fill
          priority
          sizes="(min-width: 1024px) 45vw, 100vw"
          className="object-cover object-[center_top]"
          style={{ clipPath: "polygon(15% 0, 100% 0, 100% 100%, 0 100%)" }}
        />
        {/* ビジュアル面の装飾 */}
        <Star5 size={30} color="#139a9f" className="absolute bottom-6 right-5" />
        <StarSpark size={22} className="absolute left-[22%] top-6" />
      </div>

      {/* HOT TOPIC! 吹き出し(§14 TEASER相当) */}
      <div className="absolute right-5 top-5 z-20 hidden h-[112px] w-[128px] items-center justify-center sm:flex">
        <svg
          aria-hidden="true"
          viewBox="0 0 128 112"
          className="absolute inset-0 h-full w-full"
        >
          <path
            d="M64 2 L76 16 L95 8 L97 26 L117 24 L108 42 L126 50 L110 62 L122 78 L102 80 L104 100 L85 92 L78 110 L64 96 L50 110 L43 92 L24 100 L26 80 L6 78 L18 62 L2 50 L20 42 L11 24 L31 26 L33 8 L52 16 Z"
            fill="#fffdf9"
            stroke="#141d28"
            strokeWidth="3"
            strokeLinejoin="round"
          />
        </svg>
        <p className="relative -rotate-3 text-center font-heading text-[22px] font-extrabold uppercase leading-[0.95] text-primary">
          {t("hero.burstTop")}
          <br />
          {t("hero.burstBottom")}
        </p>
      </div>

      {/* 左: テキスト面 */}
      <div className="relative z-10 flex h-full flex-col items-start px-7 pb-7 pt-7 sm:w-[46%] xl:pl-9">
        <span className="inline-block -rotate-2 rounded-[2px] bg-primary px-4 py-1 font-heading text-[17px] font-extrabold uppercase leading-none text-white">
          {t("hero.featured")}
        </span>

        <h2 className="mt-4 font-display uppercase leading-[0.94] text-white">
          <Link href={href} className="hover:text-yellow">
            <span className="line-clamp-3 text-[30px] xl:text-[42px]">
              {mainPart}
            </span>
            {accentPart ? (
              <span className="line-clamp-1 text-[34px] text-yellow xl:text-[48px]">
                {accentPart}
              </span>
            ) : null}
          </Link>
        </h2>

        {tr.lead ? (
          <p className="mt-4 line-clamp-2 max-w-[310px] text-[15.5px] leading-[1.45] text-white">
            {tr.lead}
          </p>
        ) : null}

        <Link
          href={href}
          className="mt-auto flex h-[38px] w-[198px] items-center justify-center gap-2 rounded-[3px] bg-primary font-heading text-[17px] font-extrabold uppercase text-white hover:bg-primary-dark"
        >
          {t("hero.viewDetails")}
          <span aria-hidden="true">→</span>
        </Link>

        {/* 下部インジケーター(静的表示) */}
        <div
          aria-hidden="true"
          className="absolute bottom-[18px] left-1/2 flex -translate-x-1/2 gap-3 sm:left-[46%]"
        >
          {[0, 1, 2, 3].map((i) => (
            <span
              key={i}
              className={`h-[13px] w-[13px] rounded-full border-2 border-ink ${
                i === 0 ? "bg-primary" : "bg-bg"
              }`}
            />
          ))}
        </div>

        {/* テキスト面の装飾(紙吹雪) */}
        <ConfettiDot size={9} color="#eb4e5d" className="absolute right-8 top-24 hidden sm:inline-block" />
        <ConfettiDot size={7} color="#fad157" className="absolute bottom-24 left-6 hidden sm:inline-block" />
        <StarSpark size={16} color="#96cab4" className="absolute left-4 top-14 hidden sm:block" />
      </div>
    </section>
  );
}
