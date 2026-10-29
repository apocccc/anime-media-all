# Anime Media(仮称)

日本のアニメ・IP情報を5言語(en / ko / zh-Hant / th / zh-Hans)で配信するアニメ専門メディア。
仕様は [`CLAUDE.md`](./CLAUDE.md) を参照。サーバー構成・SEO基盤・CMSの土台は huandaonews を継承し、
多言語翻訳・固有名詞辞書・ファン投稿・プレスリリース受付・週次プライズを上乗せしている。

- サイト名・ドメイン・ブランドカラーは別途指示待ち(`NEXT_PUBLIC_SITE_NAME` / `NEXT_PUBLIC_SITE_URL` で差し替え)

## ローカル起動(Mac)

前提: Node 20+ / pnpm / PostgreSQL 16(`brew install pnpm postgresql@16`)

```bash
./scripts/dev-local.sh
```

これ1コマンドで、プロジェクト専用のローカルPostgres起動 → `.env` 生成 → スキーマ反映 → シード投入 → 開発サーバー起動まで行う。

- 公開サイト: http://localhost:3000 (`/` は Cookie → Accept-Language → en で 307)
- 管理画面: http://localhost:3000/admin — `admin@example.com` / `admin1234`
- 事業者ポータル: http://localhost:3000/partner
- 会員マイページ: http://localhost:3000/my — `member@example.com` / `member1234`(投稿サンプル用 influencer)

AI は既定で `AI_PROVIDER=mock`(APIキー不要の決定的応答)。実際の生成・翻訳を試す場合は
`.env` の `AI_PROVIDER=openai`(`OPENAI_API_KEY`)または `anthropic`(`ANTHROPIC_API_KEY`)を設定する。

### 手動セットアップ(dev-local.sh を使わない場合)

```bash
pnpm install
docker compose up -d          # または任意のPostgres
cp .env.example .env          # DATABASE_URL 等を記入
npx prisma migrate deploy
pnpm db:seed
pnpm dev
```

## コマンド

| コマンド | 内容 |
|---|---|
| `pnpm dev` / `build` / `start` | 開発 / 本番ビルド / 本番起動 |
| `pnpm lint` / `typecheck` | ESLint / tsc |
| `pnpm test` | Vitest(用語辞書の適用と検証・ブロック差分・スラッグ・excluded 除外・cron fail-closed) |
| `pnpm check:i18n` | 5言語 site.json / ja・en admin.json のキー差分検出 |
| `pnpm db:seed` / `db:seed:prod` | 開発シード / 本番初期データ |

## cron(ローカルでの手動実行)

`CRON_SECRET` 未設定のローカルでは認証なしで叩ける(本番は fail-closed):

```bash
curl localhost:3000/api/cron/ingest          # RSS収集(10分毎相当)
curl localhost:3000/api/cron/generate        # 日本語マスター記事生成(1日3回相当)
curl localhost:3000/api/cron/jobs            # 翻訳・モデレーションのジョブキュー drain(2分毎相当)
curl localhost:3000/api/cron/publish         # 予約公開(毎分相当)
curl localhost:3000/api/cron/glossary-audit  # 用語表記監査(毎日相当)
curl localhost:3000/api/cron/prize           # 週次プライズ締め(月曜JST 0時相当)
```

パイプライン: RSS取り込み(生ソース+ja pending)→ generate が日本語マスター化 → 用語抽出 →
translate ジョブが5言語へ並列翻訳(辞書注入+機械検証+1回リペア)→ publish が予約公開。

## 構成の要点

- **多言語データモデル**: `Article`(言語非依存)+ `ArticleTranslation`(articleId × locale)。公開判定は
  `Article.status=published` かつ 当該ロケールの翻訳 `∈ {approved, machine}`。`excluded` は当該ロケールで
  記事を存在させない(一覧・sitemap・feed 除外、直リンクは en へ 302)
- **URL**: `/{locale}/news/{category}/{yyyymmdd}-{slug}`。スラッグはロケール非依存(英語ベース)。
  `localePrefix: always`、canonical は各ロケール自身、hreflang 5ロケール + x-default=en
- **固有名詞辞書**: `Term` / `TermForm` / `TermAlias`。翻訳時に確定表記をプロンプト注入し、出力を文字列で
  機械検証 → NG は1回リペア → なお NG は needs_review。表記変更時は該当記事の再翻訳ジョブを自動投入
- **ジョブキュー**: `Job` テーブル(DBキュー)。指数バックオフ最大5回、超過は dead-letter として `/admin/jobs` に表示
- **SEO**: ロケール別 sitemap(hreflang付き)+ news-sitemap、RSS/Atom/JSON Feed、robots.txt はAIクローラー明示許可、llms.txt
- **プレスリリース**: `/partner` ポータル(審査制)。翻訳オプション(全言語 / 翻訳不要 / 個別選択)、
  PRラベル・`Article` 型JSON-LD・`rel="sponsored nofollow"`・トップ主要面から分離
- **ファン投稿**: 作品紐付け必須、AIスクリーニング → 人手承認(influencer のみ自動承認)、
  キャプションAI翻訳(原文常時併記)、`rel="ugc nofollow"`、薄い投稿は noindex
- **プライズ**: 月曜0時JSTサイクル、読者投票(上限つき)+編集部最終審査、`RewardCatalog` で地域→賞品を
  データ駆動化(韓国・台湾・タイの賞品は §9.2 のとおり別途指示待ち)

## デプロイ

Vercel + Supabase(ap-northeast-1)+ Cloudflare R2 / Turnstile + Resend。`vercel.json` に cron 定義済み
(分単位cronのため Pro プラン前提)。環境変数は `.env.example` を参照。
`buildCommand` が `prisma generate && prisma migrate deploy && next build` を実行する
(`prisma generate` はビルドキャッシュで install がスキップされたときに Prisma Client が
古いまま残るのを防ぐため。外すとスキーマ変更時にビルドが落ちる。docs/DEPLOY.md STEP 6)。
