# cashflow-app

個人向けの家計簿アプリです。Web GUI・Discord Bot からデータを記録し、バックエンド API が PostgreSQL でデータを一元管理します。

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
| `POSTGRES_PASSWORD` | ✓ | PostgreSQL パスワード |
| `JWT_SECRET` | ✓ | JWT 署名キー（`openssl rand -base64 48` で生成） |
| `CORS_ALLOWED_ORIGINS` | | 本番ドメイン（デフォルト: `http://localhost`） |
| `LISTEN_PORT` | | 公開ポート（デフォルト: `80`） |

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

## ライセンス

[LICENSE](LICENSE) を参照してください。
