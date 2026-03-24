# cashflow-app Discord Bot

Discordから cashflow-app にテンプレートを使って素早く取引を登録するBotです。

## 使い方

Discordで `/add` コマンドを実行するだけです。

```
1. /add を実行
2. セレクトメニューからテンプレートを選択
   - 金額が設定済みのテンプレート → 確認ボタンが表示される
   - 金額が未設定のテンプレート  → 金額入力ダイアログが表示される
3. 確定すると取引が登録される（日時は現在時刻が自動設定される）
```

メッセージは自分にしか見えません（ephemeral）。

---

## セットアップ

### 1. Discord Bot を作成する

1. [Discord Developer Portal](https://discord.com/developers/applications) を開く
2. **New Application** → 名前を設定（例: `cashflow-bot`）
3. 左メニュー **Bot** → **Reset Token** → Token をコピーしておく
4. Privileged Gateway Intents は **全てOFF** でよい（スラッシュコマンドのみ使用）
5. 左メニュー **OAuth2** → **URL Generator**
   - Scopes: `bot` と `applications.commands` にチェック
   - Bot Permissions: `Send Messages` にチェック
6. 生成された URL をブラウザで開き、Botを自分のサーバーに招待する

### 2. 必要なIDを確認する

Discordの **設定 → 詳細設定 → 開発者モード** をオンにする。

| ID | 取得方法 |
|----|---------|
| Guild ID | サーバー名を右クリック → 「IDをコピー」 |
| 自分のUser ID | 自分のアイコンを右クリック → 「IDをコピー」 |

### 3. `.env` を編集する

プロジェクトルートの `.env` に以下を記入する。

```env
DISCORD_BOT_TOKEN=（Developer Portal で取得した Token）
DISCORD_GUILD_ID=（サーバーの Guild ID）
DISCORD_ALLOWED_USER_ID=（自分の User ID）
CASHFLOW_USERNAME=（cashflow-app のログインユーザー名）
CASHFLOW_PASSWORD=（cashflow-app のログインパスワード）
```

`DISCORD_ALLOWED_USER_ID` は任意です。設定するとそのユーザーだけが `/add` を使えます。空欄にするとサーバーの全員が使用できます。

### 4. 起動する

```bash
# Botのみビルド・起動
docker compose up -d --build bot

# ログを確認
docker compose logs -f bot
```

以下のログが表示されれば正常に起動しています。

```
Login successful
Slash commands synced to guild XXXX
Ready: cashflow-bot (id=XXXX)
```

スラッシュコマンドが Discord に反映されるまで数秒〜数分かかることがあります。

---

## 環境変数一覧

| 変数名 | 必須 | 説明 |
|--------|------|------|
| `DISCORD_BOT_TOKEN` | 必須 | Discord Developer Portal で取得した Bot Token |
| `DISCORD_GUILD_ID` | 必須 | Botを動作させる Discord サーバーの Guild ID |
| `DISCORD_ALLOWED_USER_ID` | 任意 | Botを使用できるユーザーの Discord User ID（未設定 = 全員許可） |
| `CASHFLOW_USERNAME` | 必須 | cashflow-app のログインユーザー名 |
| `CASHFLOW_PASSWORD` | 必須 | cashflow-app のログインパスワード |
| `API_BASE_URL` | 不要 | デフォルト `http://app:8080`（Docker内部通信） |

---

## 停止・再起動

```bash
# 停止
docker compose stop bot

# 再起動
docker compose restart bot

# 停止してコンテナ削除
docker compose rm -sf bot
```

---

## トラブルシューティング

**`/add` コマンドが表示されない**
スラッシュコマンドの反映に時間がかかることがあります。数分待つか、Discordを再起動してください。

**「テンプレートの取得に失敗しました」と表示される**
- `docker compose logs bot` でエラーを確認する
- `CASHFLOW_USERNAME` / `CASHFLOW_PASSWORD` が正しいか確認する
- cashflow-app (`app` サービス) が起動しているか確認する: `docker compose ps`

**「権限がありません」と表示される**
`DISCORD_ALLOWED_USER_ID` に設定されているUser IDと、コマンドを実行したアカウントのIDが一致していません。`.env` を確認してください。
