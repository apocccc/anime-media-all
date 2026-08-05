import { Link } from "@/i18n/navigation";
import { pickTranslation, type ArticleListItem } from "@/lib/data";
import { articlePath } from "@/lib/site";

/** サイドバー用の閲覧数ランキング(コーラルの番号タイル+破線区切り) */
export function RankingList({ articles }: { articles: ArticleListItem[] }) {
  return (
    <ol>
      {articles.map((a, i) => {
        const tr = pickTranslation(a);
        if (!tr) return null;
        return (
          <li
            key={a.id}
            className={
              i < articles.length - 1 ? "border-b border-dashed border-dash" : ""
            }
          >
            <Link
              href={articlePath(a.category.slug, a.slug)}
              className="group flex items-start gap-2.5 py-2.5"
            >
              <span
                aria-hidden="true"
                className={`mt-0.5 flex h-[28px] w-[28px] shrink-0 items-center justify-center rounded-[7px] font-heading text-[18px] font-extrabold ${
                  i < 3 ? "bg-primary text-white" : "bg-bg-sub text-ink"
                }`}
              >
                {i + 1}
              </span>
              <span className="font-heading text-[14.5px] font-bold leading-snug text-ink line-clamp-2 group-hover:text-primary">
                {tr.title}
              </span>
            </Link>
          </li>
        );
      })}
    </ol>
  );
}
