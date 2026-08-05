/**
 * セクション見出し(§18 見出しタブ)。
 * 斜体タブ+2px罫線のコミック風ラベル。色は color クラスで差し替える。
 * 見出しレベルは as で変更可能(h1配下で使う場合は "span")。
 */
export function SectionHeading({
  children,
  color = "bg-primary text-white",
  as: Tag = "h2",
}: {
  children: React.ReactNode;
  color?: string;
  as?: "h1" | "h2" | "h3" | "span";
}) {
  return (
    <Tag
      className={`comic-tab inline-flex h-[40px] items-center border-2 border-ink px-[18px] font-heading text-[22px] font-extrabold uppercase leading-none xl:text-[26px] ${color}`}
    >
      <span>{children}</span>
    </Tag>
  );
}
