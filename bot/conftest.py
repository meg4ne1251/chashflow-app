"""
pytest 共通設定。

bot.py は import 時に必須環境変数を読み取り、`CashflowBot()` を生成して
スラッシュコマンドを登録するため、テスト用のダミー環境変数を **import より前** に
設定しておく必要がある。conftest.py は pytest がテスト収集前に最初に読み込むため、
ここでモジュールレベルに設定しておけば `import bot` が安全に成功する。
"""
import os

# bot モジュールが import される前に必須環境変数をセットしておく
os.environ.setdefault("DISCORD_BOT_TOKEN", "test-token")
os.environ.setdefault("DISCORD_GUILD_ID", "123456789")
os.environ.setdefault("CASHFLOW_USERNAME", "tester")
os.environ.setdefault("CASHFLOW_PASSWORD", "secret")
# ALLOWED_USER_ID はデフォルト未設定（= 全員許可）にしておく
os.environ.pop("DISCORD_ALLOWED_USER_ID", None)
