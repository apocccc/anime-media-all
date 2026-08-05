import { getTranslations } from "next-intl/server";

/** 記事ページのシェアボタン(X / Facebook / LINE)。JS不要のインテントリンク */
export async function ShareButtons({
  url,
  title,
}: {
  url: string;
  title: string;
}) {
  const t = await getTranslations();
  const u = encodeURIComponent(url);
  const text = encodeURIComponent(title);

  const items = [
    {
      name: "X",
      href: `https://twitter.com/intent/tweet?url=${u}&text=${text}`,
      bg: "bg-ink hover:bg-ink-soft",
      label: "X",
    },
    {
      name: "Facebook",
      href: `https://www.facebook.com/sharer/sharer.php?u=${u}`,
      bg: "bg-[#1877F2] hover:bg-[#0d5fce]",
      label: "f",
    },
    {
      name: "LINE",
      href: `https://social-plugins.line.me/lineit/share?url=${u}`,
      bg: "bg-[#06C755] hover:bg-[#05a648]",
      label: "LINE",
    },
  ];

  return (
    <div className="flex items-center gap-2">
      <span className="font-heading text-[11px] font-extrabold uppercase text-gray">
        {t("labels.share")}
      </span>
      {items.map((item) => (
        <a
          key={item.name}
          href={item.href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={item.name}
          className={`flex h-[26px] items-center justify-center rounded-[4px] border-2 border-ink px-2.5 font-heading text-[11px] font-extrabold uppercase text-white ${item.bg}`}
        >
          {item.label}
        </a>
      ))}
    </div>
  );
}
