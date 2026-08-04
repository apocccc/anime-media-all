/**
 * SNS埋め込みレンダラー(§8.1 の embed 投稿)。
 * 投稿URLからプロバイダーを判定し、実際の埋め込み(iframe)を表示する。
 * - Facebook(fb.watch / facebook.com): 動画/投稿プラグインの iframe
 * - YouTube(youtube.com / youtu.be): nocookie iframe
 * - X / Instagram / TikTok: 公式SDK無しで安定描画するのは難しいため、
 *   枠付きのリンクカードにフォールバック(原文リンクは常に保持)
 * 枠は 2px 黒罫線のマット様式。影・グラデーション不使用。
 */

type EmbedKind = "facebook" | "youtube" | "link";

export function detectEmbed(url: string): { kind: EmbedKind; src?: string } {
  let host = "";
  try {
    host = new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return { kind: "link" };
  }

  // Facebook(fb.watch 短縮URL含む)は動画プラグインの iframe で埋め込む
  if (host === "fb.watch" || host.endsWith("facebook.com")) {
    const src = `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(
      url
    )}&show_text=false&width=560`;
    return { kind: "facebook", src };
  }

  // YouTube
  if (host === "youtu.be" || host.endsWith("youtube.com")) {
    let id = "";
    try {
      const u = new URL(url);
      id =
        host === "youtu.be"
          ? u.pathname.slice(1)
          : (u.searchParams.get("v") ?? u.pathname.split("/").pop() ?? "");
    } catch {
      id = "";
    }
    if (id) {
      return {
        kind: "youtube",
        src: `https://www.youtube-nocookie.com/embed/${id}`,
      };
    }
  }

  return { kind: "link" };
}

export function EmbedRenderer({
  url,
  provider,
  viewOnLabel,
}: {
  url: string;
  provider?: string | null;
  /** リンクフォールバック時の「元の投稿を見る」ラベル(i18n済み文字列) */
  viewOnLabel: string;
}) {
  const embed = detectEmbed(url);

  if (embed.kind === "facebook" && embed.src) {
    // 縦動画(Reels/fb.watch)も収まるよう縦長比率の枠に収める
    return (
      <figure className="mt-5">
        <div className="overflow-hidden rounded-[13px] border-2 border-ink bg-bg-sub">
          <div
            className="relative mx-auto w-full max-w-[500px]"
            style={{ aspectRatio: "9 / 16" }}
          >
            <iframe
              src={embed.src}
              title={provider ?? "Facebook post"}
              className="absolute inset-0 h-full w-full"
              style={{ border: "none", overflow: "hidden" }}
              scrolling="no"
              frameBorder="0"
              allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share"
              allowFullScreen
            />
          </div>
        </div>
        <OriginalLink url={url} provider={provider} label={viewOnLabel} />
      </figure>
    );
  }

  if (embed.kind === "youtube" && embed.src) {
    return (
      <figure className="mt-5">
        <div className="overflow-hidden rounded-[13px] border-2 border-ink bg-ink">
          <div className="relative w-full" style={{ aspectRatio: "16 / 9" }}>
            <iframe
              src={embed.src}
              title={provider ?? "YouTube video"}
              className="absolute inset-0 h-full w-full"
              style={{ border: "none" }}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
            />
          </div>
        </div>
        <OriginalLink url={url} provider={provider} label={viewOnLabel} />
      </figure>
    );
  }

  // フォールバック: 枠付きリンクカード(X / Instagram / TikTok 等)
  return (
    <a
      href={url}
      target="_blank"
      rel="ugc nofollow noopener"
      className="mt-5 flex items-center justify-between gap-3 rounded-[13px] border-2 border-ink bg-surface px-4 py-3 hover:bg-primary-light"
    >
      <span className="min-w-0">
        {provider ? (
          <span className="mb-0.5 block font-heading text-[11px] font-extrabold uppercase text-gray">
            {provider}
          </span>
        ) : null}
        <span className="block break-all text-sm font-semibold text-primary underline underline-offset-2">
          {url}
        </span>
      </span>
      <span className="shrink-0 font-heading text-[11px] font-extrabold uppercase text-ink">
        {viewOnLabel} <span aria-hidden="true">→</span>
      </span>
    </a>
  );
}

/**
 * カード一覧用のコンパクトな埋め込みプレビュー。
 * 親要素(position: relative の 4/3 枠など)を満たすように iframe を敷く。
 * iframe を読み込めない環境では再生バッジ+プロバイダー名にフォールバックする。
 * カード全体は Link で包まれているため、iframe はクリックを透過させる
 * (pointer-events-none)= プレビュー表示専用にして、クリックは詳細ページへ。
 */
export function EmbedPreview({
  url,
  provider,
}: {
  url: string;
  provider?: string | null;
}) {
  const embed = detectEmbed(url);
  const canEmbed =
    (embed.kind === "facebook" || embed.kind === "youtube") && embed.src;

  return (
    <>
      {/* ベース層: 再生バッジ+プロバイダー名。iframe が読み込めない/未対応でも
          崩れないよう常に背面に敷く */}
      <div
        aria-hidden="true"
        className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-4 text-center"
      >
        <span className="flex h-11 w-11 items-center justify-center rounded-full border-2 border-white text-white">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <path d="M8 5 v14 l11 -7 Z" />
          </svg>
        </span>
        {provider ? (
          <span className="font-heading text-[13px] font-extrabold uppercase text-white">
            {provider}
          </span>
        ) : null}
      </div>
      {/* 埋め込みプレビュー(iframe)。クリックは透過させ、カードのリンクへ委ねる */}
      {canEmbed ? (
        <div className="pointer-events-none absolute inset-0">
          <iframe
            src={embed.src}
            title={provider ?? "Embedded post"}
            className="h-full w-full"
            style={{ border: "none" }}
            scrolling="no"
            loading="lazy"
            allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share"
          />
        </div>
      ) : null}
    </>
  );
}

/** 埋め込みの下に添える「元の投稿を見る」リンク(読み込めない環境でも辿れる) */
function OriginalLink({
  url,
  provider,
  label,
}: {
  url: string;
  provider?: string | null;
  label: string;
}) {
  return (
    <figcaption className="mt-2">
      <a
        href={url}
        target="_blank"
        rel="ugc nofollow noopener"
        className="inline-flex items-center gap-1 font-heading text-[11px] font-extrabold uppercase text-gray hover:text-primary"
      >
        {provider ? `${provider} — ` : ""}
        {label} <span aria-hidden="true">→</span>
      </a>
    </figcaption>
  );
}
