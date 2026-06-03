"""スラッシュコマンドのハッピーパス E2E テスト。

ネットワーク・discord ゲートウェイには接続せず、session を用意した状態で
コマンド callback を最後まで実行し、defer → API 取得 → followup.send までの
一連の流れと、送出される embed / view の内容を検証する。
"""
from unittest.mock import AsyncMock, MagicMock

import pytest
from discord import app_commands

import bot


def make_interaction(user_id: int = 1):
    """discord.Interaction の最小モック。followup.send は msg を返す。"""
    interaction = MagicMock(name="Interaction")
    interaction.user.id = user_id
    interaction.response.send_message = AsyncMock()
    interaction.response.defer = AsyncMock()
    interaction.response.send_modal = AsyncMock()
    interaction.followup.send = AsyncMock(return_value=MagicMock(name="Message"))
    return interaction


@pytest.fixture(autouse=True)
def allow_default_user(monkeypatch):
    # make_interaction の既定ユーザー (id=1) を許可ユーザーにしておく。
    monkeypatch.setattr(bot, "ALLOWED_USER_ID", 1)


@pytest.fixture(autouse=True)
def ready_session(monkeypatch):
    """bot.session を初期化済み（None でない）状態にする。"""
    monkeypatch.setattr(bot.bot, "session", MagicMock(name="Session"))


def _embeds_sent(interaction):
    """followup.send に渡された embed を全て集める。"""
    embeds = []
    for call in interaction.followup.send.await_args_list:
        embed = call.kwargs.get("embed")
        if embed is not None:
            embeds.append(embed)
    return embeds


def _field_text(embed):
    return "\n".join(f"{f.name}\n{f.value}" for f in embed.fields)


class TestAddCommand:
    async def test_presents_template_select_view(self, monkeypatch):
        templates = [
            {"id": "t1", "name": "コーヒー", "type": "expense", "amount": 500, "use_count": 3},
            {"id": "t2", "name": "給料", "type": "income", "amount": 250000, "use_count": 10},
        ]
        monkeypatch.setattr(bot, "fetch_templates", AsyncMock(return_value=templates))
        interaction = make_interaction()

        await bot.cmd_add.callback(interaction)

        interaction.response.defer.assert_awaited_once()
        interaction.followup.send.assert_awaited_once()
        view = interaction.followup.send.await_args.kwargs["view"]
        assert isinstance(view, bot.TemplateSelectView)
        # followup.send(wait=True) の戻り値が view に紐付けられる
        assert view._message is interaction.followup.send.return_value

    async def test_no_templates_shows_guidance(self, monkeypatch):
        monkeypatch.setattr(bot, "fetch_templates", AsyncMock(return_value=[]))
        interaction = make_interaction()

        await bot.cmd_add.callback(interaction)

        interaction.followup.send.assert_awaited_once()
        embed = interaction.followup.send.await_args.kwargs["embed"]
        assert "テンプレート" in embed.title
        # view は渡されない
        assert "view" not in interaction.followup.send.await_args.kwargs


class TestSummaryCommand:
    async def test_renders_monthly_summary_embed(self, monkeypatch):
        dashboard = {
            "income_total": 100000,
            "expense_total": 50000,
            "balance": 50000,
            "month_over_month": {
                "income_change": 10000,
                "expense_change": -5000,
                "income_change_rate": 11.1,
                "expense_change_rate": -9.0,
            },
            "budget_consumption": [
                {"category_name": "食費", "consumption_rate": 90, "spent_amount": 9000, "budget_amount": 10000},
            ],
            "account_balances": [{"name": "現金", "balance": 30000}],
        }
        monkeypatch.setattr(bot, "fetch_dashboard", AsyncMock(return_value=dashboard))
        interaction = make_interaction()

        await bot.cmd_summary.callback(interaction)

        interaction.response.defer.assert_awaited_once()
        embed = interaction.followup.send.await_args.kwargs["embed"]
        assert "収支サマリー" in embed.title
        text = _field_text(embed)
        assert "¥100,000" in text  # 収入
        assert "¥50,000" in text   # 支出 / 収支
        assert "食費" in text       # 予算消化率
        assert "現金" in text       # 口座残高


class TestHistoryCommand:
    async def test_renders_transactions(self, monkeypatch):
        transactions = [
            {
                "type": "expense",
                "amount": 1500,
                "currency": "JPY",
                "date": "2026-05-20T10:00:00",
                "name": "ランチ",
                "category": {"name": "食費"},
            },
        ]
        monkeypatch.setattr(bot, "fetch_transactions", AsyncMock(return_value=transactions))
        interaction = make_interaction()

        await bot.cmd_history.callback(interaction, count=5)

        interaction.response.defer.assert_awaited_once()
        embed = interaction.followup.send.await_args.kwargs["embed"]
        assert "取引履歴" in embed.title
        field = embed.fields[0]
        assert "2026-05-20" in field.name
        assert "ランチ" in field.name
        assert "支出" in field.value
        assert "¥1,500" in field.value
        assert "食費" in field.value

    async def test_empty_history_shows_placeholder(self, monkeypatch):
        monkeypatch.setattr(bot, "fetch_transactions", AsyncMock(return_value=[]))
        interaction = make_interaction()

        await bot.cmd_history.callback(interaction, count=5)

        embed = interaction.followup.send.await_args.kwargs["embed"]
        assert "登録されていません" in embed.description


class TestQuickCommand:
    async def test_no_categories_posts_directly(self, monkeypatch):
        monkeypatch.setattr(bot, "fetch_categories", AsyncMock(return_value=[]))
        post = AsyncMock()
        monkeypatch.setattr(bot, "post_quick_transaction", post)
        interaction = make_interaction()
        choice = app_commands.Choice(name="支出", value="expense")

        await bot.cmd_quick.callback(interaction, amount=1200, type=choice, memo="昼食")

        interaction.response.defer.assert_awaited_once()
        post.assert_awaited_once()
        # session, type, amount が渡る
        assert post.await_args.args[1] == "expense"
        assert post.await_args.args[2] == 1200
        assert post.await_args.kwargs.get("memo") == "昼食"
        embed = interaction.followup.send.await_args.kwargs["embed"]
        assert "記録しました" in embed.title

    async def test_with_categories_presents_select_view(self, monkeypatch):
        categories = [{"id": "c1", "name": "食費"}, {"id": "c2", "name": "交通費"}]
        monkeypatch.setattr(bot, "fetch_categories", AsyncMock(return_value=categories))
        post = AsyncMock()
        monkeypatch.setattr(bot, "post_quick_transaction", post)
        interaction = make_interaction()
        choice = app_commands.Choice(name="収入", value="income")

        await bot.cmd_quick.callback(interaction, amount=3000, type=choice)

        # カテゴリがある場合は直接 post せず、選択 view を出す
        post.assert_not_awaited()
        view = interaction.followup.send.await_args.kwargs["view"]
        assert isinstance(view, bot.CategorySelectView)


class TestExecuteFlow:
    async def test_execute_posts_and_marks_used(self, monkeypatch):
        post = AsyncMock()
        mark = AsyncMock()
        monkeypatch.setattr(bot, "post_transaction", post)
        monkeypatch.setattr(bot, "mark_template_used", mark)
        interaction = make_interaction()
        template = {"id": "tmpl1", "name": "コーヒー", "type": "expense", "currency": "JPY"}
        session = MagicMock()

        await bot._execute(interaction, session, template, 500)

        post.assert_awaited_once_with(session, template, 500)
        mark.assert_awaited_once_with(session, "tmpl1")
        embed = interaction.followup.send.await_args.kwargs["embed"]
        assert embed.color.value == bot.EMBED_COLOR_EXPENSE

    async def test_execute_reports_api_error(self, monkeypatch):
        import aiohttp

        request_info = MagicMock(real_url="http://test/api/v1/transactions")
        err = aiohttp.ClientResponseError(request_info=request_info, history=(), status=500)
        monkeypatch.setattr(bot, "post_transaction", AsyncMock(side_effect=err))
        monkeypatch.setattr(bot, "mark_template_used", AsyncMock())
        interaction = make_interaction()

        await bot._execute(interaction, MagicMock(), {"id": "t", "type": "expense"}, 500)

        embed = interaction.followup.send.await_args.kwargs["embed"]
        assert embed.title == "❌ エラー"
        assert "500" in embed.description
