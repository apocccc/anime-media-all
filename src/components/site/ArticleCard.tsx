import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { pickTranslation, type ArticleListItem } from "@/lib/data";
import { categoryName } from "@/lib/categories";
import { categoryAccent } from "@/lib/category-style";
import { localeMeta } from "@/lib/locale";
import { articlePath, formatTokyo } from "@/lib/site";

function CategoryBadge({
  article,
  locale,
}: {
  article: ArticleListItem;
  locale: string;
}) {
  const accent = categoryAccent(article.category.slug);
  return (
    <span
      className={`inline-flex h-[20px] items-center rounded-[4px] px-[8px] font-heading text-[11px] font-extrabold uppercase ${accent.chip}`}
    >
      {categoryName(article.category, locale)}
    </span>
  );
}

async function BreakingBadge({ show }: { show: boolean }) {
  const t = await getTranslations();
  if (!show) return null;
  return (
    <span className="inline-flex h-[20px] items-center rounded-[4px] bg-breaking px-[8px] font-heading text-[11px] font-extrabold uppercase text-white">
      {t("labels.breaking")}
    </span>
  );
}

function Thumb({
  article,
  sizes,
  priority = false,
}: {
  article: ArticleListItem;
  sizes: string;
  priority?: boolean;
}) {
  if (!article.heroImage) {
    return (
      <div
        aria-hidden="true"
        className="flex h-full w-full items-center justify-center bg-bg-sub font-display text-3xl text-dash select-none"
      >
        A
      </div>
    );
  }
  return (
    <Image
      src={article.heroImage.url}
      alt={article.heroImage.alt}
      fill
      sizes={sizes}
      priority={priority}
      className="object-cover"
    />
  );
}

/** トップのヒーロー用大型カード */
export async function HeroCard({
  article,
  locale,
}: {
  article: ArticleListItem;
  locale: string;
}) {
  const tr = pickTranslation(article);
  if (!tr) return null;
  const href = articlePath(article.category.slug, article.slug);
  return (
    <article className="group relative">
      <Link href={href} className="block">
        <div className="relative aspect-[16/9] overflow-hidden rounded-[13px] border-2 border-ink">
          <Thumb article={article} sizes="(min-width: 1024px) 66vw, 100vw" priority />
        </div>
        <div className="mt-3 flex items-center gap-2">
          <BreakingBadge show={article.isBreaking} />
          <CategoryBadge article={article} locale={locale} />
          <time
            dateTime={(article.publishedAt ?? article.createdAt).toISOString()}
            className="text-xs font-semibold text-gray"
          >
            {formatTokyo(article.publishedAt ?? article.createdAt, localeMeta(locale).intl)}
          </time>
        </div>
        <h2 className="mt-2 font-heading text-2xl font-extrabold leading-snug group-hover:text-primary">
          {tr.title}
        </h2>
        {tr.lead ? (
          <p className="mt-2 line-clamp-2 text-[15px] leading-relaxed text-gray">
            {tr.lead}
          </p>
        ) : null}
      </Link>
    </article>
  );
}

/** 一覧用の標準カード(サムネイル左・2px罫線・破線区切り前提) */
export async function ArticleCard({
  article,
  locale,
  showCategory = true,
}: {
  article: ArticleListItem;
  locale: string;
  showCategory?: boolean;
}) {
  const tr = pickTranslation(article);
  if (!tr) return null;
  const href = articlePath(article.category.slug, article.slug);
  return (
    <article className="group">
      <Link href={href} className="flex gap-4">
        <div className="relative aspect-[3/2] w-32 shrink-0 overflow-hidden rounded-[8px] border-2 border-ink sm:w-44">
          <Thumb article={article} sizes="(min-width: 640px) 176px, 128px" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <BreakingBadge show={article.isBreaking} />
            {showCategory ? (
              <CategoryBadge article={article} locale={locale} />
            ) : null}
            <time
              dateTime={(article.publishedAt ?? article.createdAt).toISOString()}
              className="text-xs font-semibold text-gray"
            >
              {formatTokyo(article.publishedAt ?? article.createdAt, localeMeta(locale).intl)}
            </time>
          </div>
          <h3 className="mt-1.5 font-heading text-[18px] font-extrabold leading-snug line-clamp-2 group-hover:text-primary">
            {tr.title}
          </h3>
          {tr.lead ? (
            <p className="mt-1 hidden sm:block line-clamp-2 text-sm leading-relaxed text-gray">
              {tr.lead}
            </p>
          ) : null}
        </div>
      </Link>
    </article>
  );
}

/** グリッド用のコンパクトカード(サムネイル上) */
export async function CompactCard({
  article,
  locale,
}: {
  article: ArticleListItem;
  locale: string;
}) {
  const tr = pickTranslation(article);
  if (!tr) return null;
  const href = articlePath(article.category.slug, article.slug);
  return (
    <article className="group">
      <Link href={href} className="block">
        <div className="relative aspect-[16/10] overflow-hidden rounded-[8px] border-2 border-ink">
          <Thumb article={article} sizes="(min-width: 1024px) 25vw, 50vw" />
        </div>
        <div className="mt-2 flex items-center gap-2">
          <BreakingBadge show={article.isBreaking} />
          <CategoryBadge article={article} locale={locale} />
        </div>
        <h3 className="mt-1.5 font-heading text-[15px] font-extrabold leading-snug line-clamp-2 group-hover:text-primary">
          {tr.title}
        </h3>
        <time
          dateTime={(article.publishedAt ?? article.createdAt).toISOString()}
          className="mt-1 block text-xs font-semibold text-gray"
        >
          {formatTokyo(article.publishedAt ?? article.createdAt, localeMeta(locale).intl)}
        </time>
      </Link>
    </article>
  );
}
