# CLAUDE.md

## Web GUI 編集ルール

- フロントエンド（`web/`）を編集する際は、**モバイル版とPC版の両方**に変更を反映すること
- `useMobile()` フックで分岐している箇所（`isMobile ? <mobile> : <desktop>`）がある場合、片方だけ変更して終わりにしない
- 新機能追加やUI変更を行った場合、モバイル向けにコンパクトなレイアウトで再設計して適用する
- セクションヘッダーの `variant`、間隔（spacing/margin）、Dialog の `fullScreen` など、既存のレスポンシブパターンと一貫性を保つ
