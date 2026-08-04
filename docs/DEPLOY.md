# アニメメディア 本番デプロイ手順

CLAUDE.md §11 準拠。インフラは huandaonews と同一構成に、アニメメディア固有の
サービス(AI翻訳=OpenAI・スパム対策=Turnstile・会員OAuth・IndexNow)を上乗せする。

| サービス | 役割 | 必須 |
|---|---|---|
| **Supabase** | マネージド Postgres としてのみ使用(Data API OFF) | ◎ |
| **Vercel** | ホスティング / ISR / Cron(**Proプラン**=分単位cron) | ◎ |
| **Cloudflare** | DNS ゾーン管理 + R2(画像)+ Turnstile(スパム対策) | ◎ |
| **Cloudflare R2** | 公開画像 `img.{{DOMAIN}}` カスタムドメイン配信 | ◎ |
| **OpenAI** | 記事生成・翻訳・モデレーション・固有名詞抽出 | ◎ |
| **Resend** | 会員登録確認・受賞通知・PR承認通知メール | ○ |
| **会員OAuth** | Google / Discord / X ログイン | ○(後追い可) |

> 別途指示待ち: `{{SITE_NAME}}` / `{{DOMAIN}}` / `{{PROJECT_SLUG}}` / `{{BRAND_COLOR}}` / `{{LOGO}}`
> ドメイン未確定でも、まず Vercel の仮URL(`*.vercel.app`)で公開 → 後からカスタムドメインを接続できる。

---

## STEP 0. 事前準備(ローカルで秘密鍵を生成)

Vercel に入れる秘密情報を先に作っておく。ターミナルで:

```bash
echo "AUTH_SECRET=$(openssl rand -base64 32)"
echo "PREVIEW_SECRET=$(openssl rand -hex 16)"
echo "CRON_SECRET=$(openssl rand -hex 16)"
echo "INDEXNOW_KEY=$(openssl rand -hex 16)"
```

出力4行を控える(後で Vercel 環境変数に貼る)。

---

## STEP 1. Supabase(Postgres)

1. 新規プロジェクト作成。リージョンは **Northeast Asia (Tokyo) = ap-northeast-1**
2. Settings → **Data API を OFF**(DBとしてのみ使用。RLS/Supabase Auth は使わない)
3. DBパスワードは**英数字のみ**(記号を使うなら接続文字列でURLエンコード必須)
4. **Connect** から接続文字列を2種類控える:
   - **Transaction pooler (6543)** → `DATABASE_URL`。末尾に必ず
     `?pgbouncer=true&connection_limit=10&sslmode=require`
     - ⚠ `connection_limit=1` はビルドの並列静的生成で pool timeout → **10**
     - ⚠ 直結 `db.<ref>.supabase.co` は **IPv6専用で Vercel から繋がらない** → 必ず pooler
   - **Session pooler (5432)** → `DIRECT_DATABASE_URL`(マイグレーション用)

## STEP 2. OpenAI

1. https://platform.openai.com/api-keys で API キー発行 → `OPENAI_API_KEY`
2. 課金(支払い方法)を有効化。翻訳は品質重視モデル・モデレーションは軽量モデルで役割分離:
   - `AI_PROVIDER=openai`
   - `AI_MODEL_WRITE=gpt-4o` / `AI_MODEL_TRANSLATE=gpt-4o` / `AI_MODEL_MODERATE=gpt-4o-mini`
3. ⚠ キー未設定・未課金だと翻訳/記事化ジョブが失敗して needs_review に滞留する

## STEP 3. Cloudflare(ゾーン + R2 + Turnstile)

### 3-1. DNS ゾーン
1. Cloudflare にサイト追加 → `{{DOMAIN}}`
2. 表示された2つのネームサーバーをレジストラ側で設定 → ゾーンが **Active** になるまで待つ
3. Active 後にレコード追加:

| Type | Name | Content | Proxy |
|---|---|---|---|
| A | `@` | `76.76.21.21` (Vercel) | **DNS only(グレー雲)** |
| CNAME | `www` | `cname.vercel-dns.com` | **DNS only** |
| CNAME | `img` | (R2 が自動作成) | **Proxied(オレンジ雲)** |

- ⚠ apex/www を Proxied にすると Vercel の証明書発行に失敗 → **必ず DNS only**

### 3-2. R2(画像ストレージ)
1. バケット作成: **`{{PROJECT_SLUG}}-public`**
2. バケット → Settings → Custom Domains に `img.{{DOMAIN}}` を追加(自動で Proxied)
3. R2 API トークン(Object Read & Write・当該バケット限定)→ `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY`
4. 環境変数: `R2_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com` /
   `R2_BUCKET={{PROJECT_SLUG}}-public` / `R2_PUBLIC_BASE_URL=https://img.{{DOMAIN}}`

### 3-3. Turnstile(会員登録・投稿・PR送信のスパム対策)
1. Cloudflare → Turnstile → サイト追加 → `NEXT_PUBLIC_TURNSTILE_SITE_KEY` / `TURNSTILE_SECRET_KEY`

## STEP 4. Resend(メール)

1. ドメイン追加 → 表示される DKIM/SPF を Cloudflare DNS に追加 → Verify
2. API キー → `RESEND_API_KEY`

## STEP 5. 会員OAuth(任意・後追い可)

各コンソールでリダイレクトURI `https://{{DOMAIN}}/api/auth/callback/{provider}` を登録:
- Google → `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET`
- Discord → `AUTH_DISCORD_ID` / `AUTH_DISCORD_SECRET`
- X → `AUTH_TWITTER_ID` / `AUTH_TWITTER_SECRET`

(未設定のプロバイダーはログイン画面に出ないだけで、他機能に影響なし)

## STEP 6. Vercel

1. New Project → GitHub リポジトリ(`apocccc/anime-media-all`)を Import
2. **Production Branch = `main`**(※現在の作業ブランチを main にマージ後)
3. Build Command は `vercel.json` に設定済み(`npx prisma migrate deploy && next build`)。
   関数リージョンは `hnd1`(東京)固定済み
4. **Pro プラン**に(cron を分単位で使うため)
5. 環境変数(Production / Preview 共通。`.env.example` 全項目):

```
DATABASE_URL          = (Supabase Transaction pooler 6543 のURL)
DIRECT_DATABASE_URL   = (Supabase Session pooler 5432 のURL)
NEXT_PUBLIC_SITE_URL  = https://{{DOMAIN}}
NEXT_PUBLIC_SITE_NAME = {{SITE_NAME}}
NEXT_PUBLIC_IMG_HOST  = img.{{DOMAIN}}
AUTH_SECRET           = (STEP 0)
PREVIEW_SECRET        = (STEP 0)
CRON_SECRET           = (STEP 0)
INDEXNOW_KEY          = (STEP 0)
AI_PROVIDER           = openai
OPENAI_API_KEY        = sk-...
AI_MODEL_WRITE        = gpt-4o
AI_MODEL_TRANSLATE    = gpt-4o
AI_MODEL_MODERATE     = gpt-4o-mini
R2_ENDPOINT           = https://<account-id>.r2.cloudflarestorage.com
R2_ACCESS_KEY_ID      = ...
R2_SECRET_ACCESS_KEY  = ...
R2_BUCKET             = {{PROJECT_SLUG}}-public
R2_PUBLIC_BASE_URL    = https://img.{{DOMAIN}}
NEXT_PUBLIC_TURNSTILE_SITE_KEY = ...
TURNSTILE_SECRET_KEY  = ...
RESEND_API_KEY        = re_...
PRIZE_TIMEZONE        = Asia/Tokyo
UPLOAD_MAX_MB         = 8
NEXT_PUBLIC_GA_ID     = (任意 G-...)
PRESS_API_KEYS        = (任意・提携先向けPR APIキー。カンマ区切り)
# 会員OAuth(任意)
AUTH_GOOGLE_ID= / AUTH_GOOGLE_SECRET=
AUTH_DISCORD_ID= / AUTH_DISCORD_SECRET=
AUTH_TWITTER_ID= / AUTH_TWITTER_SECRET=
```

6. Domains: `{{DOMAIN}}` と `www.{{DOMAIN}}` を追加(www→apex リダイレクト推奨)
7. ⚠ **Preview デプロイも本番DBに `migrate deploy` する**(スキーマ変更PRは本番DBを先に移行)

## STEP 7. 初期化(カテゴリー7種 + 管理者)

デプロイ成功後(マイグレーションは Build で適用済み)、ローカルから本番DBへ:

```bash
DATABASE_URL="<Transaction poolerのURL>" \
DIRECT_DATABASE_URL="<Session poolerのURL>" \
SEED_ADMIN_EMAIL="admin@{{DOMAIN}}" \
SEED_ADMIN_PASSWORD="<12文字以上の強いパスワード>" \
pnpm db:seed:prod
```

## STEP 8. 公開後の設定

1. `https://{{DOMAIN}}/admin` にログイン(STEP 7 の管理者)
2. **RSS ソース登録**(`/admin/rss`):
   - 通常フィード = 収集 → AI日本語記事化 → 5言語翻訳 → 公開
   - **プレスリリース源**(「プレスリリース源」にチェック)= 例 apocwire アニメカテゴリー。
     原文を press-release へ即時公開 + 独自AI記事化して各カテゴリーへ振り分け
3. Cron はデプロイ即有効(`vercel.json`):
   - 毎分: 予約公開リリース / 10分毎: RSS収集 / JST 9・15・21時: 記事生成 /
     2分毎: 翻訳・記事化ジョブ / JST 3時: 用語監査 / 月曜0時(JST): 週次プライズ集計
4. Google Search Console にプロパティ追加 → `sitemap.xml` と各 `news-sitemap-{locale}.xml` を送信

## 落とし穴チェックリスト

- [ ] Supabase は **pooler 接続**(直結はIPv6専用で Vercel 不可)
- [ ] `connection_limit=10`(1だと並列ビルドで pool timeout)
- [ ] DBパスワードは英数字のみ(記号は URL エンコード)
- [ ] apex/www は **DNS only(グレー雲)**、img(R2) は **Proxied(オレンジ雲)**
- [ ] 画像がアップできるのに表示されない → img カスタムドメインの有効化待ち
- [ ] Build Command に `prisma migrate deploy`(設定済み)/ Preview も本番DBを触る
- [ ] Vercel は **Pro プラン**(分単位 cron)/ `CRON_SECRET` 必須(未設定だと cron は fail-closed で実行しない)
- [ ] OpenAI キー・課金が有効(未設定だと翻訳/記事化が needs_review に滞留)
