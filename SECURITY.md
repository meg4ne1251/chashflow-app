# Security Policy

## Supported Versions

このプロジェクトは個人開発・自己ホスティング向けのシングルユーザー家計簿アプリです。
セキュリティ対応は **`main` ブランチの最新コミットのみ** が対象となります。

| Version | Supported |
|---|---|
| `main` (latest) | :white_check_mark: |
| それ以前のリリース・コミット | :x: |

## Reporting a Vulnerability

セキュリティ脆弱性を発見された場合、**公開 Issue には記載しないでください**。
攻撃者に悪用される前に修正できるよう、以下のいずれかの方法で非公開にご報告ください。

### 報告方法（推奨順）

1. **GitHub Security Advisories（推奨）**
   - 本リポジトリの [Security] タブ → [Report a vulnerability] から非公開で報告できます
   - 添付ファイル（PoC、スクリーンショット等）も非公開で共有可能

2. **メールでの報告**
   - 連絡先: `yuuta171224@gmail.com`
   - 件名に `[SECURITY]` プレフィックスを付けてください

### 報告に含めていただきたい情報

- 脆弱性の概要（影響範囲・想定される攻撃シナリオ）
- 再現手順（PoC があれば添付）
- 影響を受けるバージョン / コミット SHA
- 報告者の連絡先（クレジット表記の希望可否）

### 対応プロセス

| ステップ | 目安 |
|---|---|
| 初動応答（受領確認） | 報告から **48 時間以内** |
| 影響評価・対応方針の連絡 | 受領から **7 日以内** |
| 修正版の公開 | 重大度に応じて調整（Critical は可能な限り迅速に） |

修正版の公開後、報告者の同意を得たうえで GitHub Security Advisories に詳細を公開し、クレジットを記載します。

## Scope

以下は本ポリシーのスコープ内です。

- バックエンド API（`backend/`）
- Web フロントエンド（`web/`）
- Discord Bot（`bot/`）
- インフラ設定（`docker/`、`docker-compose.yml`、`Dockerfile`）

以下はスコープ外です。

- 自己ホスティング環境のサーバー OS / ネットワーク設定の不備
- 利用者本人が `.env` 等に脆弱な値（短い JWT_SECRET、デフォルトパスワード）を設定したことに起因する問題
- 依存ライブラリの既知の脆弱性のうち、本プロジェクトのコードからは到達しないもの
- ブラウザ / OS の脆弱性

## Security Best Practices for Self-Hosters

自己ホスティングする方は、以下を徹底してください（詳細は README.md 参照）。

- `JWT_SECRET` は `openssl rand -base64 48` で生成した強い値を使用する
- `POSTGRES_PASSWORD` はデフォルト値（`kakeibo`）を絶対に使用しない
- 公開時は HTTPS 終端（Cloudflare 経由 または Let's Encrypt + Nginx 443）を必須とする
- `CORS_ALLOWED_ORIGINS` は本番ドメインに限定する
- 定期的に `git pull` で最新版に追従し、`docker compose pull && docker compose up -d --build` で再起動する
- PostgreSQL の論理バックアップ（`pg_dump`）を定期的に取得する
