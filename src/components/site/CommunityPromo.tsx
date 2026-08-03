import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { Bang, ConfettiDot, StarSpark } from "./Doodads";

/**
 * Community Promo(§22)。黄色の会員募集バナー。
 * Anton見出し+吹き出し+仮キャラクター+ティールCTA。影・グラデーション不使用。
 */
export async function CommunityPromo() {
  const t = await getTranslations();

  return (
    <section
      aria-label={t("community.cta")}
      className="relative overflow-hidden rounded-[13px] border-2 border-ink bg-yellow lg:h-[243px]"
    >
      {/* ハーフトーンドット装飾(単色SVGパターン) */}
      <div
        aria-hidden="true"
        className="halftone--light absolute left-0 top-0 h-[70px] w-[120px] opacity-60"
      />
      <Bang size={26} className="absolute left-[150px] top-3" />
      <StarSpark size={20} color="#fffdf9" className="absolute left-2 bottom-14" />
      <ConfettiDot size={8} className="absolute left-[130px] top-[70px]" />
      <StarSpark size={16} color="#eb4e5d" className="absolute right-[210px] top-2" />

      {/* 左: コピー */}
      <div className="relative z-10 px-[18px] pt-[16px]">
        <p className="font-display uppercase leading-[0.9]">
          <span className="block -rotate-1 text-[24px] text-ink xl:text-[27px]">
            {t("community.line1")}
          </span>
          <span className="block -rotate-1 text-[38px] text-primary [-webkit-text-stroke:1.5px_#141d28] xl:text-[43px]">
            {t("community.line2")}
          </span>
          <span className="block -rotate-1 text-[34px] text-ink xl:text-[39px]">
            {t("community.line3")}
          </span>
        </p>

        {/* 吹き出し */}
        <div className="mt-2.5 w-[130px] rotate-[-2deg] rounded-[8px] border-2 border-ink bg-surface px-2 py-1.5 text-center font-heading text-[12px] font-extrabold uppercase leading-tight text-ink">
          {t("community.bubble1")}
          <br />
          {t("community.bubble2")}
          <br />
          {t("community.bubble3")}
          <br />
          {t("community.bubble4")}
        </div>
      </div>

      {/* 右: キャラクター(仮) */}
      {/* TODO: 正式なコミュニティ枠キャラクター素材に差し替える。右下220×235pxの表示領域は維持すること。 */}
      <div className="pointer-events-none absolute bottom-0 right-0 h-[235px] w-[190px] xl:w-[220px]">
        <Image
          src="/assets/temp/community-character-placeholder.svg"
          alt=""
          fill
          sizes="220px"
          className="object-contain object-right-bottom"
        />
      </div>

      {/* CTA */}
      {/* ロケール外ルート(/my)への遷移のため <a> を使用 */}
      {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
      <a
        href="/my"
        className="absolute bottom-[12px] left-[18px] z-10 flex h-[34px] w-[180px] items-center justify-center gap-2 rounded-[4px] border-2 border-ink bg-teal font-heading text-[15px] font-extrabold uppercase text-white hover:bg-[#0f8286]"
      >
        {t("community.cta")}
        <span aria-hidden="true">→</span>
      </a>
    </section>
  );
}
