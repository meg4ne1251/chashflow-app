# cashflow-app

個人向けの家計簿アプリです。Web GUI・Discord Bot からデータを記録し、バックエンド API が PostgreSQL でデータを一元管理します。

> [!IMPORTANT]
> **本アプリはシングルユーザー（自己ホスティング 1 ユーザー）設計です。**
> - 1 つのデプロイにつき 1 名の利用者を想定しています（家族複数人での共有や、マルチテナント SaaS としての利用は対象外）。
> - 初回セットアップ（`/auth/setup`）はユーザーがゼロのときのみ通過するため、2 人目以降のサインアップ機能はありません。
> - 複数人で共有したい場合は、それぞれ別インスタンスを立てて運用してください。

## アーキテクチャ

```
[ブラウザ (Web GUI)]        [Discord Bot]
        │                        │
        └──────────┬─────────────┘
                   │ HTTP / REST
             [Nginx (リバースプロキシ + SPA ホスト)]
                   │
            [Backend API (Ktor)]
                   │
            [PostgreSQL 16]
```

| コンポーネント | 技術 |
|---|---|
| Backend | Kotlin 2.0 / Ktor 3 / Exposed 0.56 / Flyway / HikariCP |
| Web GUI | React 19 / TypeScript / Vite 7 / MUI 7 / TanStack Query v5 |
| Discord Bot | Python / discord.py |
| DB | PostgreSQL 16 |
| インフラ | Docker Compose / Nginx |
| 監視 (任意) | Prometheus / Micrometer |

## 主な機能

- 収入・支出の記録（カテゴリ、タグ、アカウント、メモ）
- 複数アカウント（現金・銀行口座・クレジットカード）と残高管理
- アカウント間の振替
- 定期支出の自動登録（日次バッチ）
- テンプレートからのワンタッチ入力
- Discord Bot から `/add` コマンドで素早く登録
- 予算管理
- 月別・カテゴリ別レポート（グラフ）
- PDF エクスポート
- 全文検索・フィルタリング

## セットアップ

### 必要環境

- Docker 24+ / Docker Compose v2
- （開発時）JDK 21、Node.js 20+

### 1. 環境変数を設定する

```bash
cp .env.example .env
```

`.env` を編集して必須項目を設定します。

| 変数名 | 必須 | 説明 |
|---|---|---|
| `POSTGRES_PASSWORD` | ✓ | PostgreSQL パスワード（**デフォルト値 `kakeibo` は本番起動時に拒否されます**） |
| `JWT_SECRET` | ✓ | JWT 署名キー（`openssl rand -base64 48` で生成、32 文字以上必須） |
| `CORS_ALLOWED_ORIGINS` | | 本番ドメイン（例: `https://example.com`、デフォルト: `http://localhost:5173`） |
| `LISTEN_PORT` | | 公開ポート（デフォルト: `80`） |
| `KTOR_ENV` | | 本番環境では `production` を設定（Cookie の `Secure` 属性などが有効化されます） |

### 2. ビルド・起動

```bash
# 基本セット（DB + Backend + Nginx）
docker compose up -d --build

# Discord Bot も含めて起動
docker compose --profile bot up -d --build

# 監視 (Prometheus) も含めて起動
docker compose --profile monitoring up -d --build
```

起動後 `http://localhost` にアクセスしてください。

## 本番運用

> [!WARNING]
> **本アプリを公開ネットワーク上で運用する場合、HTTPS 終端は必須です。** `docker-compose.yml` の標準構成は HTTP（port 80）のみを公開するため、別途 HTTPS 終端を設定してください。

### HTTPS 終端の構成（いずれかを選択）

#### 推奨 A: Cloudflare 経由

Cloudflare の DNS Proxy を有効化し、SSL/TLS モードを **Full (strict)** に設定します。

- HSTS、TLS 終端、HTTP/3、DDoS 対策が Cloudflare 側で完結
- `docker/nginx/default.conf` の CSP には `cloudflareinsights.com` が許可済み
- Cloudflare ダッシュボードで HSTS（`Strict-Transport-Security`）を有効化してください
- オリジンサーバー（自宅サーバー / VPS）は Cloudflare の IP からのみ受け付けるよう Firewall で制限することを推奨

#### 推奨 B: Caddy または Nginx + Let's Encrypt

`docker-compose.yml` の Nginx の前段に Caddy を置く、または `docker/nginx/default.conf` に 443 リスナーと `Strict-Transport-Security` ヘッダーを追加して Let's Encrypt 証明書で終端します。

```nginx
# docker/nginx/default.conf に追記する例
server {
    listen 443 ssl http2;
    server_name your.domain.example;

    ssl_certificate     /etc/letsencrypt/live/your.domain.example/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your.domain.example/privkey.pem;

    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    # ... 既存の location ブロックをコピー
}
```

### 本番チェックリスト

公開前に以下を必ず確認してください。

- [ ] `JWT_SECRET` を `openssl rand -base64 48` で生成した強い値に設定（32 文字以上）
- [ ] `POSTGRES_PASSWORD` をデフォルト値 `kakeibo` 以外に変更
- [ ] `CORS_ALLOWED_ORIGINS` を本番ドメインに限定（カンマ区切りで複数指定可）
- [ ] `KTOR_ENV=production` を設定（Cookie `Secure` 属性が有効化される）
- [ ] HTTPS 終端を構成し、HSTS を有効化
- [ ] PostgreSQL の論理バックアップ運用を確立（`pg_dump` の cron + リストア手順書）
- [ ] `/api/v1/metrics` が外部からアクセス不可であることを確認
- [ ] 初回セットアップ後、`/auth/setup` が再度通過しないことを確認

## 開発

### Backend (Kotlin / Ktor)

```bash
# PostgreSQL だけ起動しておく
docker compose up -d db

# バックエンド起動（ホットリロードなし）
./gradlew :backend:run
```

API は `http://localhost:8080` で起動します。

### Web GUI (React / Vite)

```bash
cd web
npm install
npm run dev        # 開発サーバー: http://localhost:5173
npm run type-check # 型チェック
npm run test       # ユニットテスト (Vitest)
npm run e2e        # E2Eテスト (Playwright)
```

### Discord Bot

設定手順は [bot/README.md](bot/README.md) を参照してください。

## プロジェクト構成

```
cashflow-app/
├── backend/          # Kotlin / Ktor API サーバー
│   └── src/
│       └── main/kotlin/com/kakeibo/backend/
│           ├── plugins/      # Ktor プラグイン設定
│           ├── routing/      # ルーティング定義
│           ├── repository/   # DB アクセス層 (Exposed)
│           └── service/      # ビジネスロジック
├── web/              # React フロントエンド
│   └── src/
│       ├── api/          # API クライアント
│       ├── components/   # 共通コンポーネント
│       ├── pages/        # ページコンポーネント
│       ├── hooks/        # カスタムフック
│       └── stores/       # Zustand ストア
├── bot/              # Discord Bot (Python)
├── shared/           # Backend/共有ロジック
├── docker/           # Nginx・Prometheus 設定
├── docker-compose.yml
├── .env.example
├── requirements.md       # 要件定義書
└── database_design.md    # データベース設計書
```

## ドキュメント

- [要件定義書](requirements.md)
- [データベース設計書](database_design.md)
- [Discord Bot セットアップ](bot/README.md)
- [セキュリティポリシー](SECURITY.md)
- [コントリビュートガイド](CONTRIBUTING.md)

## セキュリティ

脆弱性を発見された場合は **公開 Issue ではなく** [SECURITY.md](SECURITY.md) の手順に従って非公開でご報告ください。

## ライセンス

[LICENSE](LICENSE) を参照してください。
