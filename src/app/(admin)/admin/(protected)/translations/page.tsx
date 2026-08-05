import { redirect } from "next/navigation";

/**
 * 翻訳キューは廃止(2026-08 指示)。
 * 生成記事は自動翻訳→自動公開されるため、手動レビュー画面は設けない。
 * 既存リンク保護のため記事一覧へリダイレクトする。
 */
export default function TranslationsPage() {
  redirect("/admin/articles");
}
