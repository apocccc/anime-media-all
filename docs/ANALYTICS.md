# Google Analytics (GA4) / Search Console 連携手順

計測タグ・サイトマップ・robots.txt・hreflang はすべて実装済み。
**このドキュメントの作業はコード変更を伴わない**(環境変数の設定と Google 側の操作のみ)。

以下、ドメインは `animerelay.com` として記載。実際のドメインに読み替える。

---

## 1. Google Analytics (GA4)

### 1-1. プロパティと測定IDの取得

1. https://analytics.google.com → 管理 → **プロパティを作成**
   - プロパティ名: `Anime Relay`
   - レポートのタイムゾーン: **日本**、通貨: 日本円(運用基準が Asia/Tokyo のため。§13)
2. **データストリーム** → ウェブ → URL に `https://animerelay.com`、ストリーム名を入力
3. 表示される **測定ID(`G-XXXXXXXXXX`)** を控える

### 1-2. サイトへ設定

Vercel → Project → Settings → Environment Variables に追加(Production / Preview 両方):

```
NEXT_PUBLIC_GA_ID = G-XXXXXXXXXX
```

> ⚠ `NEXT_PUBLIC_*` は**ビルド時にバンドルへ埋め込まれる**。環境変数を追加しただけでは反映されないので、
> 必ず **Redeploy(再デプロイ)** すること。

形式が `G-XXXXXXXXXX` でない値(旧UAの `UA-...` など)を入れた場合、タグは出力されない。

### 1-3. 計測範囲(実装済みの挙動)

| 対象 | 計測 | 理由 |
|---|---|---|
| 公開サイト `/{locale}/...` | ○ | |
| `/admin` `/partner` `/my` | ✕ | noindex の非公開領域のため意図的に除外 |

- ページビューはクライアント側のルート遷移も含め、GA4 の**拡張計測(ブラウザ履歴イベントによるページ変更)**が自動送信する。追加実装は不要
- **`content_group` に閲覧中のロケール(`en` / `ko` / `zh-Hant` / `th` / `zh-Hans`)を送信している。** GA4 のレポートで「コンテンツ グループ」を選ぶだけで言語版ごとの流入を比較できる(ブラウザ言語ではなく、実際に読まれた言語版で分かれる)

### 1-4. 動作確認

1. デプロイ後に `https://animerelay.com/en` を開く
2. GA4 → レポート → **リアルタイム** に自分のアクセスが出るか確認
3. 出ない場合の切り分け:
   - ページのソースに `googletagmanager.com/gtag/js?id=G-...` が含まれるか(含まれなければ環境変数か再デプロイ漏れ)
   - 広告ブロッカーを無効にしたブラウザで再確認

### 1-5. 推奨する初期設定(Google 側の操作のみ)

- **内部トラフィックの除外**: 管理 → データストリーム → タグ設定を行う → 内部トラフィックの定義 に編集部の固定IPを登録 → データフィルタを「有効」に
- **データ保持期間**: 管理 → データ設定 → データ保持 を **14か月**に(既定の2か月では過去比較ができない)
- **Google シグナル**: 地域別に同意要件が変わるため、法務確認まではオフのままでよい

---

## 2. Google Search Console

### 2-1. プロパティ登録(**ドメインプロパティを推奨**)

| 種別 | 認証方法 | 備考 |
|---|---|---|
| **ドメイン**(推奨) | DNS TXT | apex / www / `img.` サブドメイン / http / https をまとめて1プロパティで扱える。**コード変更・再デプロイ不要** |
| URLプレフィックス | HTMLタグ / GAタグ / HTMLファイル | プロトコルとホストが完全一致したURLのみ対象 |

**ドメインプロパティの手順(推奨):**

1. https://search.google.com/search-console → プロパティを追加 → **ドメイン** → `animerelay.com`
2. 表示される TXT レコード(`google-site-verification=...`)をコピー
3. Cloudflare → 対象ゾーン → DNS → レコードを追加
   - タイプ: `TXT` / 名前: `@` / コンテンツ: コピーした値
   - ※ TXT レコードにプロキシ設定はない(オレンジ雲の対象外)
4. Search Console に戻って「確認」

### 2-2. HTMLタグで認証する場合(URLプレフィックス)

Search Console が表示する meta タグの **`content="..."` の値だけ**を Vercel の環境変数に設定する:

```
GOOGLE_SITE_VERIFICATION = xxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

- `<meta ... />` ごと貼らない。値のみ
- 複数プロパティを同時に認証する場合はカンマ区切り
- 設定後に **Redeploy** が必要
- 公開サイトの全ロケールページの `<head>` に出力される。管理画面には出力されない

> ⚠ **`https://animerelay.com/` は `/en` へ 307 リダイレクトする**(`localePrefix: "always"`。§2.1)。
> そのため URLプレフィックスプロパティを `https://animerelay.com/` で登録すると HTMLタグ認証が通らないことがある。
> その場合は **ドメインプロパティ(2-1)** を使うか、プロパティを `https://animerelay.com/en/` で登録する。
> これがドメインプロパティを推奨する理由。

### 2-3. Google Analytics タグで認証する場合

GA4 タグ(1-2)を設置済みで、**同じ Google アカウントが GA プロパティの「編集者」権限**を持っていれば、
Search Console の認証方法から「Google アナリティクス」を選ぶだけで認証できる。追加の設定は不要。

### 2-4. サイトマップの送信

Search Console → サイトマップ に以下を登録する。

```
sitemap.xml
```

`sitemap.xml` はインデックスサイトマップで、以下を自動的に参照している:

- `/sitemaps/{locale}-pages.xml`(トップ・カテゴリー・作品ページ等)
- `/sitemaps/{locale}-articles-{n}.xml`(記事。4万件ごとに分割)

Googleニュース用サイトマップは**インデックスに含まれない**ため、5本を個別に登録する:

```
news-sitemap-en.xml
news-sitemap-ko.xml
news-sitemap-zh-Hant.xml
news-sitemap-th.xml
news-sitemap-zh-Hans.xml
```

- news-sitemap は**直近48時間**に公開された記事のみを含む(Googleニュースの仕様)。
  記事がまだ無い時期に登録すると「URL が 0 件」と表示されるが正常
- ファン投稿は news-sitemap に含めない(§8.3)

### 2-5. 多言語(hreflang)について

追加作業は不要。実装済みの内容:

- 各ページの `<head>` に5ロケール相互の `hreflang` + `x-default = en`
- サイトマップの各 `<url>` にも `xhtml:link` で hreflang を出力
- 翻訳が存在しない(`excluded`)ロケールは hreflang から除外される(§4.2)
- canonical は各ロケールが自分自身を指す(§10)

Search Console の「国際的なターゲティング」レポートで hreflang エラーが出た場合は、
`GET https://animerelay.com/sitemaps/en-articles-1.xml` を直接開いて `xhtml:link` を確認する。

### 2-6. robots.txt の確認

`https://animerelay.com/robots.txt` を開き、以下を確認:

- `Sitemap:` 行に `sitemap.xml` と5本の news-sitemap が並んでいる
- `/admin` `/partner` `/my` `/api` `/preview` `/search` が Disallow されている
- 主要AIクローラー(GPTBot / ClaudeBot / PerplexityBot / Google-Extended / CCBot / Applebot-Extended)が Allow されている(§10)

---

## 3. GA4 と Search Console のリンク

GA4 のレポート内で検索クエリ・表示回数を見られるようにする(任意だが推奨)。

1. GA4 → 管理 → **サービス間のリンク設定 → Search Console のリンク**
2. 対象プロパティを選択 → ウェブストリームを選択 → 送信
3. GA4 → レポート → **ライブラリ** → 「Search Console」コレクションを**公開**する
   (公開しないと左メニューに出てこない)

---

## 4. 導入チェックリスト

- [ ] GA4 プロパティ作成、測定ID を取得
- [ ] Vercel に `NEXT_PUBLIC_GA_ID` を設定(Production / Preview)
- [ ] **Redeploy した**(`NEXT_PUBLIC_*` はビルド時に埋め込まれるため)
- [ ] GA4 リアルタイムで自分のアクセスを確認
- [ ] GA4 のデータ保持期間を14か月に変更
- [ ] Search Console にドメインプロパティを追加、Cloudflare に TXT レコードを登録して認証
- [ ] (HTMLタグ認証を選んだ場合)`GOOGLE_SITE_VERIFICATION` を設定して Redeploy
- [ ] `sitemap.xml` を送信
- [ ] `news-sitemap-{en,ko,zh-Hant,th,zh-Hans}.xml` を5本とも送信
- [ ] robots.txt を目視確認
- [ ] GA4 ↔ Search Console をリンクし、レポートを公開

---

## 5. 未実装(将来対応)

- **IndexNow**: `INDEXNOW_KEY` の環境変数だけ用意されているが送信処理は未実装(§6.2)。
  Bing / Yandex / Naver への即時通知用。Google は IndexNow 非対応
- **Google のサイトマップ ping**(`google.com/ping?sitemap=`)は 2023年に廃止済みのため実装しない。
  robots.txt の `Sitemap:` 行と Search Console への登録が正規の経路
