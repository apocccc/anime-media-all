import Script from "next/script";

/**
 * GA4 測定ID(G-XXXXXXXXXX)の形式。値をインラインスクリプトへ埋め込むため、
 * 想定外の文字が混ざった環境変数をそのまま出力しないよう厳格に検証する。
 */
const GA_ID_PATTERN = /^G-[A-Z0-9]+$/i;

/**
 * GA4 計測タグ。NEXT_PUBLIC_GA_ID が設定されている場合のみ出力される。
 *
 * ページビューはクライアント側ルート遷移も含め GA4 の拡張計測
 * (ブラウザ履歴イベントによるページ変更)が自動送信するため、手動送信はしない
 * (二重計上になる)。
 *
 * locale を content_group として送ることで、GA4 の標準レポート上で
 * 言語版ごとの流入を追加設定なしに比較できる(ブラウザ言語ではなく実際に
 * 閲覧された言語版を見るため。§2.1 の5ロケール)。
 */
export function GoogleAnalytics({
  id,
  locale,
}: {
  id: string;
  locale?: string;
}) {
  if (!GA_ID_PATTERN.test(id)) return null;

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${id}`}
        strategy="afterInteractive"
      />
      <Script id="ga4-init" strategy="afterInteractive">
        {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', ${JSON.stringify(id)}${
          locale ? `, { content_group: ${JSON.stringify(locale)} }` : ""
        });`}
      </Script>
    </>
  );
}
