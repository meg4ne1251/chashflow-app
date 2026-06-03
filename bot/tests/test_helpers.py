"""純粋関数（フォーマット・ラベル生成・権限判定・プログレスバー・Cookie 抽出）のテスト。"""
import pytest

import bot
from tests._fakes import FakeResponse


class TestFmtAmount:
    def test_jpy_uses_yen_symbol_and_thousands_separator(self):
        assert bot._fmt_amount(1500) == "¥1,500"

    def test_zero(self):
        assert bot._fmt_amount(0) == "¥0"

    def test_negative(self):
        assert bot._fmt_amount(-2000) == "¥-2,000"

    def test_large_amount(self):
        assert bot._fmt_amount(1234567890) == "¥1,234,567,890"

    def test_non_jpy_currency_uses_currency_code_prefix(self):
        assert bot._fmt_amount(100, "USD") == "USD100"


class TestTemplateLabel:
    def test_income_template(self):
        label = bot._template_label({"name": "給料", "type": "income", "amount": 250000, "currency": "JPY"})
        assert label == "給料 [収入 / ¥250,000]"

    def test_expense_template(self):
        label = bot._template_label({"name": "ランチ", "type": "expense", "amount": 800, "currency": "JPY"})
        assert label == "ランチ [支出 / ¥800]"

    def test_missing_amount_shows_placeholder(self):
        label = bot._template_label({"name": "メモ", "type": "expense"})
        assert "金額未設定" in label

    def test_missing_name_defaults_to_unknown(self):
        label = bot._template_label({"type": "expense", "amount": 100})
        assert label.startswith("不明")

    def test_label_truncated_to_max_length(self):
        long_name = "あ" * 200
        label = bot._template_label({"name": long_name, "type": "expense", "amount": 100})
        assert len(label) <= bot.MAX_LABEL_LENGTH


class TestIsAllowed:
    def test_only_configured_user_is_allowed(self, monkeypatch):
        # 許可ユーザーは1人のみ。他ユーザーはすべて拒否（フェイルセーフ）。
        monkeypatch.setattr(bot, "ALLOWED_USER_ID", 42)
        assert bot._is_allowed(42) is True
        assert bot._is_allowed(999) is False

    def test_allows_matching_user(self, monkeypatch):
        monkeypatch.setattr(bot, "ALLOWED_USER_ID", 42)
        assert bot._is_allowed(42) is True

    def test_rejects_non_matching_user(self, monkeypatch):
        monkeypatch.setattr(bot, "ALLOWED_USER_ID", 42)
        assert bot._is_allowed(7) is False


class TestProgressBar:
    def test_under_80_percent_is_green(self):
        bar = bot._progress_bar(50, length=10)
        assert "🟩" in bar and "🟥" not in bar
        assert len(bar) == 10

    def test_between_80_and_100_is_orange(self):
        bar = bot._progress_bar(85, length=10)
        assert "🟧" in bar and "🟥" not in bar

    def test_at_or_over_100_is_full_red(self):
        bar = bot._progress_bar(100, length=10)
        assert bar == "🟥" * 10

    def test_over_100_capped_red(self):
        bar = bot._progress_bar(150, length=10)
        assert bar == "🟥" * 10

    def test_zero_rate_all_empty(self):
        bar = bot._progress_bar(0, length=10)
        assert bar == "⬜" * 10


class TestExtractCookieValue:
    def test_extracts_named_cookie(self):
        resp = FakeResponse(set_cookie=["access_token=abc123; Path=/; HttpOnly"])
        assert bot._extract_cookie_value(resp, "access_token") == "abc123"

    def test_returns_none_when_absent(self):
        resp = FakeResponse(set_cookie=["other=xyz; Path=/"])
        assert bot._extract_cookie_value(resp, "access_token") is None

    def test_picks_correct_cookie_among_multiple_headers(self):
        resp = FakeResponse(set_cookie=[
            "access_token=aaa; Path=/; HttpOnly",
            "refresh_token=bbb; Path=/api; HttpOnly",
        ])
        assert bot._extract_cookie_value(resp, "access_token") == "aaa"
        assert bot._extract_cookie_value(resp, "refresh_token") == "bbb"

    def test_no_headers_returns_none(self):
        resp = FakeResponse(set_cookie=[])
        assert bot._extract_cookie_value(resp, "access_token") is None


class TestMakeEmbeds:
    def test_error_embed_has_title_and_message(self):
        embed = bot._make_error_embed("失敗しました")
        assert embed.title == "❌ エラー"
        assert embed.description == "失敗しました"
        assert embed.color.value == bot.EMBED_COLOR_ERROR

    def test_success_embed_income_uses_income_color(self):
        template = {"name": "給料", "type": "income", "currency": "JPY"}
        embed = bot._make_success_embed(template, 250000)
        assert embed.color.value == bot.EMBED_COLOR_INCOME
        field_values = {f.name: f.value for f in embed.fields}
        assert field_values["種別"] == "収入"
        assert field_values["金額"] == "¥250,000"

    def test_success_embed_expense_uses_expense_color(self):
        template = {"name": "ランチ", "type": "expense"}
        embed = bot._make_success_embed(template, 800)
        assert embed.color.value == bot.EMBED_COLOR_EXPENSE

    def test_success_embed_includes_memo_and_tags(self):
        template = {
            "name": "買い物",
            "type": "expense",
            "memo": "スーパー",
            "tags": [{"name": "食費"}, {"name": "日用品"}],
        }
        embed = bot._make_success_embed(template, 3000)
        field_values = {f.name: f.value for f in embed.fields}
        assert field_values["メモ"] == "スーパー"
        assert "食費" in field_values["タグ"] and "日用品" in field_values["タグ"]
