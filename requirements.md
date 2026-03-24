# 家計簿アプリ 要件定義書

## 1. プロジェクト概要

### 1.1 目的

従来のExcel管理による家計簿の課題（データ共有の困難さ、使い勝手の悪さ）を解決するため、マルチプラットフォーム対応の家計簿アプリケーションを自作する。

### 1.2 対象プラットフォーム

| プラットフォーム | 種別 | 備考 |
|---|---|---|
| Android | ネイティブアプリ | ウィジェット機能あり、オフライン対応 |
| Web | ブラウザベースGUI | PC・タブレットからのアクセスを想定 |
| バックエンド | サーバーサイドAPI | データの永続化・同期を担当 |

### 1.3 基本方針

- Androidアプリ・Web GUIの双方から同一データを閲覧・編集できる
- バックエンドサーバーにデータを一元管理する
- Androidアプリはローカルにもデータを保持し、オフライン時も利用可能とする
- シングルユーザー利用を前提とする（家族共有機能は対象外）

---

## 2. 機能要件

### 2.1 基本機能（収支管理）

#### 2.1.1 収支の記録

- 収入・支出の手動入力（日付、金額、カテゴリ、メモ）
- 入力時に複数アカウント（支払い手段）を選択可能
- タグの付与（1レコードに複数タグ可）
- 通貨フィールドをデータ構造に含める（初期リリースでは日本円固定、将来の多通貨対応に備える）

#### 2.1.2 入力補完・学習機能

- 過去の入力パターンに基づくカテゴリ・アカウントの自動推定（例：「ローソン」入力時に「食費」「現金」を推定）
- メモ欄の入力候補表示（過去に使用した店名・摘要の履歴から補完）

#### 2.1.3 入力テンプレート / よく使う項目

- テンプレートの作成・編集・削除（金額、カテゴリ、アカウント、タグ、メモを事前設定）
- テンプレート一覧からの選択入力
- ウィジェットからテンプレートを選択し、2〜3タップで入力完了できるフロー
- **使用頻度順での並び替え**：
  - 主キー：`use_count` DESC（使用回数が多い順）
  - 副キー：`last_used_at` DESC（最近使用時刻が新しい順）。`last_used_at` が NULL の場合は末尾に移行
  - テンプレート使用時（テンプレート選択→取引作成で登録完了時）、`use_count += 1` と `last_used_at = 現在時刻` を更新
  - この更新はクライアント側で即座に実行（同期フラグを付与して、次回サーバー同期時に伝播）

#### 2.1.4 カテゴリ管理

- デフォルトカテゴリの提供（食費、交通費、娯楽費、光熱費など）
- ユーザーによるカテゴリの追加・編集・削除
- カテゴリにはアイコンと表示色を設定可能
- **カテゴリ削除時の処理仕様**：
  - デフォルトカテゴリは削除不可（API 側で 422 エラーを返却）
  - ユーザー定義カテゴリの削除時：既存の取引に紐づくカテゴリを削除する場合、該当取引は同じ type の予備カテゴリ（支出なら「その他支出」、収入なら「その他収入」）に自動で振り替える。該当取引数を削除前に告知

#### 2.1.5 一覧・検索

- 日別・月別・年別の収支一覧表示
- カテゴリ、タグ、アカウント、日付範囲によるフィルタリング
- キーワード検索（メモ欄の全文検索）
- ページネーション：1ページあたり50件、無限スクロール方式（Web GUI）/ ページング方式（Android）
- ソート：日付降順（デフォルト）、金額順

### 2.2 定期支出の自動登録

- 繰り返しルールの設定（毎月○日、毎週○曜日、毎年○月○日など）
- 金額・カテゴリ・アカウント・タグの事前設定
- 自動登録された取引は手動で編集・削除可能
- 定期支出の一覧管理（有効/無効の切り替え）
- 自動登録のタイミング：サーバー側で日次バッチ処理（毎日0:00 JST）により生成
- 月末日の処理ルール：`day_of_month`が該当月の最終日を超える場合（例：31日指定で2月の場合）、その月の最終日に実行する
- バッチ処理の障害対応：失敗時は最大3回リトライ（5分間隔）。全リトライ失敗時はエラーログに記録し、次回バッチ実行時に未処理分を再実行する

### 2.3 複数アカウント / ウォレット管理

- アカウントの作成・編集・削除（例：現金、銀行口座A、クレジットカードBなど）
- **アカウントごとの残高計算**：
  - 計算式：`残高 = 初期残高 + Σ(当該アカウントの収入) - Σ(当該アカウントの支出) + Σ(入金振替額) - Σ(出金振替額)`
  - つまり `transfers` テーブル の `from_account` は出金（-）、`to_account` は入金（+）として残高に反映
  - ただし削除済み（`deleted_at != NULL`）のレコードは除外
- アカウント別の収支一覧
- アカウントの並び順をユーザーが設定可能
- **アカウント削除時の処理**：論理削除。削除後も過去の取引データは保持。削除済みアカウント（`deleted_at != NULL`）は新規取引での選択肢から除外するが、既存取引の参照先アカウントとしては表示する（残高計算にも含める）
- **クレジットカードの運用フロー**（使用時記録 + 引き落とし時振替モデル）：
  - クレジットカードは `type = "credit_card"` のアカウントとして管理し、初期残高は通常 0 で設定する
  - **カード使用時**：`transactions` テーブルに支出（`type = "expense"`）として記録する。`account_id` にはクレジットカードのアカウントIDを指定する。これによりカード口座の残高がマイナス（＝未払い債務額）になる
  - **引き落とし日**：`transfers` テーブルに振替として記録する（`from_account_id = 銀行口座`, `to_account_id = クレジットカード口座`）。これにより銀行口座の残高が減り、カード口座のマイナス残高（債務）が解消される
  - **残高の解釈**：カード口座の残高がマイナスの場合は未払い額を、ゼロの場合は未払いなしを意味する
  - この運用により「カードで今月いくら使ったか」と「銀行にいくら残っているか」の両方をリアルタイムで正確に把握できる

### 2.4 タグ機能

- タグの作成・編集・削除
- 1つの取引に複数タグを付与可能
- タグによるフィルタリング・集計
- 用途例：「旅行」「医療費」「冠婚葬祭」など横断的な分類
- **タグ削除時の処理仕様**：
  - タグは論理削除（`deleted_at` を設定）
  - 削除されたタグに紐づく `transaction_tags`, `template_tags`, `recurring_transaction_tags` の中間テーブルレコードは物理削除する
  - 削除前に該当タグが付与されている取引件数を確認ダイアログで表示し、ユーザー確認を得る

### 2.5 分析・可視化

#### 2.5.1 ダッシュボード画面

- アプリ起動時のホーム画面として表示
- 表示項目：
  - 今月の収入・支出合計、収支バランス
  - 予算消化率（全体およびカテゴリ別TOP3）
  - 前月比の増減サマリー
  - 直近の取引履歴（5〜10件）

#### 2.5.2 カテゴリ別グラフ

- 月次の支出カテゴリ内訳（円グラフ）
- 月次の収入カテゴリ内訳（円グラフ）
- カテゴリ別支出推移（折れ線グラフ / 棒グラフ、月単位・年単位）
- カテゴリ別収入推移（折れ線グラフ / 棒グラフ、月単位・年単位）

#### 2.5.3 予算設定とアラート

- カテゴリごとに月間予算上限を設定
- 予算消化率の表示（プログレスバーなど）
- 閾値超過時の通知（2段階）：
  - **第1段階**：予算消化率が `notification_settings.threshold_percent`（デフォルト80%）に到達時に警告通知
  - **第2段階**：予算消化率が100%を超過時に超過通知（システム固定、設定不要）
  - **チェックタイミング**：取引登録・更新時に該当カテゴリの予算消化率を再計算し、閾値超過時に通知を発行。同一月内で同一段階の通知は1回のみ（重複通知防止フラグをローカル管理）
- Androidアプリではプッシュ通知に対応

#### 2.5.4 比較分析

- 前月比の表示（カテゴリ別・合計）
- 前年同月比の表示（カテゴリ別・合計）
- 増減額・増減率の表示

#### 2.5.5 年間サマリー・収支バランス推移

- 月ごとの収入・支出・収支バランスの年間推移グラフ
- 年間の総収入・総支出・貯蓄額のサマリー表示
- 年単位での比較（前年 vs 今年）

### 2.6 データインポート / エクスポート

#### 2.6.1 Excelインポート

- 既存のExcel形式家計簿データの取り込み機能
- 対応形式：.xlsx（.xlsは非対応）
- ファイルサイズ上限：10MB
- 最大行数：10,000行（ヘッダー行除く）
- カラムマッピング機能（Excelの列と家計簿項目の対応付け）
  - マッピング対象フィールド：日付（必須）、金額（必須）、種別（income/expense、必須）、カテゴリ名、アカウント名、メモ、タグ（カンマ区切り）
  - 対応日付形式：YYYY/MM/DD、YYYY-MM-DD、Excel日付シリアル値
  - 金額フォーマット：整数またはカンマ区切り整数（例：1,000）。負の値は支出として扱う
  - カテゴリ名・アカウント名が既存データに一致しない場合は新規作成するか、スキップするかをユーザーが選択
- インポートプレビュー（取り込み前の確認画面、先頭20件を表示）
- エラー行の処理：エラー行をスキップし、成功行のみインポート。エラー一覧をレポートとして表示
- エラー判定基準：必須フィールド未入力、日付形式不正、金額が数値でない、金額が0
- 金額の符号処理：負の値は絶対値を金額とし、種別を "expense" に自動設定する（種別フィールドの値を上書き）

#### 2.6.2 エクスポート

- CSV形式でのエクスポート（期間指定可、文字コードUTF-8 BOM付き）
  - 出力カラム：日付、種別（income/expense）、金額、カテゴリ名、アカウント名、メモ、タグ（カンマ区切り）、作成日時、更新日時
  - ヘッダー行あり（日本語）
  - ソート：日付昇順
  - タグ名のエスケープ処理：タグ名にカンマが含まれる場合、タグ名をダブルクォートで囲む（RFC 4180準拠）
- PDF形式でのレポート出力（月次・年次サマリー、サーバー側で生成。Androidオフライン時はローカルで簡易版を生成）
  - 月次レポート：収支サマリー、カテゴリ別支出内訳（表）、カテゴリ別支出比率（円グラフ）、取引一覧
  - 年次レポート：月別収支推移（表＋グラフ）、カテゴリ別年間集計、年間サマリー

#### 2.6.3 バックアップ・リストア

- ユーザーが手動で全データをJSON形式のバックアップファイルとしてエクスポート可能
- バックアップファイルの対象テーブル：transactions, categories, accounts, tags, transaction_tags, templates, template_tags, recurring_transactions, recurring_transaction_tags, budgets, transfers, notification_settings, input_patterns, transaction_history （user テーブルは除外）
- バックアップファイル構造：
  ```json
  {
    "version": "1.0",
    "app_version": "1.0.0",
    "created_at": "2026-01-01T00:00:00Z",
    "device_id": "android-uuid or web-session-id",
    "schema_version": 1,
    "data": {
      "accounts": [...],
      "categories": [...],
      "transactions": [...],
      ...
    }
  }
  ```
- 大量データ時はストリーミング（JSONLines形式）でダウンロード。レスポンスヘッダーに `Content-Disposition: attachment` を付与
- バックアップファイルからのデータリストア（復元）機能
- **リストア時の確認画面**（既存データの上書き / マージの選択）
  - **上書き**：既存データを全削除してからリストア。既存バージョンよりも古いバックアップをリストアする場合、**「古いバージョンへの復元となります。データ喪失の可能性があります」という警告を表示し、ユーザー確認必須**。Undo機能との併用は不可（上書きの場合はUndoスタックもクリア）
  - **マージ**：（推奨）IDが一致するレコードは `updated_at` が新しい方を採用。同じ `updated_at` の場合は `version` が大きい方を採用。新規レコードは追加。これにより、リストア後のサーバー側との同期時に古いローカル変更が上書きされるリスクを軽減
- バックアップファイルにはバージョン情報・スキーマバージョンを含め、互換性を管理
- **バックアップファイルのセキュリティ**：個人財務データを含む機密ファイルである。ダウンロード完了時に「このファイルには財務情報が含まれます。安全な場所に保管し、第三者と共有しないでください」という警告を表示する。Android では `FileProvider` 経由で外部アプリへの共有を行い、直接外部ストレージへの書き出しは行わない。将来的な暗号化バックアップ（AES-256）の対応を検討すること
- **リストア時のバージョン互換性チェック**：`version` フィールドがサポート範囲外（現在は 1.0 のみ）の場合はエラーを返す。`schema_version` との互換性も確認し、非互換の場合はマイグレーション情報を表示
- **リストア後の認証状態**：リストア対象に `user` テーブルや `refresh_tokens` テーブルは含まれないため、リストア後も現在のログインセッションは維持される。ただし「上書き」モードでリストアした場合、クライアント側のローカルデータがリセットされるため、次回同期時にサーバーから最新データを再取得する（Android は全テーブル再同期を実行）

### 2.7 Androidウィジェット

- ホーム画面からの簡易入力ウィジェット
- ウィジェットサイズ：4x2（推奨）、2x1（最小）
- ウィジェットからワンタップで収支登録画面を起動
- テンプレート一覧への直接アクセス（テンプレート選択 → 確認 → 登録の短縮フロー）
- **ウィジェット・メインアプリ間のデータ同期**：
  - ウィジェットはウィジェットプロセス（メインアプリ外）で独立実行
  - ウィジェット表示時: Room から直接読み込み（ローカルDB）。古いデータが表示される可能性あり
  - テンプレート選択→入力→登録の流れ: メインアプリプロセスで処理。登録後、SharedPreferences での軽量イベント通知またはクエリリロード
  - ウィジェット更新タイミング: アプリフォアグラウンド復帰時、WorkManager による定期更新（1時間ごと）
- ダークモード対応（システム設定に追従）

### 2.8 通知機能

#### 2.8.1 入力リマインド通知

- 定期的な入力リマインド通知（例：週1回「今週の家計簿を記録しましょう」）
- リマインドの頻度をユーザーが設定可能（毎日 / 週1回 / 週2回 / カスタム曜日指定）
- リマインドの時刻をユーザーが設定可能
- 通知のオン/オフ切り替え
- Androidプッシュ通知で配信

#### 2.8.2 予算アラート通知

- 予算消化率が閾値に達した際のプッシュ通知（2.5.3と連動）

#### 2.8.3 通知のプラットフォーム対応

- Android：プッシュ通知（FCM は使用せず、WorkManager によるローカル通知（デバイス内のみ））
- Web GUI：
  - **推奨**: ポーリングによりダッシュボード定期更新（30 秒間隔）。予算超過時にバッジ・トースト表示
  - **将来**：WebSocket で リアルタイム同期実装を検討
  - 現在のバージョンではリアルタイム通知は対象外。ユーザーが手動でページをリロードして確認

### 2.9 UX機能

#### 2.9.1 ダークモード

- Androidアプリ：システム設定に追従するダークモード対応
- Web GUI：ライト / ダーク / システム追従の3モード切替

#### 2.9.2 取り消し（Undo）機能

- 取引の削除直後に「元に戻す」スナックバーを表示（一覧画面・詳細画面の両方が対象）
- **Undo 可能時間**：5秒以内。ただ、実装上の注意：
  - **Android**：タイマーはローカルメモリで管理。アプリが背景化→手動終了された場合、Undo は失われる。フォアグラウンド復帰時のみ確認。システムメモリ圧迫時も同様
  - **Web GUI**：ブラウザタブを閉じた場合 Undo は失われる。SPA なのでタブ内なら 5秒タイマーは継続
- Undo対象は取引（transactions）と振替（transfers）の削除操作のみ。カテゴリ・アカウント等のマスタ削除はUndoの対象外（削除前に確認ダイアログを表示）
- **実装方式**：論理削除（`deleted_at` 設定）後、ローカルメモリ/ブラウザメモリでタイマーを管理し5秒経過まで画面上から非表示。Undo実行時は `deleted_at` を NULL に戻す。ただしタイマー経過後（5秒以降）も `deleted_at` は設定されたまま。サーバーへの同期時に deleted レコードとして伝播

#### 2.9.3 取引の編集履歴

- 各取引レコードの変更履歴を保持（直近5回分）
- 変更日時・変更内容（変更前 → 変更後）の表示
- 過去の状態への巻き戻し機能

---

## 3. データモデル

### 3.1 ER図（概要）

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
│ ...sync      │       │ memo             │       │ deleted_at   │
└──────┬───────┘       │ is_auto          │       │ ...sync      │
       │               │ recurring_id(FK) │       └──────────────┘
       │               │ deleted_at       │
       │               │ ...sync          │       ┌──────────────┐
       │               └────────┬─────────┘       │     tags     │
       │                        │                 │──────────────│
       │               ┌───────┴────────┐         │ id (PK)      │
       │               │transaction_tags│         │ name         │
       │               │───────────────│         │ color        │
       │               │ tx_id (FK)     │────────►│ deleted_at   │
       │               │ tag_id (FK)    │         │ ...sync      │
       │               └───────────────┘         └──────────────┘
       │
       │  ┌──────────────────┐     ┌──────────────────┐
       ├─►│    transfers     │     │recurring_trans.  │
       │  │──────────────────│     │──────────────────│
       └─►│from_account_id(FK│     │ id (PK)          │
          │ to_account_id(FK)│     │ type              │
          │ amount           │     │ amount            │
          │ currency         │     │ category_id (FK)  │
          │ date             │     │ account_id (FK)   │
          │ memo             │     │ frequency         │
          │ deleted_at       │     │next_execution_date│
          │ ...sync          │     │ is_active         │
          └──────────────────┘     │ deleted_at        │
                                   │ ...sync           │
┌──────────────────┐               └──────────────────┘
│    budgets       │
│──────────────────│     ┌──────────────────┐
│ id (PK)          │     │   templates      │
│ category_id (FK) │     │──────────────────│
│ year_month       │     │ id (PK)          │
│ amount           │     │ name             │
│ currency         │     │ type             │
│ deleted_at       │     │ amount           │
│ ...sync          │     │ category_id (FK) │
└──────────────────┘     │ account_id (FK)  │
                         │ use_count        │
┌──────────────────┐     │ last_used_at     │
│ notification     │     │ deleted_at       │
│ _settings        │     │ ...sync          │
│──────────────────│     └──────────────────┘
│ id (PK)          │
│ type             │     ┌──────────────────┐
│ is_enabled       │     │ input_patterns   │
│ frequency        │     │──────────────────│
│ threshold_pct    │     │ id (PK)          │
│ ...sync          │     │ keyword          │
└──────────────────┘     │ category_id (FK) │
                         │ account_id (FK)  │
┌──────────────────┐     │ hit_count        │
│ transaction      │     │ ...sync          │
│ _history         │     └──────────────────┘
│──────────────────│
│ id (PK)          │     ┌──────────────────┐
│ transaction_id   │     │  user            │
│ user_id (FK)     │     │──────────────────│
│ changed_fields   │     │ id (PK)          │
│ changed_at       │     │ username         │
│ version_before   │     │ password_hash    │
│ version_after    │     └────────┬─────────┘
└──────────────────┘              │
                         ┌────────┴─────────┐
                         │ refresh_tokens   │
                         │──────────────────│
                         │ id (PK)          │
                         │ user_id (FK)     │
                         │ token_hash       │
                         │ expires_at       │
                         │ revoked_at       │
                         └──────────────────┘

※ ...sync = version, created_at, updated_at の共通同期管理フィールド
※ 中間テーブル（template_tags, recurring_transaction_tags）は省略
```

### 3.2 エンティティ定義

#### 3.2.0 user（ユーザー・監査）

シングルユーザーが前提ですが、将来のマルチユーザー拡張（家族共有）に備えて、ユーザーテーブルを明示的に定義：

| フィールド | 型 | 制約 | 説明 |
|---|---|---|---|
| id | UUID | PK | サーバー側で生成 |
| username | String | NOT NULL, UNIQUE, 最大50文字 | ユーザー名 |
| password_hash | String | NOT NULL | bcrypt ハッシュ化パスワード（コストファクター12） |
| created_at | Timestamp | NOT NULL | 作成日時（UTC） |
| updated_at | Timestamp | NOT NULL | 最終更新日時（UTC） |

**初期状態**：初回セットアップ（/api/v1/auth/setup）で唯一のユーザーを作成。バージョン v1 ではシングルユーザー固定

#### 3.2.1 transactions（取引）

収入・支出の各レコードを管理する中心テーブル。振替（アカウント間の資金移動）は `transfers` テーブルで別途管理する。

| フィールド | 型 | 制約 | 説明 |
|---|---|---|---|
| id | UUID | PK | クライアント側で生成 |
| type | Enum | NOT NULL | "income" / "expense" |
| amount | Long | NOT NULL, > 0 | 金額（正の整数、円単位で管理。符号はtypeで判定） |
| date | LocalDate | NOT NULL | 取引日 |
| category_id | UUID | FK, NOT NULL | カテゴリID |
| account_id | UUID | FK, NOT NULL | 支出元/収入先アカウントID |
| memo | String | NULL許可, 最大500文字 | メモ・摘要 |
| currency | String(3) | NOT NULL, default "JPY" | ISO 4217通貨コード |
| is_auto_generated | Boolean | NOT NULL, default false | 定期取引から自動生成されたか |
| recurring_transaction_id | UUID | FK, NULL許可 | 定期取引ID（自動生成元。手動入力時はNULL） |
| deleted_at | Timestamp | NULL許可, default NULL | 論理削除日時（NULLなら有効、非NULLなら削除済み） |
| version | Integer | NOT NULL, default 1 | 楽観的ロック用バージョン |
| created_at | Timestamp | NOT NULL | 作成日時（UTC） |
| updated_at | Timestamp | NOT NULL | 最終更新日時（UTC） |

**インデックス：**
- `(date)` — 日付による検索・ソート
- `(category_id, date)` — カテゴリ別集計
- `(account_id, date)` — アカウント別集計
- `(deleted_at)` — 論理削除フィルタ
- `(memo)` — GINインデックス（全文検索用、PostgreSQLのみ。Roomでは通常のインデックスで代替）

#### 3.2.2 categories（カテゴリ）

| フィールド | 型 | 制約 | 説明 |
|---|---|---|---|
| id | UUID | PK | クライアント側で生成 |
| name | String | NOT NULL, 最大50文字 | カテゴリ名 |
| icon | String | NULL許可, 最大50文字 | アイコン識別子（Material Iconの名前等） |
| color | String(7) | NULL許可 | 表示色（#RRGGBB形式） |
| type | Enum | NOT NULL | "income" / "expense"（収入用/支出用の区別） |
| sort_order | Integer | NOT NULL, default 0 | 表示順 |
| is_default | Boolean | NOT NULL, default false | デフォルトカテゴリフラグ（trueの場合は削除不可。API側でバリデーション） |
| deleted_at | Timestamp | NULL許可, default NULL | 論理削除日時 |
| version | Integer | NOT NULL, default 1 | 楽観的ロック用バージョン |
| created_at | Timestamp | NOT NULL | 作成日時（UTC） |
| updated_at | Timestamp | NOT NULL | 最終更新日時（UTC） |

**ユニーク制約：** (name, type, deleted_at) — 削除済みでなければ同一type内で名前は一意

#### 3.2.3 accounts（アカウント）

| フィールド | 型 | 制約 | 説明 |
|---|---|---|---|
| id | UUID | PK | クライアント側で生成 |
| name | String | NOT NULL, 最大50文字 | アカウント名 |
| type | Enum | NOT NULL | "cash" / "bank" / "credit_card" / "e_money" / "other" |
| initial_balance | Long | NOT NULL, default 0 | 初期残高（円単位、整数管理） |
| currency | String(3) | NOT NULL, default "JPY" | 通貨コード（ISO 4217） |
| sort_order | Integer | NOT NULL, default 0 | 表示順 |
| deleted_at | Timestamp | NULL許可, default NULL | 論理削除日時 |
| version | Integer | NOT NULL, default 1 | 楽観的ロック用バージョン |
| created_at | Timestamp | NOT NULL | 作成日時（UTC） |
| updated_at | Timestamp | NOT NULL | 最終更新日時（UTC） |

**ユニーク制約：** (name, deleted_at) — 削除済みでなければ名前は一意

#### 3.2.4 tags（タグ）

| フィールド | 型 | 制約 | 説明 |
|---|---|---|---|
| id | UUID | PK | クライアント側で生成 |
| name | String | NOT NULL, 最大30文字 | タグ名 |
| color | String(7) | NULL許可 | 表示色（#RRGGBB形式） |
| deleted_at | Timestamp | NULL許可, default NULL | 論理削除日時 |
| version | Integer | NOT NULL, default 1 | 楽観的ロック用バージョン |
| created_at | Timestamp | NOT NULL | 作成日時（UTC） |
| updated_at | Timestamp | NOT NULL | 最終更新日時（UTC） |

**ユニーク制約：** (name, deleted_at) — 削除済みでなければ名前は一意

#### 3.2.5 transaction_tags（取引-タグ中間テーブル）

| フィールド | 型 | 制約 | 説明 |
|---|---|---|---|
| transaction_id | UUID | FK, NOT NULL | 取引ID |
| tag_id | UUID | FK, NOT NULL | タグID |
| (複合PK) | | transaction_id + tag_id | |

#### 3.2.6 templates（入力テンプレート）

| フィールド | 型 | 制約 | 説明 |
|---|---|---|---|
| id | UUID | PK | クライアント側で生成 |
| name | String | NOT NULL, 最大50文字 | テンプレート名 |
| type | Enum | NOT NULL | "income" / "expense" |
| amount | Long | NULL許可 | 金額（未設定可。円単位の整数） |
| currency | String(3) | NOT NULL, default "JPY" | 通貨コード |
| category_id | UUID | FK, NULL許可 | カテゴリID |
| account_id | UUID | FK, NULL許可 | アカウントID |
| memo | String | NULL許可, 最大500文字 | メモ |
| use_count | Integer | NOT NULL, default 0 | 使用回数（並び替え用） |
| last_used_at | Timestamp | NULL許可 | 最終使用日時（使用頻度順ソートの二次キー） |
| deleted_at | Timestamp | NULL許可, default NULL | 論理削除日時 |
| version | Integer | NOT NULL, default 1 | 楽観的ロック用バージョン |
| created_at | Timestamp | NOT NULL | 作成日時（UTC） |
| updated_at | Timestamp | NOT NULL | 最終更新日時（UTC） |

#### 3.2.7 template_tags（テンプレート-タグ中間テーブル）

| フィールド | 型 | 制約 | 説明 |
|---|---|---|---|
| template_id | UUID | FK, NOT NULL | テンプレートID |
| tag_id | UUID | FK, NOT NULL | タグID |
| (複合PK) | | template_id + tag_id | |

#### 3.2.8 recurring_transactions（定期取引）

| フィールド | 型 | 制約 | 説明 |
|---|---|---|---|
| id | UUID | PK | クライアント側で生成 |
| type | Enum | NOT NULL | "income" / "expense" |
| amount | Long | NOT NULL, > 0 | 金額（円単位の整数） |
| currency | String(3) | NOT NULL, default "JPY" | 通貨コード |
| category_id | UUID | FK, NOT NULL | カテゴリID |
| account_id | UUID | FK, NOT NULL | アカウントID |
| memo | String | NULL許可, 最大500文字 | メモ |
| frequency | Enum | NOT NULL | "daily" / "weekly" / "monthly" / "yearly" |
| interval | Integer | NOT NULL, default 1 | 繰り返し間隔（例：2なら隔月） |
| day_of_week | Integer | NULL許可 | 曜日（0=月〜6=日、weekly時に使用） |
| day_of_month | Integer | NULL許可 | 日（1-31、monthly時に使用。該当月の最終日を超える場合は最終日に実行） |
| month_of_year | Integer | NULL許可 | 月（1-12、yearly時に使用） |
| start_date | LocalDate | NOT NULL | 開始日 |
| end_date | LocalDate | NULL許可 | 終了日（NULL=無期限） |
| next_execution_date | LocalDate | NOT NULL | 次回実行予定日 |
| is_active | Boolean | NOT NULL, default true | 有効/無効フラグ |
| deleted_at | Timestamp | NULL許可, default NULL | 論理削除日時 |
| version | Integer | NOT NULL, default 1 | 楽観的ロック用バージョン |
| created_at | Timestamp | NOT NULL | 作成日時（UTC） |
| updated_at | Timestamp | NOT NULL | 最終更新日時（UTC） |

**インデックス：** (is_active, next_execution_date) — バッチ処理で「今日実行すべきルール」を検索

#### 3.2.9 recurring_transaction_tags（定期取引-タグ中間テーブル）

| フィールド | 型 | 制約 | 説明 |
|---|---|---|---|
| recurring_transaction_id | UUID | FK, NOT NULL | 定期取引ID |
| tag_id | UUID | FK, NOT NULL | タグID |
| (複合PK) | | recurring_transaction_id + tag_id | |

#### 3.2.10 budgets（予算）

| フィールド | 型 | 制約 | 説明 |
|---|---|---|---|
| id | UUID | PK | クライアント側で生成 |
| category_id | UUID | FK, NOT NULL | カテゴリID |
| year_month | String(7) | NOT NULL | 対象年月（"YYYY-MM"形式、暦年基準） |
| amount | Long | NOT NULL, > 0 | 予算上限額（円単位の整数） |
| currency | String(3) | NOT NULL, default "JPY" | 通貨コード |
| deleted_at | Timestamp | NULL許可, default NULL | 論理削除日時 |
| version | Integer | NOT NULL, default 1 | 楽観的ロック用バージョン |
| created_at | Timestamp | NOT NULL | 作成日時（UTC） |
| updated_at | Timestamp | NOT NULL | 最終更新日時（UTC） |

**ユニーク制約：** (category_id, year_month, deleted_at)

#### 3.2.11 transaction_history（取引変更履歴）

| フィールド | 型 | 制約 | 説明 |
|---|---|---|---|
| id | UUID | PK | サーバー側で生成 |
| transaction_id | UUID | FK, NOT NULL | 対象取引ID |
| user_id | UUID | FK, NOT NULL | 変更実行ユーザーID（監査用） |
| changed_fields | JSON | NOT NULL | 変更内容（{"field": {"old": v1, "new": v2}}） |
| changed_at | Timestamp | NOT NULL | 変更日時（UTC） |
| version_before | Integer | NOT NULL | 変更前バージョン |
| version_after | Integer | NOT NULL | 変更後バージョン |
| created_at | Timestamp | NOT NULL | 作成日時（UTC） |
| updated_at | Timestamp | NOT NULL | 最終更新日時（UTC） |

**インデックス：** (transaction_id, changed_at DESC)

**保持ポリシー：** 1取引あたり最大5世代まで保持。取引更新時に履歴件数を確認し、5件を超過する場合は `changed_at` が最も古いレコードを物理削除する。

**注**：ユーザーが変更を実行する際、どのユーザーが変更したかを記録。シングルユーザー時代は user_id は常に同じ値だが、将来のマルチユーザー拡張に備える

#### 3.2.12 refresh_tokens（リフレッシュトークン）

| フィールド | 型 | 制約 | 説明 |
|---|---|---|---|
| id | UUID | PK | サーバー側で生成 |
| user_id | UUID | FK, NOT NULL | ユーザーID |
| token_hash | String | NOT NULL | SHA-256ハッシュ化トークン |
| expires_at | Timestamp | NOT NULL | 有効期限 |
| created_at | Timestamp | NOT NULL | 作成日時（UTC） |
| revoked_at | Timestamp | NULL許可 | 失効日時（NULL=有効） |

#### 3.2.13 transfers（口座間振替）

アカウント間の資金移動を記録する。取引（transactions）とは独立したテーブルで管理する。

| フィールド | 型 | 制約 | 説明 |
|---|---|---|---|
| id | UUID | PK | クライアント側で生成 |
| from_account_id | UUID | FK, NOT NULL | 出金元アカウントID |
| to_account_id | UUID | FK, NOT NULL | 入金先アカウントID |
| amount | Long | NOT NULL, > 0 | 振替金額（円単位の整数） |
| currency | String(3) | NOT NULL, default "JPY" | 通貨コード |
| date | LocalDate | NOT NULL | 振替日 |
| memo | String | NULL許可, 最大500文字 | メモ |
| deleted_at | Timestamp | NULL許可, default NULL | 論理削除日時 |
| version | Integer | NOT NULL, default 1 | 楽観的ロック用バージョン |
| created_at | Timestamp | NOT NULL | 作成日時（UTC） |
| updated_at | Timestamp | NOT NULL | 最終更新日時（UTC） |

**制約：** from_account_id ≠ to_account_id

#### 3.2.14 notification_settings（通知設定）

通知の種別ごとの設定を管理する。

| フィールド | 型 | 制約 | 説明 |
|---|---|---|---|
| id | UUID | PK | クライアント側で生成 |
| type | Enum | NOT NULL, UNIQUE | "input_remind" / "budget_alert" |
| is_enabled | Boolean | NOT NULL, default true | 有効/無効 |
| frequency | Enum | NULL許可 | リマインド頻度："daily" / "weekly" / "biweekly" / "custom"（input_remind時に使用） |
| day_of_week | String | NULL許可, 最大20文字 | 曜日指定（カンマ区切り、0始まり、例："0,2,4" = 月水金。custom時に使用。0=月、1=火、2=水、3=木、4=金、5=土、6=日） |
| time_of_day | String(5) | NULL許可 | 通知時刻（"HH:mm"形式、例："20:00"） |
| threshold_percent | Integer | NULL許可, 1-100 | 予算アラートの閾値（例：80 = 80%。budget_alert時に使用） |
| deleted_at | Timestamp | NULL許可, default NULL | 論理削除日時 |
| version | Integer | NOT NULL, default 1 | 楽観的ロック用バージョン |
| created_at | Timestamp | NOT NULL | 作成日時（UTC） |
| updated_at | Timestamp | NOT NULL | 最終更新日時（UTC） |

#### 3.2.15 input_patterns（入力補完パターン）

過去の入力パターンを学習し、カテゴリ・アカウントの自動推定に使用する。

| フィールド | 型 | 制約 | 説明 |
|---|---|---|---|
| id | UUID | PK | クライアント側で生成 |
| keyword | String | NOT NULL, 最大200文字 | 入力キーワード（例："ローソン"、"スターバックス"） |
| category_id | UUID | FK, NULL許可 | 推定カテゴリID |
| account_id | UUID | FK, NULL許可 | 推定アカウントID |
| hit_count | Integer | NOT NULL, default 1 | 使用回数（推定精度の重み付け用） |
| last_used_at | Timestamp | NOT NULL | 最終使用日時 |
| deleted_at | Timestamp | NULL許可, default NULL | 論理削除日時 |
| version | Integer | NOT NULL, default 1 | 楽観的ロック用バージョン |
| created_at | Timestamp | NOT NULL | 作成日時（UTC） |
| updated_at | Timestamp | NOT NULL | 最終更新日時（UTC） |

**ユニーク制約：** (keyword, deleted_at) — 削除済みでなければキーワードは一意
**インデックス：** (keyword) — 前方一致検索用

### 3.3 トランザクション管理・ロック戦略

#### 3.3.1 振替取引時のトランザクション処理

振替（transfers）操作時には、以下のアトミックな処理が必要：
- transfers レコード INSERT
- 振替が記録される（一覧表示・残高計算に反映）
- これらは単一の DB トランザクション内で実行され、部分的な成功は許容しない

**実装方式**：
- PostgreSQL：`BEGIN; INSERT transfers; COMMIT;` による明示的トランザクション
- Android Room：`withTransaction { }` ブロック内で複数 DAO 操作

#### 3.3.2 定期取引バッチ処理時のロック

日次バッチで `recurring_transactions` から取引を生成する際、複数バッチ実行の重複防止が必要：
- **行レベルロック**（Postgres FOR UPDATE）を使用し、処理中のルールを他プロセスがアクセスできないようロック
- バッチ完了または障害時に自動的にロック解放
- バッチ開始時に前回完了時刻を記録し、重複実行を防止

#### 3.3.3 楽観的ロック（バージョン競合）の競合解決

- クライアント A, B が同一レコードを同時に編集. A が先にサーバーに PUT → version 1→version 2
- B の PUT 時に `version` が 1 だが、サーバーは version 2 だため競合検知
- **競合通知**：クライアント B に 409 CONFLICT レスポンスを返却。レスポンスボディにサーバー側の最新データを含める
- **ユーザー確認ダイアログ**：クライアント B のアプリに確認画面を表示
  - 「サーバーに新しい変更があります。以下を選択してください：
    1. サーバーの値を採用（自己の編集を破棄）→ サーバー最新データをローカルに置き換え
    2. ローカルの値を採用（サーバーを上書き）→ 新たに PUT リクエスト送信（`version` を最新に更新）。ただし、サーバーでの編集内容は失われる警告を表示
    3. 確認して手動マージ → フィールドごとの差分表示、ユーザーが決定"
- フィールド複数競合時は、フィールドごとの差分を表示し、ユーザーが選択肢を指定

### 3.4 論理削除の方針

論理削除は `deleted_at`（Timestamp）フィールドで管理する。NULLなら有効、非NULLなら削除済み。

- accounts, categories, tags, templates, recurring_transactions, budgets, transfers, notification_settings, input_patterns は論理削除（`deleted_at` を設定）
- transactions は論理削除（`deleted_at` を設定）。Undo機能（2.9.2）はこのフィールドで実現（`deleted_at`をNULLに戻すことで復元）
- transaction_tags, template_tags, recurring_transaction_tags は物理削除
- transaction_history は物理削除（保持上限5件を超えた古い履歴を削除）
- refresh_tokens は `revoked_at` で失効管理（論理削除とは異なる）
- **論理削除されたレコードは一覧・集計から除外するが、同期時には伝播する**
- **論理削除されたカテゴリ・アカウントの扱い**：
  - **新規取引作成時**：選択肢から除外（UI に表示しない）
  - **既存取引の参照**：削除済みカテゴリ/アカウントを参照する既存取引は、詳細画面に削除済みを示す（"[削除済み] 食費")表示。一覧画面では、カテゴリも非表示（デフォルト色・テキストで表示）
  - **分析・グラフ集計**：削除済みカテゴリを参照する過去取引は分析から除外（該当カテゴリの月別支出グラフには含めない）。ただし "その他支出" へ自動振り替えされた場合は "その他" にカウント
  - **残高計算**：削除済みアカウントに紐づく取引も計算に含める（残高の歴史的精度を維持）
- **論理削除レコードの物理削除（クリーンアップ）ポリシー**：
  - 論理削除から90日経過したレコードを物理削除対象とする
  - 物理削除は週次バッチ（毎週日曜 3:00 JST）で実行
  - 物理削除前にバックアップが正常に取得されていることを確認（最新のpg_dumpバックアップが24時間以内であること）
  - 中間テーブル（transaction_tags等）の孤立レコードも同時にクリーンアップ
  - refresh_tokens は `revoked_at` 設定後30日経過、または `expires_at` を過ぎたレコードを物理削除

### 3.5 デフォルトカテゴリ（初期データ）

初回セットアップ時に以下のカテゴリを自動作成する（`is_default = true`）。

**支出カテゴリ：**
食費、日用品、交通費、娯楽・趣味、衣服・美容、医療・健康、教育・教養、住居費、光熱費・通信費、保険、税金・社会保険、交際費、その他支出

**収入カテゴリ：**
給与、賞与、副業・フリーランス、投資収益、その他収入

### 3.6 デフォルト通知設定（初期データ）

| 種別 | 初期値 |
|---|---|
| 入力リマインド (input_remind) | 有効、週 1回（日曜）、20:00 |
| 予算アラート (budget_alert) | 有効、閾値80%（100%超過時のアラートはシステム固定） |

---

## 4. API仕様

### 4.1 共通仕様

- ベースURL：`/api/v1`（将来的に v2 以上に拡張可能）
- 認証：Authorizationヘッダーに`Bearer {access_token}`を付与（認証エンドポイントを除く）
- リクエスト/レスポンス形式：`application/json`
- 日時形式：ISO 8601（UTC、ミリ秒精度）
- **ページネーション仕様**（詳細）：
  - Web GUI（無限スクロール）：**カーソルベース推奨**（`cursor` パラメータで最終レコードのIDを指定、1レコード分次のセットを取得）
  - Android（ページング）：**オフセット式** `page`（1始まり）, `size`（デフォルト50, 最大100）
  - 理由：Web の無限スクロール時にオフセット式では「新規取引が途中に挿入された場合、重複や抜けが発生」（タイムライン問題）
  - API レスポンスには `total_count` を含める（ただしカーソルベース時は `has_next` boolean を使用）
- ソート：クエリパラメータ `sort`（例：`date,desc/amount,asc`）
- タイムゾーン：すべての日付は UTC で保存。クライアント側で時分秒をユーザーローカライズ表示。日（date）のみ JST 基準で計算（0:00 JST ～ 23:59 JST）

### 4.2 共通エラーレスポンス形式

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "入力内容にエラーがあります",
    "details": [
      {
        "field": "amount",
        "message": "金額は0より大きい値を指定してください"
      }
    ]
  }
}
```

**エラーコード体系：**

| HTTPステータス | エラーコード | 説明 |
|---|---|---|
| 400 | VALIDATION_ERROR | 入力値のバリデーション失敗（フィールド単位の詳細含む） |
| 400 | INVALID_REQUEST | リクエスト形式の不正（JSON 解析失敗等） |
| 401 | UNAUTHORIZED | 認証ヘッダー未指定または不正（Bearer token なし等） |
| 401 | TOKEN_EXPIRED | アクセストークン期限切れ。リフレッシュトークンで更新可能 |
| 401 | TOKEN_REVOKED | リフレッシュトークンが失効または返却済み。再ログイン必須 |
| 403 | FORBIDDEN | 認証済みだが操作権限なし（シングルユーザー版では通常返却不可） |
| 404 | NOT_FOUND | リソース（transaction, category 等）が見つからない |
| 409 | CONFLICT | **バージョン競合**（楽観的ロック）。レスポンスに `server_data` を含める |
| 422 | UNPROCESSABLE_ENTITY | 業務ロジックエラー（例：デフォルトカテゴリ削除不可、自己宛振替不可） |
| 413 | FILE_TOO_LARGE | ファイルサイズ超過（Excel インポート >10MB 等） |
| 429 | RATE_LIMIT_EXCEEDED | レートリミット超過（ブルートフォース対策） |
| 500 | INTERNAL_ERROR | サーバー内部エラー。スタックトレースは露出しない |

### 4.3 認証 API

#### POST /api/v1/auth/setup

初期セットアップ（ユーザー未作成時のみ実行可能）。

```
Request:  { "username": "string", "password": "string" }
Response: { "user": { "id": "uuid", "username": "string" } }
```

#### POST /api/v1/auth/login

```
Request:  { "username": "string", "password": "string" }
Response: {
  "access_token": "string",
  "refresh_token": "string",
  "expires_in": 900
}
```

#### POST /api/v1/auth/refresh

```
Request:  { "refresh_token": "string" }
Response: {
  "access_token": "string",
  "refresh_token": "string",
  "expires_in": 900
}
```

#### POST /api/v1/auth/logout

現在のリフレッシュトークンを失効させる。

```
Request:  { "refresh_token": "string" }
Response: 204 No Content
```

#### PUT /api/v1/auth/password

パスワード変更。変更成功時、当該ユーザーの全リフレッシュトークンを失効させ（`revoked_at` を設定）、再ログインを要求する。

```
Request:  { "current_password": "string", "new_password": "string" }
Response: 204 No Content
```

**セキュリティ注記：** パスワード変更後、クライアントはログイン画面へ遷移し、新しいトークンペアを取得する。

### 4.4 取引 API

| メソッド | パス | 説明 |
|---|---|---|
| GET | /api/v1/transactions | 取引一覧（フィルタ・ページネーション対応） |
| GET | /api/v1/transactions/{id} | 取引詳細 |
| POST | /api/v1/transactions | 取引作成 |
| PUT | /api/v1/transactions/{id} | 取引更新（version必須） |
| DELETE | /api/v1/transactions/{id} | 取引論理削除（version必須） |
| PATCH | /api/v1/transactions/{id}/restore | 取引の論理削除取消（Undo用。deleted_at を NULL に戻す） |
| GET | /api/v1/transactions/{id}/history | 取引の変更履歴 |

**GET /api/v1/transactions クエリパラメータ：**

| パラメータ | 型 | 説明 |
|---|---|---|
| date_from | LocalDate | 開始日 |
| date_to | LocalDate | 終了日 |
| type | Enum | "income" / "expense" |
| category_id | UUID | カテゴリID |
| account_id | UUID | アカウントID |
| tag_ids | UUID[] | タグID（カンマ区切り、AND検索） |
| keyword | String | メモのキーワード検索 |
| page | Integer | ページ番号（1始まり、デフォルト1。オフセット式時に使用） |
| size | Integer | 1ページあたりの件数（デフォルト50, 最大100） |
| cursor | String | カーソル（前回レスポンスの `next_cursor` 値。カーソルベース時に使用。page との併用不可） |
| sort | String | ソート（例："date,desc"） |

**レスポンス（オフセットベース・ページネーション付き）：**

```json
{
  "data": [ ... ],
  "pagination": {
    "page": 1,
    "size": 50,
    "total_count": 1234,
    "total_pages": 25
  }
}
```

**レスポンス（カーソルベース・ページネーション付き）：**

```json
{
  "data": [ ... ],
  "pagination": {
    "size": 50,
    "has_next": true,
    "next_cursor": "base64-encoded-cursor-value"
  }
}
```

**カーソル値の構成：** ソートキー（日付等）とレコードIDをBase64エンコードした値。クライアントは値を解釈せずそのまま次のリクエストに渡す。

### 4.5 カテゴリ API

| メソッド | パス | 説明 |
|---|---|---|
| GET | /api/v1/categories | カテゴリ一覧 |
| POST | /api/v1/categories | カテゴリ作成 |
| PUT | /api/v1/categories/{id} | カテゴリ更新 |
| DELETE | /api/v1/categories/{id} | カテゴリ論理削除（`is_default=true`の場合は422エラーを返却） |

### 4.6 アカウント API

| メソッド | パス | 説明 |
|---|---|---|
| GET | /api/v1/accounts | アカウント一覧（残高計算値を含む） |
| POST | /api/v1/accounts | アカウント作成 |
| PUT | /api/v1/accounts/{id} | アカウント更新 |
| DELETE | /api/v1/accounts/{id} | アカウント論理削除 |

### 4.7 タグ API

| メソッド | パス | 説明 |
|---|---|---|
| GET | /api/v1/tags | タグ一覧 |
| POST | /api/v1/tags | タグ作成 |
| PUT | /api/v1/tags/{id} | タグ更新 |
| DELETE | /api/v1/tags/{id} | タグ論理削除 |

### 4.8 テンプレート API

| メソッド | パス | 説明 |
|---|---|---|
| GET | /api/v1/templates | テンプレート一覧（使用頻度順） |
| POST | /api/v1/templates | テンプレート作成 |
| PUT | /api/v1/templates/{id} | テンプレート更新 |
| DELETE | /api/v1/templates/{id} | テンプレート論理削除 |

### 4.9 定期取引 API

| メソッド | パス | 説明 |
|---|---|---|
| GET | /api/v1/recurring-transactions | 定期取引一覧 |
| POST | /api/v1/recurring-transactions | 定期取引作成 |
| PUT | /api/v1/recurring-transactions/{id} | 定期取引更新 |
| DELETE | /api/v1/recurring-transactions/{id} | 定期取引論理削除 |
| PATCH | /api/v1/recurring-transactions/{id}/toggle | 有効/無効の切り替え |

### 4.10 予算 API

| メソッド | パス | 説明 |
|---|---|---|
| GET | /api/v1/budgets?year_month={YYYY-MM} | 指定月の予算一覧 |
| PUT | /api/v1/budgets | 予算の一括設定（upsert） |
| DELETE | /api/v1/budgets/{id} | 予算の削除（論理削除、version必須） |

### 4.11 分析 API

| メソッド | パス | 説明 |
|---|---|---|
| GET | /api/v1/analytics/dashboard | ダッシュボードデータ |
| GET | /api/v1/analytics/category-breakdown?year_month={YYYY-MM} | カテゴリ別内訳 |
| GET | /api/v1/analytics/trends?from={YYYY-MM}&to={YYYY-MM} | カテゴリ別推移 |
| GET | /api/v1/analytics/comparison?year_month={YYYY-MM} | 前月比・前年同月比 |
| GET | /api/v1/analytics/yearly-summary?year={YYYY} | 年間サマリー |

**キャッシュ戦略：** 分析APIのレスポンスはサーバー側でインメモリキャッシュ（TTL: 5分）を適用する。取引の作成・更新・削除時に該当月のキャッシュを無効化する。Android側ではRoomのクエリ結果をFlowで監視し、ローカルデータ変更時に自動で再計算する。Web GUI側ではTanStack Queryのキャッシュ（staleTime: 30秒）を使用する。

### 4.12 同期 API

| メソッド | パス | 説明 |
|---|---|---|
| POST | /api/v1/sync/push | クライアント→サーバーの変更送信 |
| GET | /api/v1/sync/pull?since={timestamp} | サーバー→クライアントの変更取得 |

**POST /api/v1/sync/push リクエスト：**

**バッチサイズ制限：** 1リクエストあたり最大100件の変更。超過時は 400 VALIDATION_ERROR を返却。クライアント側で100件ずつ分割して送信すること。リクエストボディの最大サイズは5MB。

```json
{
  "changes": [
    {
      "entity_type": "transaction",
      "operation": "create" | "update" | "delete",
      "data": { ... },
      "client_version": 1
    }
  ]
}
```

**レスポンス：**

```json
{
  "results": [
    {
      "entity_type": "transaction",
      "id": "uuid",
      "status": "accepted" | "conflict",
      "server_version": 2,
      "server_data": { ... }
    }
  ]
}
```

**GET /api/v1/sync/pull レスポンス：**

`since` パラメータ（ISO 8601 UTC タイムスタンプ）以降に更新されたレコードを返却する。論理削除されたレコードも含む（クライアント側で削除を反映するため）。

```json
{
  "data": {
    "transactions": [ ... ],
    "categories": [ ... ],
    "accounts": [ ... ],
    "tags": [ ... ],
    "templates": [ ... ],
    "recurring_transactions": [ ... ],
    "budgets": [ ... ],
    "transfers": [ ... ],
    "notification_settings": [ ... ],
    "input_patterns": [ ... ]
  },
  "sync_timestamp": "2026-02-27T12:00:00.000Z",
  "has_more": false
}
```

**注：** `sync_timestamp` は次回 pull 時の `since` パラメータとして使用する。`has_more` が `true` の場合、`sync_timestamp` を `since` として再度リクエストして残りのデータを取得する（1回あたり最大1000件）。

### 4.13 インポート/エクスポート API

| メソッド | パス | 説明 |
|---|---|---|
| POST | /api/v1/import/excel | Excelファイルのインポート（multipart/form-data） |
| POST | /api/v1/import/excel/preview | インポートプレビュー |
| GET | /api/v1/export/csv?date_from={}&date_to={} | CSVエクスポート |
| GET | /api/v1/export/pdf?type={monthly\|yearly}&year_month={} | PDFエクスポート |
| GET | /api/v1/backup | 全データバックアップ（JSON） |
| POST | /api/v1/backup/restore | バックアップからリストア |

### 4.14 入力補完 API

| メソッド | パス | 説明 |
|---|---|---|
| GET | /api/v1/suggestions/memo?q={keyword} | メモの入力候補（上位10件） |
| GET | /api/v1/suggestions/auto-complete?memo={text} | メモからカテゴリ・アカウントを推定 |

### 4.15 振替 API

| メソッド | パス | 説明 |
|---|---|---|
| GET | /api/v1/transfers | 振替一覧（フィルタ・ページネーション対応） |
| GET | /api/v1/transfers/{id} | 振替詳細 |
| POST | /api/v1/transfers | 振替作成 |
| PUT | /api/v1/transfers/{id} | 振替更新（version必須） |
| DELETE | /api/v1/transfers/{id} | 振替論理削除（version必須） |
| PATCH | /api/v1/transfers/{id}/restore | 振替の論理削除取消（Undo用。deleted_at を NULL に戻す） |

**GET /api/v1/transfers クエリパラメータ：**

| パラメータ | 型 | 説明 |
|---|---|---|
| date_from | LocalDate | 開始日 |
| date_to | LocalDate | 終了日 |
| account_id | UUID | アカウントID（出金元または入金先） |
| page | Integer | ページ番号 |
| size | Integer | 1ページあたりの件数 |

### 4.16 通知設定 API

| メソッド | パス | 説明 |
|---|---|---|
| GET | /api/v1/notification-settings | 通知設定一覧 |
| PUT | /api/v1/notification-settings/{id} | 通知設定更新 |

### 4.17 ヘルスチェック API

| メソッド | パス | 説明 |
|---|---|---|
| GET | /api/v1/health | ヘルスチェック（認証不要） |

**レスポンス：**

```json
{
  "status": "ok",
  "version": "1.0.0",
  "timestamp": "2026-02-27T12:00:00.000Z",
  "checks": {
    "database": "ok"
  }
}
```

**用途：** デプロイ後の動作確認、Docker / Nginx のヘルスチェック設定、監視ツールからのポーリング対象。

---

## 5. 非機能要件

### 5.1 データ同期

#### 5.1.1 同期方式

- オンライン復帰時にローカルの未同期データをサーバーへ送信
- レコード単位のバージョン管理（楽観的ロック）による同期制御
- 同期対象エンティティ：transactions, categories, accounts, tags, templates, recurring_transactions, budgets, transfers, notification_settings, input_patterns

#### 5.1.2 コンフリクト処理方針

| 操作 | 方針 |
|---|---|
| 新規追加（INSERT） | クライアント側でUUIDを生成するため、競合は発生しない |
| 編集（UPDATE） | サーバー側のversionと比較し、競合検知時はユーザーに確認ダイアログを表示。詳細は3.3.3を参照 |
| 削除（DELETE） | `deleted_at` フィールドの更新で論理削除。競合時もサーバー側の削除状態を優先 |
| 同期コンフリクト | 409 CONFLICT レスポンスに `server_data` を含める。クライアント側で比較画面を表示またはマージを選択可能 |

#### 5.1.3 同期管理フィールド

**サーバー側（PostgreSQL）：** 3.2節の各エンティティ定義に含まれる `version`, `updated_at` フィールドを使用。

**Android側（Room）の追加フィールド：** Roomエンティティには以下のフィールドを追加する。サーバー側のテーブルには含めない。

| フィールド | 型 | 説明 |
|---|---|---|
| is_synced | Boolean | サーバーとの同期済みフラグ |
| sync_status | String | "clean" / "pending" / "conflict" |
| local_updated_at | Long | ローカルでの更新タイムスタンプ（競合検知用） |

### 5.2 オフライン対応

- Androidアプリはローカルデータベース（Room）にデータを保持する
- オフライン時も全ての閲覧・入力・編集操作が可能
- オンライン復帰時に自動でバックグラウンド同期を実行する
- 分析・グラフ機能もローカルデータで動作する
- Web GUIはオンライン前提。ネットワークエラー時はリトライボタンを表示し、ローカルデータの保持は行わない

### 5.3 セキュリティ

#### 5.3.1 通信セキュリティ

- サーバーとの通信はHTTPS（TLS 1.2以上）で暗号化
- HSTS（HTTP Strict Transport Security）ヘッダーの付与

#### 5.3.2 認証・認可

- JWT（JSON Web Token）によるステートレス認証
- **アクセストークン有効期限**：15 分
  - **自動リフレッシュ機構**（重要）：
    - クライアント側で API レスポンス時に HTTP 401 TOKEN_EXPIRED を検知、自動的にリフレッシュトークンで更新試行
    - Android：AppInterceptor で自動リフレッシュ＆リトライ（ユーザー干渉なし）
    - Web GUI：Axios interceptor で自動リフレッシュ＆リトライ（ユーザー干渉なし）
    - ただし、5 回以上連続リフレッシュ失敗時は「セッションが無効です。再ログインしてください」でログイン画面へ遷移
- **リフレッシュトークン有効期限**：30 日
  - リフレッシュトークンローテーション：更新時に旧トークンを失効させ（`revoked_at` を設定）、新トークンを発行
  - 旧トークンでのアクセス試行時は 401 を返す
- **パスワード要件**：8 文字以上、英大文字・小文字・数字をそれぞれ 1 文字以上含む
- **パスワード保存**：bcrypt（コストファクター 12）
- **Androidトークン保存**：アクセストークン・リフレッシュトークンは `EncryptedSharedPreferences`（AES-256-GCM）に保存する。平文の `SharedPreferences` への保存は禁止。Android Keystore と連携した鍵管理を使用すること
- **初期セットアップ**：サーバー初回起動時にユーザー作成エンドポイント（/api/v1/auth/setup）を一度だけ実行可能。ユーザー作成後はこのエンドポイントを無効化（409 を返す）
- **API トークン有効期限の検出**：
  - JWT の `exp` クレーム（Unix タイムスタンプ）を使用
  - クライアント側では `exp` をローカルで確認し、有効期限 1 分前に自動リフレッシュを試行（先制的更新）

#### 5.3.3 入力バリデーション

- すべてのAPIリクエストに対してサーバー側でバリデーションを実施
- **金額管理**（重要）：
  - ストレージ：整数型（BIGINT / Long）で管理。小数点第2位は許容しない（両丸め不可）
  - 金額 > 0 かつ <= 9,999,999,999
  - クライアント UI では数値入力の小数点入力を**禁止**（`inputType="number" step="1"`）
  - ユーザーが小数点を含む金額を入力した場合：
    - Android：ダイアログで「整数のみ入力可。小数以下は四捨五入または削除してください」と表示
    - Web：リアルタイムバリデーション（小数点検出時に赤い下線 + 「整数で入力してください」エラーメッセージ）
  - API バリデーション：小数点を含む JSON 値は 400 VALIDATION_ERROR を返す
  - 理由：日本円は最小単位が 1 円。小数点は金融取引で曖昧さの源泉
- 文字列フィールド：各エンティティ定義の最大文字数に準拠。また、長さ 0（空文字）は NOT NULL 制約がある場合は拒否
- 日付：不正な日付形式の拒否、未来日付の許可（予定支出対応）
- UUID：RFC 4122準拠のフォーマット検証
- クライアント側（Android / Web）でも同一のバリデーションルールを適用し、UXを向上
- **特殊フィールド**：
  - カテゴリ名・タグ名・アカウント名：先頭・末尾の空白を自動トリム。重複は拒否（deleted_at を考慮）
  - `day_of_week`：0-6（月-日）の整数に限定
  - `day_of_month`：1-31 の整数（月末処理ロジックで自動調整）

#### 5.3.4 セキュリティヘッダー

Nginxで以下のセキュリティヘッダーを付与：

| ヘッダー | 値 |
|---|---|
| Content-Security-Policy | default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' |
| X-Content-Type-Options | nosniff |
| X-Frame-Options | DENY |
| X-XSS-Protection | 0（CSPで代替） |
| Referrer-Policy | strict-origin-when-cross-origin |

**注：** `style-src 'unsafe-inline'` は MUI（Material UI）の動的スタイル注入に必要なため許可している。将来的にはnonce ベースの CSP（`style-src 'nonce-{random}'`）への移行を検討し、XSS リスクを軽減すること。

#### 5.3.5 レートリミット

| エンドポイント | 制限 |
|---|---|
| /api/v1/auth/login | 5回/分（ブルートフォース対策） |
| /api/v1/auth/setup | 3回/分 |
| その他のAPI | 60回/分 |

#### 5.3.6 CORS設定

- 許可オリジン：Web GUIのデプロイドメインのみ
- 許可メソッド：GET, POST, PUT, PATCH, DELETE, OPTIONS
- 許可ヘッダー：Content-Type, Authorization
- クレデンシャル：不要（Bearerトークン方式のため）

### 5.4 パフォーマンス

| 指標 | 目標値 |
|---|---|
| API応答時間（一覧系） | 500ms以下（50件取得時） |
| API応答時間（CRUD操作） | 200ms以下 |
| API応答時間（分析系） | 1,000ms以下（3年分データ） |
| Androidアプリ起動時間 | 2秒以下（コールドスタート） |
| 同期処理 | バックグラウンド実行、UIをブロックしない |
| 対応データ量 | 5年分・10万件の取引データで正常動作 |

### 5.5 エラーハンドリング

#### 5.5.1 クライアントサイド（Android / Web GUI）

- ネットワークエラー時：トースト/スナックバーで通知、操作はローカルに保持（Android）/ リトライボタンを表示（Web）
- バリデーションエラー時：該当フィールドの直下にエラーメッセージを赤字で表示
- サーバーエラー（5xx）時：「サーバーに接続できません。しばらくしてからお試しください」を表示
- トークン期限切れ時：自動的にリフレッシュトークンで更新。リフレッシュも失敗した場合はログイン画面へ遷移

#### 5.5.2 サーバーサイド

- すべてのエラーは4.2節の共通エラーレスポンス形式に準拠
- 未ハンドルの例外はINTERNAL_ERRORとして返却し、スタックトレースをクライアントに露出しない
- エラーログはアプリケーションログに記録する

### 5.6 ログ・監視

- アプリケーションログ：Ktor標準ロガー（SLF4J + Logback）でファイル出力
- ログレベル：本番環境はINFO以上、開発環境はDEBUG以上
- ログローテーション：日次ローテーション、30日間保持
- アクセスログ：Nginx標準アクセスログ（combined形式）
- エラー監視：
  - **初期リリース**：ヘルスチェック API（`GET /api/v1/health`）をcron（5分間隔）で監視。応答がない場合やステータスが異常の場合はメール通知（シンプルなシェルスクリプトで実装）
  - **ログ監視**：Logback の ERROR レベルログを日次で集計し、異常増加時にメール通知
  - **将来的改善**：Prometheus + Grafana等の監視ツール導入を検討

### 5.7 テスト戦略

| テスト種別 | 対象 | フレームワーク | カバレッジ目標 |
|---|---|---|---|
| 単体テスト | バックエンド（service, repository） | JUnit 5 + MockK | 80%以上 |
| 単体テスト | Android（ViewModel, UseCase） | JUnit 5 + MockK | 70%以上 |
| 単体テスト | Web GUI（hooks, stores, utils） | Vitest | 70%以上 |
| 結合テスト | バックエンドAPI | Ktor TestApplication | 主要エンドポイント全カバー |
| UIテスト | Android | Compose UI Test | 主要画面フロー |
| E2Eテスト | Web GUI | Playwright | 主要ユーザーフロー |

### 5.8 デプロイ

#### 5.8.1 デプロイフロー

1. 開発：ローカル環境（Docker Compose）で開発・テスト
2. CI：GitHub ActionsでPR時に自動テスト・ビルド
3. 本番デプロイ：mainブランチへのマージをトリガーに、GitHub Actionsでビルド→サーバーへデプロイ

#### 5.8.2 本番環境構成

- Docker Composeで以下を起動：
  - バックエンドAPI（Ktorアプリケーション）
  - PostgreSQL
- Nginx（ホストマシンで稼働）：
  - HTTPS終端（Let's Encrypt証明書）
  - Web GUI静的ファイル配信
  - APIリバースプロキシ（`/api/*` → バックエンドコンテナ）
- PostgreSQLデータのバックアップ：日次でpg_dump実行、7日分保持

---

## 6. 技術スタック

### 6.1 全体構成

```
┌─────────────┐         ┌─────────────────────┐
│  Android App │         │     Backend API      │
│   Kotlin     │────────►│   Kotlin (Ktor)     │
│   Jetpack    │◄────────│   PostgreSQL        │
│   Compose    │         │                     │
│   Room       │         └──────────┬──────────┘
└─────────────┘                    ▲
                                   │
               ┌─────────────┐     │
               │   Web GUI   │─────┘
               │   React     │
               │  TypeScript │
               └─────────────┘
```

AndroidアプリとバックエンドをKotlinで統一することで、APIのデータクラス・バリデーションロジック・定数定義をGradleマルチモジュールで共有する。

### 6.2 Androidアプリ

| 要素 | 技術 | 用途 |
|---|---|---|
| 言語 | Kotlin | Android公式推奨言語 |
| UI | Jetpack Compose | 宣言的UIフレームワーク |
| ローカルDB | Room | SQLiteラッパー、オフライン対応 |
| HTTP通信 | Ktor Client | バックエンドとの通信 |
| 非同期処理 | Kotlin Coroutines + Flow | 同期処理・リアクティブなデータ監視 |
| DI（依存性注入） | Hilt | Google推奨のDIフレームワーク |
| バックグラウンド処理 | WorkManager | 定期支出自動登録・同期・リマインド通知 |
| グラフ描画 | Vico | Compose対応チャートライブラリ |
| PDF生成 | iText / Android PDF API | オフライン時の簡易PDFレポート生成用（サーバー接続時はサーバー側で生成） |
| アーキテクチャ | MVVM + Clean Architecture | Google推奨のアーキテクチャパターン |

#### 6.2.1 Androidプロジェクト構成

```
android/
├── data/               # データ層
│   ├── local/          #   Room DAO、Entity
│   ├── remote/         #   API通信（Ktor Client）
│   ├── repository/     #   リポジトリ実装
│   └── sync/           #   同期ロジック
├── domain/             # ドメイン層
│   ├── model/          #   ビジネスモデル
│   └── usecase/        #   ユースケース
├── ui/                 # プレゼンテーション層
│   ├── dashboard/      #   ダッシュボード画面
│   ├── input/          #   入力画面
│   ├── list/           #   一覧画面
│   ├── analysis/       #   分析・グラフ画面
│   ├── settings/       #   設定画面
│   ├── widget/         #   ウィジェット
│   └── theme/          #   テーマ（ダークモード含む）
└── di/                 # Hilt DI モジュール
```

### 6.3 バックエンド

| 要素 | 技術 | 用途 |
|---|---|---|
| 言語 | Kotlin | Androidと言語統一によるコード共有 |
| フレームワーク | Ktor (Server) | 軽量REST APIフレームワーク |
| データベース | PostgreSQL | メインDB |
| ORM | Exposed | Kotlin製ORM |
| コネクションプール | HikariCP | DB接続プーリング（Exposed に組み込み。`maximumPoolSize` / `connectionTimeout` をアプリ設定で調整） |
| DBマイグレーション | Flyway | スキーマのバージョン管理 |
| 認証 | JWT（JSON Web Token） | アクセストークン + リフレッシュトークン |
| シリアライゼーション | kotlinx.serialization | JSON変換（Android側と共通） |
| ビルドツール | Gradle | Android側と共通 |
| ロギング | SLF4J + Logback | アプリケーションログ |
| 定期処理 | Kotlin Coroutines + Timer | 定期取引の自動登録（日次バッチ。Ktor起動時にコルーチンでスケジューラーを起動） |

#### 6.3.1 バックエンドプロジェクト構成

```
backend/
├── routes/             # APIルーティング定義
├── service/            # ビジネスロジック
├── repository/         # DB操作（Exposed）
├── auth/               # JWT認証・トークン管理
├── db/                 # テーブル定義、Flywayマイグレーション
├── middleware/          # レートリミット、ロギング、エラーハンドリング
└── config/             # アプリケーション設定
```

### 6.4 Web GUI

| 要素 | 技術 | 用途 |
|---|---|---|
| 言語 | TypeScript | 型安全なJavaScript |
| フレームワーク | React | UIライブラリ |
| UIコンポーネント | MUI（Material UI） | AndroidのMaterial Designとデザイン統一 |
| 状態管理 | Zustand | 軽量状態管理ライブラリ |
| HTTP通信 | Axios + TanStack Query | API通信・キャッシュ・ローディング管理 |
| グラフ描画 | Recharts | React対応チャートライブラリ |
| ルーティング | React Router | ページ遷移管理 |
| ビルドツール | Vite | 高速ビルド・開発サーバー |
| ダークモード | MUI テーマ機能 | ライト / ダーク / システム追従の3モード |
| フォームバリデーション | React Hook Form + Zod | バリデーションルールの定義・検証 |

#### 6.4.1 Web GUIプロジェクト構成

```
web/
├── src/
│   ├── components/     # 共通UIコンポーネント
│   ├── pages/          # ページコンポーネント
│   │   ├── Dashboard/  #   ダッシュボード
│   │   ├── Input/      #   入力画面
│   │   ├── List/       #   一覧画面
│   │   ├── Analysis/   #   分析・グラフ画面
│   │   └── Settings/   #   設定画面
│   ├── hooks/          # カスタムフック
│   ├── api/            # API通信定義
│   ├── stores/         # Zustand ストア
│   ├── types/          # TypeScript型定義
│   ├── utils/          # ユーティリティ
│   ├── validation/     # Zodバリデーションスキーマ
│   └── theme/          # MUIテーマ設定
├── public/
└── vite.config.ts
```

### 6.5 共有モジュール

AndroidアプリとバックエンドのKotlinコードを共有するモジュール。

```
shared/
├── models/             # APIリクエスト/レスポンスのデータクラス
├── validation/         # 共通バリデーションルール
├── constants/          # 共通定数（カテゴリ種別、同期ステータス等）
└── util/               # 共通ユーティリティ
```

**Web GUIとの型共有方針：**

Web GUIはTypeScript/Reactであり、Kotlin共有モジュールを直接参照できない。以下の方針で型の整合性を担保する：

- バックエンドのAPIスキーマを信頼できる唯一の情報源（Single Source of Truth）とする
- Web GUI側では `web/src/types/` にTypeScript型定義を手動で管理する
- shared/modelsのデータクラスと web/src/types/ の型定義の整合性は、結合テスト（APIレスポンスの型検証）で担保する
- 将来的にはOpenAPI仕様書からの自動生成を検討

### 6.6 インフラ・開発ツール

| 要素 | 技術 | 用途 |
|---|---|---|
| コンテナ | Docker + Docker Compose | バックエンド + PostgreSQL のローカル開発・本番環境 |
| CI/CD | GitHub Actions | ビルド・テスト・デプロイの自動化 |
| ホスティング | 自宅サーバー or VPS（ConoHa, さくら等） | シングルユーザーのため小規模で十分 |
| リバースプロキシ | Nginx | HTTPS終端、Web GUI静的配信、APIプロキシ |
| SSL証明書 | Let's Encrypt | 無料SSL証明書の自動更新 |
| バージョン管理 | Git + GitHub | ソースコード管理 |

### 6.7 Gradleマルチモジュール全体構成

```
kakeibo/
├── shared/             # 共有モジュール（Kotlin）
├── backend/            # バックエンドモジュール（Kotlin / Ktor）
├── android/            # Androidアプリモジュール（Kotlin / Compose）
├── web/                # Web GUIモジュール（TypeScript / React）※Gradle管理外
├── docker/             # Docker関連ファイル
│   ├── Dockerfile.backend
│   ├── Dockerfile.web
│   └── docker-compose.yml
├── .github/
│   └── workflows/      # GitHub Actions
├── build.gradle.kts    # ルートビルドファイル（shared, backend, androidを管理）
├── settings.gradle.kts
└── README.md
```

※ `web/` ディレクトリはNode.jsプロジェクト（npm/yarn管理）であり、Gradleのサブモジュールには含めない。

---

## 7. API バージョニング戦略

- 現在のバージョン: /api/v1（将来: v2以上をサポート）
- 破壊的変更時: エンドポイント削除、重要なパラメータ削除 → メジャーバージョンアップ
- 非破壊的変更: 新しいフィールド追加、新しいエンドポイント追加 → マイナーバージョン(v1内で対応可能な範囲)
- 後方互換性: クライアント側で未知フィールドは無視。サーバー側では旧バージョンクライアントへの対応を1~2バージョン古いまでサポート
- 非推奨エンドポイント: 廃止前に90日以上の予告期間を設定

---

## 8. 対象外（将来検討）

以下の機能は本バージョンでは対象外とし、将来的に検討する。

- iOS対応
- 家族共有モード（マルチユーザー）
- レシートOCR読み取り
- 銀行口座・クレカの自動連携（API連携）
- 指紋認証（生体認証）を利用したアプリロック・ログイン機能
- 多通貨対応（データ構造は初期リリースで準備済み）
- OpenAPI仕様書からのWeb GUI型定義自動生成

---

## 9. 実装方針

### 9.1 実装フェーズ概要

本プロジェクトは以下の3フェーズで順番に実装する。バックエンドを最初に確立することで、Web GUI・Androidの両フロントエンドが共通のAPI仕様に基づいて開発できる。

| フェーズ | 対象 | 主な理由 |
|---|---|---|
| Phase 1 | バックエンド | 両フロントエンドの依存元。DBスキーマ設計済みで着手しやすい |
| Phase 2 | Web GUI | オフライン同期なし・実装がシンプル。ビジネスロジックの検証を早期に行える |
| Phase 3 | Android | 最も複雑（オフライン同期・ウィジェット・WorkManager）。APIが安定してから実装 |

---

### 9.2 Phase 1: バックエンド

**目標**: Web GUI・Androidの両フロントエンドが依存するAPIとDBを確立する。

**実装優先度**

1. **認証基盤** — セッション管理、JWT発行・検証、パスワード変更時の全トークン失効
2. **マスタ系API** — categories, accounts, tags, templates（削除時の振り替えロジック含む）
3. **取引系API** — transactions, transfers（論理削除・Undo対応、編集履歴保持）
4. **集計・分析API** — ダッシュボード、カテゴリ別グラフ、予算消化率、前月比・前年同月比
5. **定期支出バッチ** — 日次バッチ（毎日0:00 JST）、月末処理ルール、リトライ制御
6. **インポート / エクスポート / バックアップ** — Excelインポート、CSVエクスポート、PDFレポート生成、JSONバックアップ・リストア

**完了基準**: 主要APIのE2Eテストが通過し、Web GUIの実装が開始できる状態であること。

---

### 9.3 Phase 2: Web GUI

**目標**: ブラウザ（PC・タブレット）から全機能を操作できる状態にする。バックエンドAPIの動作検証も兼ねる。

**実装優先度**

1. **ダッシュボード** — 今月の収支サマリー、予算消化率TOP3、直近取引履歴
2. **取引一覧・登録・編集** — 日別/月別/年別一覧、フィルタ・検索、無限スクロール、Undoスナックバー
3. **マスタ管理** — カテゴリ / アカウント / タグ / テンプレートのCRUD
4. **グラフ・分析** — 円グラフ、折れ線/棒グラフ、前月比・前年同月比
5. **予算管理** — カテゴリ別予算設定、消化率表示、予算超過バッジ・トースト（ポーリング30秒）
6. **インポート / エクスポート** — Excelインポート、CSVエクスポート、PDFレポート、バックアップ・リストア

**完了基準**: 主要ユースケースをWebブラウザ単体で一通り操作できること。

---

### 9.4 Phase 3: Android

**目標**: オフライン対応・ウィジェット・プッシュ通知を含むネイティブAndroidアプリを完成させる。

**実装優先度**

1. **ローカルDB（Room）セットアップ** — PostgreSQLスキーマと1対1対応するエンティティ、マイグレーション管理
2. **API同期基盤** — `is_synced` / `sync_status` / `version` による競合検知・解消、オフライン時のpending管理
3. **主要画面** — ダッシュボード、取引登録・一覧・編集（ページング方式）、マスタ管理
4. **テンプレート + ウィジェット** — テンプレート選択フロー、4×2/2×1ウィジェット、プロセス間データ共有
5. **WorkManager** — バックグラウンド同期（定期）、入力リマインド通知（ローカル通知）、予算アラート通知
6. **オフライン対応の仕上げ** — ローカルPDF簡易版生成、バックアップ・リストア（オフライン時のローカル操作）

**完了基準**: オフライン状態で取引の記録・閲覧が可能で、オンライン復帰時にサーバーと正しく同期されること。

---

## 10. 改訂履歴

| 日付 | バージョン | 内容 |
|---|---|---|
| 2026-02-25 | 1.0 | 初版作成 |
| 2026-02-26 | 1.1 | 入力テンプレート・入力補完機能を追加、バックアップ・リストア機能を追加、ダッシュボード画面を追加、年間サマリー・収支バランス推移を追加、ダークモード・Undo・編集履歴を追加、通貨フィールド対応、入力リマインド通知を追加、セキュリティ要件を詳細化、将来検討に指紋認証を追加 |
| 2026-02-27 | 1.2 | 技術スタック（Android / バックエンド / Web GUI / インフラ）を追加、プロジェクト構成を追加 |
| 2026-02-27 | 1.3 | データモデル・エンティティ定義を追加（セクション3）、API仕様を追加（セクション4）、認証フロー詳細化（初期セットアップ・パスワード要件・トークン有効期限）、共通エラーレスポンス形式を定義、入力バリデーションルールを追加、セキュリティ要件強化（CORS・レートリミット・セキュリティヘッダー・TLS要件）、パフォーマンス要件を定量化、テスト戦略を追加、ログ・監視方針を追加、デプロイフローを追加、論理削除方針を明記、ページネーション仕様を追加、アーキテクチャ図を修正、Web GUIとの型共有方針を追記、Gradleマルチモジュール構成の注記を追加 |
| 2026-02-27 | 1.4 | レビューによる包括修正：振替(transfers)を独立テーブル化しtransactionsから分離、振替API(4.15)・通知設定API(4.16)を追加、notification_settings・input_patterns・transfersのエンティティ定義を追加、2文書間の整合性修正（論理削除方式is_deleted→deleted_at、金額型BigDecimal→Long整数、デフォルトカテゴリ名統一）、accountsにcurrency・tagsにcolor・templatesにlast_used_at・recurring_transactionsにcurrency・budgetsにcurrencyを追加、同期管理フィールド(is_synced/sync_status)をAndroid側専用として分離(5.1.3)、金額バリデーションから小数点許容を削除、CSPヘッダーにimg-src/font-src追加、Web GUIオンライン前提を明記、ER図を全テーブル対応に更新、バッチ障害対応・月末処理ルール・Undo範囲・Excelインポート詳細・CSVカラム・PDFレイアウト・バックアップスコープを詳細化、収入カテゴリグラフを追加、定期処理の技術名称を修正、is_default削除保護をAPI仕様に明記 |
| 2026-02-27 | 1.5 | セキュリティレビューによる修正：セクション番号重複の修正（旧6→7, 旧7→8, 旧8→9）、セクション3.2.12欠番修正（3.2.13以降を繰り上げ）、transaction_historyテーブルにcreated_at/updated_at追加・保持ポリシー明記、カーソルベースページネーションのレスポンス形式追加（4.4）、同期API pullレスポンス形式追加（4.12）・pushバッチサイズ制限追加、audit_log参照の修正（3.3.1）、予算アラート2段階閾値の仕様明確化（2.5.3）・チェックタイミング追加、Excelインポート金額バリデーション矛盾修正（負値の扱い明確化）、収入カテゴリ削除時のフォールバック先追記（2.1.4）、パスワード変更時の全トークン失効ポリシー追加（4.3）、タグ削除時の処理仕様追加（2.4）、予算個別削除API追加（4.10）、ヘルスチェックAPI追加（4.17）、論理削除レコードの物理削除ポリシー追加（3.4）、分析APIキャッシュ戦略追加（4.11）、CSVタグエスケープ処理追加（2.6.2）、day_of_week値範囲統一（0始まり）、ER図にrefresh_tokens追加・transaction_historyにuser_id追加、PDF生成のオンライン/オフライン場所明確化、CSPヘッダーの注記追加、監視方針のヘルスチェック自動化追加、バックアップリストア後の認証状態追記、DB設計書との命名差異注記追加、誤字修正7箇所 |
| 2026-02-27 | 1.6 | 実装方針を追加（セクション9）：Phase 1 バックエンド → Phase 2 Web GUI → Phase 3 Android の3フェーズ構成、各フェーズの実装優先度・完了基準を記述。旧セクション9（改訂履歴）をセクション10に繰り下げ |
| 2026-02-27 | 1.7 | 包括レビューによる修正：ER図の transfers ボックスの FK 命名を統一（from_account_id / to_account_id）、ER図の next_exec_date を next_execution_date に修正、DB設計書との命名不整合注記を削除（DB設計書側を修正済み）、ページネーション size デフォルト値を 20 から 50 に統一（機能要件 2.1.5 と整合）、Android JWT トークン保存先（EncryptedSharedPreferences）を明記（セクション 5.3.2）、バックアップファイルのセキュリティ注意事項を追加（セクション 2.6.3）、バックエンド技術スタックに HikariCP（DBコネクションプーリング）を追加（セクション 6.3） |
