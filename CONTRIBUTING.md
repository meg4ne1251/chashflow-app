# Contributing to cashflow-app

cashflow-app への貢献に興味を持っていただきありがとうございます。
本プロジェクトは個人開発・自己ホスティング向けのシングルユーザー家計簿アプリですが、バグ修正・機能改善・ドキュメント整備など、幅広いコントリビュートを歓迎します。

## はじめに

### コミュニケーションの基本

- 大きめの変更（新機能追加、アーキテクチャ変更、依存追加等）は、いきなり PR を出す前に **Issue で相談** してください。方針が合わずに作業が無駄になることを防げます。
- 不具合の報告は Issue に再現手順を添えてお願いします。
- セキュリティに関する報告は **公開 Issue ではなく** [SECURITY.md](SECURITY.md) の手順に従ってください。

### スコープに関する注意

本アプリは **シングルユーザー（自己ホスティング 1 ユーザー）設計** です。
マルチユーザー化・マルチテナント化は DB スキーマの全面改変を要するため、慎重に判断します。
これらの大規模な機能追加を検討される場合は、必ず Issue で先に相談してください。

## 開発環境のセットアップ

### 必要なツール

- Docker 24+ / Docker Compose v2
- JDK 21（Backend 開発時）
- Node.js 20+（Web GUI 開発時）
- Python 3.11+（Discord Bot 開発時）

### セットアップ手順

詳細は [README.md](README.md#セットアップ) を参照してください。

```bash
# 1. リポジトリをフォーク・クローン
git clone https://github.com/<your-username>/cashflow-app.git
cd cashflow-app

# 2. 環境変数を設定
cp .env.example .env
# .env を編集（JWT_SECRET, POSTGRES_PASSWORD 必須）

# 3. PostgreSQL のみ起動
docker compose up -d db

# 4. Backend 起動
./gradlew :backend:run

# 5. Web GUI（別ターミナル）
cd web
npm install
npm run dev
```

## ブランチ運用

- `main` ブランチが常に最新の安定コードです。
- 作業ブランチは `main` から切り、命名は以下のプレフィックスを推奨します。
  - `feat/<short-description>` — 新機能
  - `fix/<short-description>` — バグ修正
  - `docs/<short-description>` — ドキュメント
  - `refactor/<short-description>` — リファクタリング
  - `chore/<short-description>` — その他のメンテナンス

## コミットメッセージ

[Conventional Commits](https://www.conventionalcommits.org/) のスタイルに準じます。

```
<type>: <subject>

<body>
```

- `type`: `feat` / `fix` / `docs` / `refactor` / `chore` / `test` / `ci` / `style` / `perf`
- `subject`: 50 文字以内、現在形・命令形（"Fix" ではなく "fix"、"Added" ではなく "add"）
- 必要に応じて `body` で「なぜ」その変更が必要なのかを記載

例:
```
fix: prevent duplicate execution of recurring transaction scheduler

executionInProgress フラグの解放漏れが発生していたため、try-finally で確実にリリースする。
```

## Pull Request

### PR 作成前のチェックリスト

- [ ] `main` から fast-forward できる状態（`git pull --rebase origin main`）
- [ ] 変更に対応するテストを追加・更新した
- [ ] ローカルで全テストが通る
  - Backend: `./gradlew :backend:test`
  - Web GUI: `cd web && npm run test && npm run type-check && npm run build`
  - E2E: `cd web && npm run e2e`
- [ ] フロントエンド変更時、**モバイル版・PC 版の両方** で動作確認した（[CLAUDE.md](CLAUDE.md) 参照）
- [ ] 公開 API の変更がある場合、`shared/` の DTO・ValidationRules を更新した
- [ ] 新規依存追加時、ライセンス互換性（MIT 互換）を確認した

### PR の説明に含めること

- 変更の概要（何を、なぜ）
- 関連 Issue（あれば `Closes #123` で紐付け）
- 動作確認手順（特に UI 変更時はスクリーンショット推奨）
- breaking change がある場合はその旨を明記

## コーディング規約

### Backend (Kotlin)

- Kotlin 公式コーディング規約に準拠（IntelliJ デフォルト）
- 関連する Repository 呼び出しは **必ず単一の `transaction { ... }` ブロック** で囲む
- ループ内で `findAll()` を呼ぶ N+1 を避け、ループ外でまとめて取得する
- Service 層から直接 SQL 文字列を組み立てない（Exposed の DSL を使用）
- 楽観ロックを持つテーブル（`version` カラムあり）への更新時は `currentVersion` を必ず引数に取る

### Web GUI (TypeScript / React)

- 関数コンポーネント + Hooks スタイル
- 同じ `queryKey` を使う場合は、`queryFn` の戻り値の型を全コンポーネントで揃える
- フロントエンド変更時は、`useMobile()` で分岐している箇所を含めて **モバイル・PC 両方** に変更を反映する
- 新規ページ追加時は、Loading / Empty / Error 状態をすべて実装する

### Discord Bot (Python)

- `black` でフォーマット
- `discord.py` の `app_commands`（slash commands）を使用

## テスト

### Backend テスト

```bash
# 全テスト
./gradlew :backend:test

# 特定のテストクラスのみ
./gradlew :backend:test --tests "com.kakeibo.backend.security.*"
```

### Web GUI テスト

```bash
cd web
npm run test          # Vitest（ユニット）
npm run e2e           # Playwright（E2E）
npm run type-check    # tsc --noEmit
```

## ライセンスと著作権

本プロジェクトへのコントリビュートは、[LICENSE](LICENSE)（MIT License）の下で公開されることに同意したものとみなします。
他者の著作物・コピーレフトライセンス（GPL/AGPL）のコードを含めないでください。

## 質問・相談

- バグ報告・機能要望: GitHub Issues
- セキュリティ報告: [SECURITY.md](SECURITY.md)

ご協力ありがとうございます。
