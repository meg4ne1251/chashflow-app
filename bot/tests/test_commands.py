"""スラッシュコマンドハンドラの入力検証・権限チェック分岐のテスト。

ネットワークや discord ゲートウェイには接続せず、Interaction をモックして
コマンドの callback を直接呼び出す。
"""
from unittest.mock import AsyncMock, MagicMock

import pytest
from discord import app_commands

import bot


def make_interaction(user_id: int = 1):
    """discord.Interaction の最小モック。"""
    interaction = MagicMock(name="Interaction")
    interaction.user.id = user_id
    interaction.response.send_message = AsyncMock()
    interaction.response.defer = AsyncMock()
    interaction.response.send_modal = AsyncMock()
    interaction.followup.send = AsyncMock()
    return interaction


@pytest.fixture(autouse=True)
def allow_default_user(monkeypatch):
    # make_interaction の既定ユーザー (id=1) を許可ユーザーにしておく。
    monkeypatch.setattr(bot, "ALLOWED_USER_ID", 1)


class TestPermissionChecks:
    @pytest.mark.parametrize("command_name", ["add", "summary", "history", "quick"])
    async def test_blocked_user_is_rejected(self, monkeypatch, command_name):
        monkeypatch.setattr(bot, "ALLOWED_USER_ID", 100)  # only user 100 allowed
        interaction = make_interaction(user_id=999)

        if command_name == "add":
            await bot.cmd_add.callback(interaction)
        elif command_name == "summary":
            await bot.cmd_summary.callback(interaction)
        elif command_name == "history":
            await bot.cmd_history.callback(interaction)
        elif command_name == "quick":
            choice = app_commands.Choice(name="支出", value="expense")
            await bot.cmd_quick.callback(interaction, amount=100, type=choice)

        interaction.response.send_message.assert_awaited_once()
        # 権限エラーメッセージが送られ、defer されない（処理に進まない）
        interaction.response.defer.assert_not_awaited()


class TestQuickValidation:
    async def test_rejects_zero_amount(self):
        interaction = make_interaction()
        choice = app_commands.Choice(name="支出", value="expense")
        await bot.cmd_quick.callback(interaction, amount=0, type=choice)
        interaction.response.send_message.assert_awaited_once()
        interaction.response.defer.assert_not_awaited()

    async def test_rejects_negative_amount(self):
        interaction = make_interaction()
        choice = app_commands.Choice(name="支出", value="expense")
        await bot.cmd_quick.callback(interaction, amount=-50, type=choice)
        interaction.response.send_message.assert_awaited_once()

    async def test_rejects_amount_over_max(self):
        interaction = make_interaction()
        choice = app_commands.Choice(name="収入", value="income")
        await bot.cmd_quick.callback(interaction, amount=bot.MAX_AMOUNT + 1, type=choice)
        interaction.response.send_message.assert_awaited_once()
        interaction.response.defer.assert_not_awaited()

    async def test_accepts_valid_amount_and_defers(self, monkeypatch):
        # カテゴリ取得をスタブし、検証を通過して defer されることを確認
        interaction = make_interaction()
        monkeypatch.setattr(bot, "fetch_categories", AsyncMock(return_value=[]))
        monkeypatch.setattr(bot, "post_quick_transaction", AsyncMock(return_value={}))
        bot.bot.session = MagicMock()  # not None
        choice = app_commands.Choice(name="支出", value="expense")
        await bot.cmd_quick.callback(interaction, amount=1500, type=choice)
        interaction.response.defer.assert_awaited_once()


class TestHistoryValidation:
    async def test_rejects_count_below_min(self):
        interaction = make_interaction()
        await bot.cmd_history.callback(interaction, count=0)
        interaction.response.send_message.assert_awaited_once()
        interaction.response.defer.assert_not_awaited()

    async def test_rejects_count_above_max(self):
        interaction = make_interaction()
        await bot.cmd_history.callback(interaction, count=bot.MAX_HISTORY_COUNT + 1)
        interaction.response.send_message.assert_awaited_once()
        interaction.response.defer.assert_not_awaited()

    async def test_accepts_valid_count_and_defers(self, monkeypatch):
        interaction = make_interaction()
        monkeypatch.setattr(bot, "fetch_transactions", AsyncMock(return_value=[]))
        bot.bot.session = MagicMock()
        await bot.cmd_history.callback(interaction, count=5)
        interaction.response.defer.assert_awaited_once()


class TestAmountModal:
    # NOTE: discord.py の TextInput には公開の値セッターが無いため、内部属性 `_value` を直接
    # 書き換えて送信値をシミュレートしている。requirements.txt で discord.py==2.4.0 に固定して
    # いるため安定しているが、アップグレード時はこの内部 API の変化に注意すること。
    async def test_invalid_amount_text_rejected(self):
        modal = bot.AmountModal({"id": "t", "type": "expense"}, MagicMock())
        modal.amount_input._value = "abc"
        interaction = make_interaction()
        await modal.on_submit(interaction)
        interaction.response.send_message.assert_awaited_once()
        interaction.response.defer.assert_not_awaited()

    async def test_amount_over_max_rejected(self):
        modal = bot.AmountModal({"id": "t", "type": "expense"}, MagicMock())
        modal.amount_input._value = str(bot.MAX_AMOUNT + 1)
        interaction = make_interaction()
        await modal.on_submit(interaction)
        interaction.response.send_message.assert_awaited_once()
        interaction.response.defer.assert_not_awaited()

    async def test_valid_amount_defers_and_executes(self, monkeypatch):
        monkeypatch.setattr(bot, "_execute", AsyncMock())
        modal = bot.AmountModal({"id": "t", "type": "expense"}, MagicMock())
        modal.amount_input._value = "1,500"  # カンマ区切りも許容
        interaction = make_interaction()
        await modal.on_submit(interaction)
        interaction.response.defer.assert_awaited_once()
        bot._execute.assert_awaited_once()
        # カンマ除去後の整数が渡される
        assert bot._execute.await_args.args[-1] == 1500
