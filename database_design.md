# 家計簿アプリ データベース設計書

## 1. 設計方針

### 1.1 基本方針

- バックエンド（PostgreSQL）を正とし、Android側（Room / SQLite）はそのレプリカとして同等のスキーマを持つ
- 全テーブルに同期管理用フィールド（id, version, updated_at, created_at）を付与
- 論理削除を採用し、同期時の削除競合に対応する（deleted_at フィールド）
- UUIDはクライアント側で生成し、INSERT時の競合を回避する
- 通貨フィールドは初期リリースでは日本円固定だが、スキーマレベルで対応しておく

### 1.2 共通フィールド

全テーブルに以下のフィールドを持たせる。

| フィールド | 型 | 説明 |
|---|---|---|
| id | UUID (PK) | クライアント側で生成する一意識別子 |
| version | INTEGER | 更新ごとにインクリメント（同期競合検知用） |
| created_at | TIMESTAMP WITH TIME ZONE | レコード作成日時（UTC） |
| updated_at | TIMESTAMP WITH TIME ZONE | 最終更新日時（UTC） |
| deleted_at | TIMESTAMP WITH TIME ZONE | 論理削除日時（NULLなら有効、非NULLなら削除済み） |

---

## 2. ER図

```
┌──────────────┐       ┌──────────────────┐       ┌──────────────┐
│   accounts   │       │   transactions   │       │  categories  │
│──────────────│       │──────────────────│       │──────────────│
│ id (PK)      │       │ id (PK)          │       │ id (PK)      │
│ name         │◄──────│ account_id (FK)  │       │ name         │
│ type         │       │ category_id (FK) │──────►│ type         │
│ initial_bal  │       │ type             │       │ icon         │
│ currency     │       │ amount           │       │ color        │
│ sort_order   │       │ currency         │       │ sort_order   │
│ deleted_at   │       │ date             │       │ is_default   │
└──────────────┘       │ memo             │       └──────────────┘
                       │ is_auto          │
                       │ recurring_id(FK) │       ┌──────────────┐
                       └──────────────────┘       │     tags     │
                              │                   │──────────────│
                              │                   │ id (PK)      │
                       ┌──────┴───────┐           │ name         │
                       │              │           │ color        │
                ┌──────┴──────┐ ┌─────┴────────┐  └──────┬───────┘
                │ transaction │ │  transaction  │         │
                │  _tags      │ │   _history    │  ┌─────┴────────┐
                │─────────────│ │───────────────│  │ transaction  │
                │ tx_id (FK)  │ │ id (PK)       │  │  _tags       │
                │ tag_id (FK) │ │ tx_id (FK)    │  │──────────────│
                └─────────────┘ │ user_id (FK)  │  │ tx_id (FK)   │
                                │changed_fields │  │ tag_id (FK)  │
                                │ changed_at    │  └──────────────┘
                                │version_before │
                                │ version_after │
                                └───────────────┘

┌──────────────────┐       ┌──────────────────┐
│    transfers     │       │recurring_trans.  │
│──────────────────│       │──────────────────│
│ id (PK)          │       │ id (PK)          │
│ from_account_id  │       │ amount           │
│ to_account_id    │       │ currency         │
│ amount           │       │ category_id (FK) │
│ currency         │       │ account_id (FK)  │
│ date             │       │ type             │
│ memo             │       │ frequency        │
└──────────────────┘       │ interval         │
                           │ day_of_month     │
┌──────────────────┐       │ day_of_week      │
│    budgets       │       │ month_of_year    │
│──────────────────│       │ start_date       │
│ id (PK)          │       │ end_date         │
│ category_id (FK) │       │ next_exec_date   │
│ year_month       │       │ memo             │
│ amount           │       │ is_active        │
│ currency         │       └──────────────────┘
└──────────────────┘
                           ┌──────────────────┐
┌──────────────────┐       │   templates      │
│ notification     │       │──────────────────│
│ _settings        │       │ id (PK)          │
│──────────────────│       │ name             │
│ id (PK)          │       │ type             │
│ type             │       │ amount           │
│ is_enabled       │       │ currency         │
│ frequency        │       │ category_id (FK) │
│ day_of_week      │       │ account_id (FK)  │
│ time_of_day      │       │ memo             │
│threshold_percent │       │ use_count        │
└──────────────────┘       │ last_used_at     │
                           └──────────────────┘

┌──────────────────┐
│ input_patterns   │
│──────────────────│
│ id (PK)          │
│ keyword          │
│ category_id (FK) │
│ account_id (FK)  │
│ hit_count        │
│ last_used_at     │
└──────────────────┘
```

---

## 3. テーブル定義

### 3.1 accounts（アカウント / ウォレット）

支払い手段を管理する。

| カラム | 型 | NULL | デフォルト | 説明 |
|---|---|---|---|---|
| id | UUID | NO | — | PK |
| name | VARCHAR(100) | NO | — | アカウント名（例：現金、三井住友銀行、楽天カード） |
| type | VARCHAR(20) | NO | — | 種別：'cash' / 'bank' / 'credit_card' / 'e_money' / 'other' |
| initial_balance | BIGINT | NO | 0 | 初期残高（円単位、整数管理） |
| currency | VARCHAR(3) | NO | 'JPY' | 通貨コード（ISO 4217） |
| sort_order | INTEGER | NO | 0 | 表示順 |
| version | INTEGER | NO | 1 | 同期バージョン |
| created_at | TIMESTAMPTZ | NO | NOW() | 作成日時 |
| updated_at | TIMESTAMPTZ | NO | NOW() | 更新日時 |
| deleted_at | TIMESTAMPTZ | YES | NULL | 論理削除日時 |

### 3.2 categories（カテゴリ）

収支のカテゴリを管理する。

| カラム | 型 | NULL | デフォルト | 説明 |
|---|---|---|---|---|
| id | UUID | NO | — | PK |
| name | VARCHAR(50) | NO | — | カテゴリ名（例：食費、交通費） |
| type | VARCHAR(10) | NO | — | 'income' / 'expense' |
| icon | VARCHAR(50) | YES | NULL | アイコン識別子（Material Iconの名前など） |
| color | VARCHAR(7) | YES | NULL | カラーコード（例：#FF5722） |
| sort_order | INTEGER | NO | 0 | 表示順 |
| is_default | BOOLEAN | NO | false | デフォルトカテゴリ（削除不可） |
| version | INTEGER | NO | 1 | 同期バージョン |
| created_at | TIMESTAMPTZ | NO | NOW() | 作成日時 |
| updated_at | TIMESTAMPTZ | NO | NOW() | 更新日時 |
| deleted_at | TIMESTAMPTZ | YES | NULL | 論理削除日時 |

**ユニーク制約**: (name, type, deleted_at) — 削除済みでなければ同一type内で名前は一意

### 3.3 tags（タグ）

横断的な分類用タグを管理する。

| カラム | 型 | NULL | デフォルト | 説明 |
|---|---|---|---|---|
| id | UUID | NO | — | PK |
| name | VARCHAR(50) | NO | — | タグ名（例：旅行、医療費） |
| color | VARCHAR(7) | YES | NULL | カラーコード |
| version | INTEGER | NO | 1 | 同期バージョン |
| created_at | TIMESTAMPTZ | NO | NOW() | 作成日時 |
| updated_at | TIMESTAMPTZ | NO | NOW() | 更新日時 |
| deleted_at | TIMESTAMPTZ | YES | NULL | 論理削除日時 |

**ユニーク制約**: (name, deleted_at) — 削除済みでなければ名前は一意

### 3.4 transactions（取引）

収支の各レコードを管理する。中心テーブル。

| カラム | 型 | NULL | デフォルト | 説明 |
|---|---|---|---|---|
| id | UUID | NO | — | PK |
| type | VARCHAR(10) | NO | — | 'income' / 'expense' |
| amount | BIGINT | NO | — | 金額（正の整数、円単位） |
| currency | VARCHAR(3) | NO | 'JPY' | 通貨コード |
| date | DATE | NO | — | 取引日 |
| memo | TEXT | YES | NULL | メモ・摘要 |
| category_id | UUID | NO | — | FK → categories.id |
| account_id | UUID | NO | — | FK → accounts.id |
| is_auto_generated | BOOLEAN | NO | false | 定期支出から自動生成されたか |
| recurring_transaction_id | UUID | YES | NULL | FK → recurring_transactions.id（自動生成元） |
| version | INTEGER | NO | 1 | 同期バージョン |
| created_at | TIMESTAMPTZ | NO | NOW() | 作成日時 |
| updated_at | TIMESTAMPTZ | NO | NOW() | 更新日時 |
| deleted_at | TIMESTAMPTZ | YES | NULL | 論理削除日時 |

**インデックス**:
- (date) — 日付による検索・ソート
- (category_id, date) — カテゴリ別集計
- (account_id, date) — アカウント別集計
- (deleted_at) — 論理削除フィルタ
- (memo) — GINインデックス（全文検索用、PostgreSQLのみ）

### 3.5 transaction_tags（取引 ↔ タグ 中間テーブル）

取引とタグの多対多リレーション。

| カラム | 型 | NULL | デフォルト | 説明 |
|---|---|---|---|---|
| transaction_id | UUID | NO | — | FK → transactions.id |
| tag_id | UUID | NO | — | FK → tags.id |

**PK**: (transaction_id, tag_id) の複合主キー

### 3.6 transaction_history（取引の編集履歴）

取引レコードの変更履歴を保持する（直近5回分）。

| カラム | 型 | NULL | デフォルト | 説明 |
|---|---|---|---|---|
| id | UUID | NO | — | PK |
| transaction_id | UUID | NO | — | FK → transactions.id |
| user_id | UUID | NO | — | FK → users.id（変更実行ユーザー、監査用） |
| changed_fields | JSONB | NO | — | 変更内容（{"field": {"old": v1, "new": v2}} 形式） |
| changed_at | TIMESTAMPTZ | NO | NOW() | 変更日時 |
| version_before | INTEGER | NO | — | 変更前バージョン |
| version_after | INTEGER | NO | — | 変更後バージョン |
| created_at | TIMESTAMPTZ | NO | NOW() | 作成日時 |
| updated_at | TIMESTAMPTZ | NO | NOW() | 更新日時 |

**インデックス**: (transaction_id, changed_at DESC)

**保持ポリシー**: 1取引あたり最大5世代まで保持。取引更新時に履歴件数を確認し、5件を超過する場合は `changed_at` が最も古いレコードを物理削除する。

**注**: `transaction_history` は物理削除のみ管理（`deleted_at` なし）。`user_id` はシングルユーザー版では常に同一値だが、将来のマルチユーザー対応に備えた監査フィールドとして保持する。

### 3.7 transfers（口座間振替）

アカウント間の資金移動を記録する。

| カラム | 型 | NULL | デフォルト | 説明 |
|---|---|---|---|---|
| id | UUID | NO | — | PK |
| from_account_id | UUID | NO | — | FK → accounts.id（出金元） |
| to_account_id | UUID | NO | — | FK → accounts.id（入金先） |
| amount | BIGINT | NO | — | 振替金額（正の整数） |
| currency | VARCHAR(3) | NO | 'JPY' | 通貨コード |
| date | DATE | NO | — | 振替日 |
| memo | TEXT | YES | NULL | メモ |
| version | INTEGER | NO | 1 | 同期バージョン |
| created_at | TIMESTAMPTZ | NO | NOW() | 作成日時 |
| updated_at | TIMESTAMPTZ | NO | NOW() | 更新日時 |
| deleted_at | TIMESTAMPTZ | YES | NULL | 論理削除日時 |

**制約**: from_account_id ≠ to_account_id

### 3.8 recurring_transactions（定期取引）

定期的に自動登録される取引のルールを定義する。

| カラム | 型 | NULL | デフォルト | 説明 |
|---|---|---|---|---|
| id | UUID | NO | — | PK |
| type | VARCHAR(10) | NO | — | 'income' / 'expense' |
| amount | BIGINT | NO | — | 金額 |
| currency | VARCHAR(3) | NO | 'JPY' | 通貨コード |
| category_id | UUID | NO | — | FK → categories.id |
| account_id | UUID | NO | — | FK → accounts.id |
| frequency | VARCHAR(10) | NO | — | 'daily' / 'weekly' / 'monthly' / 'yearly' |
| interval | INTEGER | NO | 1 | 間隔（例：2なら隔週、隔月） |
| day_of_month | INTEGER | YES | NULL | 月の日（1〜31、monthlyの場合） |
| day_of_week | INTEGER | YES | NULL | 曜日（0=月〜6=日、weeklyの場合） |
| month_of_year | INTEGER | YES | NULL | 月（1〜12、yearlyの場合） |
| start_date | DATE | NO | — | 開始日 |
| end_date | DATE | YES | NULL | 終了日（NULLなら無期限） |
| next_execution_date | DATE | NO | — | 次回実行予定日 |
| memo | TEXT | YES | NULL | メモ |
| is_active | BOOLEAN | NO | true | 有効/無効 |
| version | INTEGER | NO | 1 | 同期バージョン |
| created_at | TIMESTAMPTZ | NO | NOW() | 作成日時 |
| updated_at | TIMESTAMPTZ | NO | NOW() | 更新日時 |
| deleted_at | TIMESTAMPTZ | YES | NULL | 論理削除日時 |

**インデックス**: (is_active, next_execution_date) — バッチ処理で「今日実行すべきルール」を検索

### 3.9 recurring_transaction_tags（定期取引 ↔ タグ 中間テーブル）

定期取引にタグを付与するための中間テーブル。

| カラム | 型 | NULL | デフォルト | 説明 |
|---|---|---|---|---|
| recurring_transaction_id | UUID | NO | — | FK → recurring_transactions.id |
| tag_id | UUID | NO | — | FK → tags.id |

**PK**: (recurring_transaction_id, tag_id) の複合主キー

### 3.10 budgets（予算）

カテゴリ別の月間予算を管理する。

| カラム | 型 | NULL | デフォルト | 説明 |
|---|---|---|---|---|
| id | UUID | NO | — | PK |
| category_id | UUID | NO | — | FK → categories.id |
| year_month | VARCHAR(7) | NO | — | 対象年月（例：'2026-03'） |
| amount | BIGINT | NO | — | 予算上限額 |
| currency | VARCHAR(3) | NO | 'JPY' | 通貨コード |
| version | INTEGER | NO | 1 | 同期バージョン |
| created_at | TIMESTAMPTZ | NO | NOW() | 作成日時 |
| updated_at | TIMESTAMPTZ | NO | NOW() | 更新日時 |
| deleted_at | TIMESTAMPTZ | YES | NULL | 論理削除日時 |

**ユニーク制約**: (category_id, year_month, deleted_at)

### 3.11 templates（入力テンプレート）

よく使う入力パターンをテンプレートとして保存する。

| カラム | 型 | NULL | デフォルト | 説明 |
|---|---|---|---|---|
| id | UUID | NO | — | PK |
| name | VARCHAR(100) | NO | — | テンプレート名（例：「コンビニ昼食」） |
| type | VARCHAR(10) | NO | 'expense' | 'income' / 'expense' |
| amount | BIGINT | YES | NULL | 金額（NULLなら入力時に指定） |
| currency | VARCHAR(3) | NO | 'JPY' | 通貨コード |
| category_id | UUID | YES | NULL | FK → categories.id |
| account_id | UUID | YES | NULL | FK → accounts.id |
| memo | TEXT | YES | NULL | デフォルトメモ |
| use_count | INTEGER | NO | 0 | 使用回数（頻度順ソート用） |
| last_used_at | TIMESTAMPTZ | YES | NULL | 最終使用日時 |
| version | INTEGER | NO | 1 | 同期バージョン |
| created_at | TIMESTAMPTZ | NO | NOW() | 作成日時 |
| updated_at | TIMESTAMPTZ | NO | NOW() | 更新日時 |
| deleted_at | TIMESTAMPTZ | YES | NULL | 論理削除日時 |

### 3.12 template_tags（テンプレート ↔ タグ 中間テーブル）

テンプレートにデフォルトタグを付与するための中間テーブル。

| カラム | 型 | NULL | デフォルト | 説明 |
|---|---|---|---|---|
| template_id | UUID | NO | — | FK → templates.id |
| tag_id | UUID | NO | — | FK → tags.id |

**PK**: (template_id, tag_id) の複合主キー

### 3.13 input_patterns（入力補完パターン）

過去の入力パターンを学習し、自動推定に使用する。

| カラム | 型 | NULL | デフォルト | 説明 |
|---|---|---|---|---|
| id | UUID | NO | — | PK |
| keyword | VARCHAR(200) | NO | — | 入力キーワード（例：「ローソン」「スターバックス」） |
| category_id | UUID | YES | NULL | FK → categories.id（推定カテゴリ） |
| account_id | UUID | YES | NULL | FK → accounts.id（推定アカウント） |
| hit_count | INTEGER | NO | 1 | 使用回数（推定精度の重み付け用） |
| last_used_at | TIMESTAMPTZ | NO | NOW() | 最終使用日時 |
| version | INTEGER | NO | 1 | 同期バージョン |
| created_at | TIMESTAMPTZ | NO | NOW() | 作成日時 |
| updated_at | TIMESTAMPTZ | NO | NOW() | 更新日時 |
| deleted_at | TIMESTAMPTZ | YES | NULL | 論理削除日時 |

**ユニーク制約**: (keyword, deleted_at)

**インデックス**: (keyword) — 前方一致検索用

### 3.14 notification_settings（通知設定）

通知の種別ごとの設定を管理する。

| カラム | 型 | NULL | デフォルト | 説明 |
|---|---|---|---|---|
| id | UUID | NO | — | PK |
| type | VARCHAR(30) | NO | — | 通知種別：'input_remind' / 'budget_alert' |
| is_enabled | BOOLEAN | NO | true | 有効/無効 |
| frequency | VARCHAR(20) | YES | NULL | リマインド頻度：'daily' / 'weekly' / 'biweekly' / 'custom' |
| day_of_week | VARCHAR(20) | YES | NULL | 曜日指定（カンマ区切り、例：'1,3,5' = 月水金） |
| time_of_day | TIME | YES | NULL | 通知時刻（例：20:00） |
| threshold_percent | INTEGER | YES | NULL | 予算アラートの閾値（例：80 = 80%） |
| version | INTEGER | NO | 1 | 同期バージョン |
| created_at | TIMESTAMPTZ | NO | NOW() | 作成日時 |
| updated_at | TIMESTAMPTZ | NO | NOW() | 更新日時 |
| deleted_at | TIMESTAMPTZ | YES | NULL | 論理削除日時 |

---

### 3.15 users（ユーザー）

認証ユーザーを管理する。シングルユーザー前提だが、将来のマルチユーザー対応に備えて明示的に定義する。

| カラム | 型 | NULL | デフォルト | 説明 |
|---|---|---|---|---|
| id | UUID | NO | — | PK（サーバー側で生成） |
| username | VARCHAR(50) | NO | — | ユーザー名（一意） |
| password_hash | VARCHAR(255) | NO | — | bcrypt ハッシュ化パスワード（コストファクター12） |
| created_at | TIMESTAMPTZ | NO | NOW() | 作成日時 |
| updated_at | TIMESTAMPTZ | NO | NOW() | 更新日時 |

**ユニーク制約**: (username)

**注**: `user` テーブルは同期対象外。バックアップ・リストア対象からも除外する。

### 3.16 refresh_tokens（リフレッシュトークン）

JWT リフレッシュトークンを管理する。

| カラム | 型 | NULL | デフォルト | 説明 |
|---|---|---|---|---|
| id | UUID | NO | — | PK（サーバー側で生成） |
| user_id | UUID | NO | — | FK → users.id |
| token_hash | VARCHAR(64) | NO | — | SHA-256ハッシュ化トークン（平文トークンは保存しない） |
| expires_at | TIMESTAMPTZ | NO | — | 有効期限 |
| created_at | TIMESTAMPTZ | NO | NOW() | 作成日時 |
| revoked_at | TIMESTAMPTZ | YES | NULL | 失効日時（NULLなら有効） |

**インデックス**: (token_hash) — トークン検索用（ユニーク）

**注**: `refresh_tokens` は論理削除と異なる失効管理（`revoked_at`）を使用。`revoked_at` 設定後30日経過、または `expires_at` を過ぎたレコードを週次バッチで物理削除する。

---

## 4. 金額の管理方針

金額は全て **BIGINT（整数）** で管理し、日本円の場合は「円」単位の整数とする。浮動小数点（FLOAT / DOUBLE）は丸め誤差が発生するため、家計簿のような金融データには使用しない。

将来的に多通貨対応する場合は、通貨ごとの最小単位（例：USDなら「セント」）で整数管理し、表示時にフォーマットする。

---

## 5. Android側（Room）との対応

### 5.1 スキーマの対応方針

- PostgreSQLのテーブル定義と基本的に1対1で対応するRoomエンティティを作成する
- PostgreSQL固有の機能（GINインデックス等）はRoom側では省略し、通常のインデックスで代替する
- Room側には同期管理用の追加フィールドを持たせる

### 5.2 Room側の追加フィールド

| フィールド | 型 | 説明 |
|---|---|---|
| is_synced | Boolean | サーバーとの同期済みフラグ |
| sync_status | String | "clean" / "pending" / "conflict" |
| local_updated_at | Long | ローカルでの更新タイムスタンプ（競合検知用） |

---

## 6. デフォルトデータ

### 6.1 デフォルトカテゴリ

初回セットアップ時に以下のカテゴリを自動作成する。

**支出カテゴリ**:
食費、日用品、交通費、娯楽・趣味、衣服・美容、医療・健康、教育・教養、住居費、光熱費・通信費、保険、税金・社会保険、交際費、その他支出

**収入カテゴリ**:
給与、賞与、副業・フリーランス、投資収益、その他収入

### 6.2 デフォルト通知設定

| 種別 | 初期値 |
|---|---|
| 入力リマインド | 有効、週1回（日曜）、20:00 |
| 予算アラート | 有効、閾値80% |

---

## 7. 改訂履歴

| 日付 | バージョン | 内容 |
|---|---|---|
| 2026-02-27 | 1.0 | 初版作成 |
| 2026-02-27 | 1.1 | レビューによる包括修正：テーブル名を要件定義書に統一（recurring_rules→recurring_transactions、recurring_rule_tags→recurring_transaction_tags、transaction_histories→transaction_history）、accounts テーブルから is_archived を削除（deleted_at に統一）、categories ユニーク制約追加（name, type, deleted_at）、transaction_history スキーマを要件定義書に合わせて変更（field_name/old_value/new_value → user_id/changed_fields(JSONB)/version_before/version_after）、next_run_date → next_execution_date に変更、recurring_transactions.type のデフォルト値 'expense' を削除、transfers ER図の FK 啇名を from_account_id / to_account_id に統一、ER図を全体修正、users / refresh_tokens テーブル定義を追加（3.15・3.16） |
