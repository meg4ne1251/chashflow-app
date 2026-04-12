"""
cashflow-app Discord Bot

/add コマンドでテンプレートを選択し、取引を素早く登録する。
Ktor バックエンド API と aiohttp で通信する。
"""

import asyncio
import logging
import os
import sys
from datetime import datetime, timezone
from typing import Any, Optional

import aiohttp
import discord
from discord import app_commands

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("cashflow-bot")

# ── 定数 ─────────────────────────────────────────────────────────
API_TIMEOUT = aiohttp.ClientTimeout(total=30, connect=10)
MAX_AMOUNT = 999_999_999_999  # 最大金額 (12桁)
INTERACTION_TIMEOUT = 120
MAX_TEMPLATES_IN_SELECT = 25  # Discord Select component limit
MAX_LABEL_LENGTH = 100  # Discord Select option label limit
MAX_DESCRIPTION_LENGTH = 100  # Discord Select option description limit
AMOUNT_INPUT_MAX_LENGTH = 10  # 最大10桁の金額入力

# ── 設定 ─────────────────────────────────────────────────────────
def _get_required_env(key: str) -> str:
    """必須環境変数を取得。未設定の場合はエラー終了"""
    value = os.environ.get(key)
    if not value:
        logger.critical("Required environment variable %s is not set", key)
        sys.exit(1)
    return value

def _get_guild_id() -> int:
    """DISCORD_GUILD_IDを安全にintに変換"""
    raw = _get_required_env("DISCORD_GUILD_ID")
    try:
        return int(raw)
    except ValueError:
        logger.critical("DISCORD_GUILD_ID must be a valid integer: %s", raw)
        sys.exit(1)

DISCORD_BOT_TOKEN = _get_required_env("DISCORD_BOT_TOKEN")
DISCORD_GUILD_ID = _get_guild_id()
API_BASE_URL = os.environ.get("API_BASE_URL", "http://app:8080")
API_USERNAME = _get_required_env("CASHFLOW_USERNAME")
API_PASSWORD = _get_required_env("CASHFLOW_PASSWORD")

# ALLOWED_USER_ID: None = 全員許可、int = 特定ユーザーのみ許可
_allowed_user_raw = os.environ.get("DISCORD_ALLOWED_USER_ID")
if _allowed_user_raw:
    try:
        ALLOWED_USER_ID: Optional[int] = int(_allowed_user_raw)
    except ValueError:
        logger.critical("DISCORD_ALLOWED_USER_ID must be a valid integer: %s", _allowed_user_raw)
        sys.exit(1)
else:
    ALLOWED_USER_ID: Optional[int] = None


# ══════════════════════════════════════════════════════════════════
# 認証状態
# ══════════════════════════════════════════════════════════════════

class _AuthState:
    def __init__(self) -> None:
        self.access_token: Optional[str] = None
        self.refresh_token: Optional[str] = None
        self._lock = asyncio.Lock()


_auth = _AuthState()


# ══════════════════════════════════════════════════════════════════
# API クライアント
# ══════════════════════════════════════════════════════════════════

async def _login(session: aiohttp.ClientSession) -> None:
    url = f"{API_BASE_URL}/api/v1/auth/login"
    async with session.post(
        url,
        json={"username": API_USERNAME, "password": API_PASSWORD},
        timeout=API_TIMEOUT,
    ) as resp:
        resp.raise_for_status()
        data = await resp.json()
    _auth.access_token = data["access_token"]
    _auth.refresh_token = data["refresh_token"]
    logger.info("Logged in to cashflow API")


async def _refresh(session: aiohttp.ClientSession) -> None:
    url = f"{API_BASE_URL}/api/v1/auth/refresh"
    async with session.post(
        url,
        json={"refresh_token": _auth.refresh_token},
        timeout=API_TIMEOUT,
    ) as resp:
        resp.raise_for_status()
        data = await resp.json()
    _auth.access_token = data["access_token"]
    _auth.refresh_token = data["refresh_token"]
    logger.info("Token refreshed")


async def api_request(
    session: aiohttp.ClientSession,
    method: str,
    path: str,
    **kwargs: Any,
) -> dict[str, Any]:
    """
    認証付き API リクエスト。
    401 受信時は refresh → 失敗なら再ログイン → 再試行。
    """
    async with _auth._lock:
        if _auth.access_token is None:
            await _login(session)

    headers = {"Authorization": f"Bearer {_auth.access_token}"}
    url = f"{API_BASE_URL}{path}"

    async with session.request(
        method, url, headers=headers, timeout=API_TIMEOUT, **kwargs
    ) as resp:
        if resp.status != 401:
            resp.raise_for_status()
            if resp.status == 204:
                return {}
            return await resp.json()

    # 401 → refresh or re-login, token再取得後に再チェック
    async with _auth._lock:
        # ロック取得後、既に他のリクエストがトークンを更新している可能性
        try:
            await _refresh(session)
        except aiohttp.ClientResponseError:
            await _login(session)

    headers["Authorization"] = f"Bearer {_auth.access_token}"
    async with session.request(
        method, url, headers=headers, timeout=API_TIMEOUT, **kwargs
    ) as resp:
        resp.raise_for_status()
        if resp.status == 204:
            return {}
        return await resp.json()


async def fetch_templates(session: aiohttp.ClientSession) -> list[dict]:
    return await api_request(session, "GET", "/api/v1/templates")


async def post_transaction(session: aiohttp.ClientSession,
                           template: dict, amount: int) -> dict:
    payload: dict = {
        "type":     template["type"],
        "amount":   amount,
        "currency": template.get("currency", "JPY"),
        "date":     datetime.now(timezone.utc).isoformat(),
    }
    for key in ("category_id", "account_id", "memo"):
        if template.get(key):
            payload[key] = template[key]
    tag_ids = [t["id"] for t in template.get("tags", [])]
    if tag_ids:
        payload["tag_ids"] = tag_ids

    return await api_request(session, "POST", "/api/v1/transactions", json=payload)


async def mark_template_used(session: aiohttp.ClientSession, template_id: str) -> None:
    await api_request(session, "POST", f"/api/v1/templates/{template_id}/use")


# ══════════════════════════════════════════════════════════════════
# ユーティリティ
# ══════════════════════════════════════════════════════════════════

def _fmt_amount(amount: int, currency: str = "JPY") -> str:
    symbol = "¥" if currency == "JPY" else currency
    return f"{symbol}{amount:,}"


def _template_label(t: dict) -> str:
    """テンプレートラベルを生成 (Discord制限により最大100文字)"""
    type_str = "収入" if t.get("type") == "income" else "支出"
    amount_str = _fmt_amount(t["amount"], t.get("currency", "JPY")) if t.get("amount") else "金額未設定"
    name = t.get("name", "不明")
    return f"{name} [{type_str} / {amount_str}]"[:MAX_LABEL_LENGTH]


def _is_allowed(user_id: int) -> bool:
    return ALLOWED_USER_ID is None or user_id == ALLOWED_USER_ID


# ══════════════════════════════════════════════════════════════════
# Discord UI コンポーネント
# ══════════════════════════════════════════════════════════════════

async def _execute(interaction: discord.Interaction,
                   session: aiohttp.ClientSession,
                   template: dict,
                   amount: int) -> None:
    """取引作成 → テンプレート使用カウント更新 → 結果を返答"""
    try:
        await post_transaction(session, template, amount)
        await mark_template_used(session, template["id"])

        currency   = template.get("currency", "JPY")
        type_label = "収入" if template["type"] == "income" else "支出"
        msg = (
            f"記録しました\n"
            f"**{template['name']}** / {type_label} / {_fmt_amount(amount, currency)}"
        )
        if template.get("memo"):
            msg += f"\nメモ: {template['memo']}"

        await interaction.followup.send(msg, ephemeral=True)

    except aiohttp.ClientResponseError as e:
        logger.error("API error: status=%s, message=%s", e.status, str(e))
        await interaction.followup.send(
            f"APIエラーが発生しました (HTTP {e.status})", ephemeral=True
        )
    except Exception:
        logger.exception("Unexpected error during transaction creation")
        await interaction.followup.send(
            "予期しないエラーが発生しました。", ephemeral=True
        )


class AmountModal(discord.ui.Modal, title="金額を入力"):
    amount_input = discord.ui.TextInput(
        label="金額（円）",
        placeholder="例: 1500",
        min_length=1,
        max_length=AMOUNT_INPUT_MAX_LENGTH,
    )

    def __init__(self, template: dict, session: aiohttp.ClientSession) -> None:
        super().__init__()
        self.template = template
        self.session  = session

    async def on_submit(self, interaction: discord.Interaction) -> None:
        raw = self.amount_input.value.strip().replace(",", "").replace("，", "")
        # isdecimal()を使用（isdigit()はUnicode数字も通すため）
        if not raw.isdecimal() or int(raw) <= 0:
            await interaction.response.send_message(
                "金額は正の整数で入力してください。", ephemeral=True
            )
            return
        amount = int(raw)
        if amount > MAX_AMOUNT:
            await interaction.response.send_message(
                f"金額は{MAX_AMOUNT:,}円以下で入力してください。", ephemeral=True
            )
            return
        await interaction.response.defer(ephemeral=True)
        await _execute(interaction, self.session, self.template, amount)


class ConfirmView(discord.ui.View):
    def __init__(self, template: dict, session: aiohttp.ClientSession) -> None:
        super().__init__(timeout=INTERACTION_TIMEOUT)
        self.template = template
        self.session  = session

    @discord.ui.button(label="記録する", style=discord.ButtonStyle.success)
    async def confirm(self, interaction: discord.Interaction,
                      button: discord.ui.Button) -> None:
        if not _is_allowed(interaction.user.id):
            await interaction.response.send_message("権限がありません。", ephemeral=True)
            return
        await interaction.response.defer(ephemeral=True)
        await _execute(interaction, self.session, self.template, self.template["amount"])
        self.stop()

    @discord.ui.button(label="キャンセル", style=discord.ButtonStyle.secondary)
    async def cancel(self, interaction: discord.Interaction,
                     button: discord.ui.Button) -> None:
        if not _is_allowed(interaction.user.id):
            await interaction.response.send_message("権限がありません。", ephemeral=True)
            return
        await interaction.response.edit_message(content="キャンセルしました。", view=None)
        self.stop()


class TemplateSelect(discord.ui.Select):
    def __init__(self, templates: list[dict], session: aiohttp.ClientSession) -> None:
        self._map     = {t["id"]: t for t in templates}
        self.session  = session

        options = [
            discord.SelectOption(
                label=_template_label(t),
                value=t["id"],
                description=(t.get("memo") or "")[:MAX_DESCRIPTION_LENGTH] or None,
            )
            for t in templates[:MAX_TEMPLATES_IN_SELECT]
        ]
        super().__init__(
            placeholder="テンプレートを選択...",
            min_values=1,
            max_values=1,
            options=options,
        )

    async def callback(self, interaction: discord.Interaction) -> None:
        if not _is_allowed(interaction.user.id):
            await interaction.response.send_message("権限がありません。", ephemeral=True)
            return

        # Safe access to selected value
        if not self.values:
            await interaction.response.send_message(
                "テンプレートが選択されていません。", ephemeral=True
            )
            return

        selected_id = self.values[0]
        template = self._map.get(selected_id)
        if not template:
            logger.error("Selected template %s not found in cache", selected_id)
            await interaction.response.send_message(
                "テンプレートが見つかりません。", ephemeral=True
            )
            return

        amount = template.get("amount")

        if amount is not None:
            currency   = template.get("currency", "JPY")
            type_label = "収入" if template.get("type") == "income" else "支出"
            name = template.get("name", "不明")
            msg = (
                f"**{name}** を記録しますか？\n"
                f"{type_label} / {_fmt_amount(amount, currency)}"
            )
            await interaction.response.edit_message(
                content=msg, view=ConfirmView(template, self.session)
            )
        else:
            await interaction.response.send_modal(
                AmountModal(template, self.session)
            )


class TemplateSelectView(discord.ui.View):
    def __init__(self, templates: list[dict], session: aiohttp.ClientSession) -> None:
        super().__init__(timeout=INTERACTION_TIMEOUT)
        self.add_item(TemplateSelect(templates, session))


# ══════════════════════════════════════════════════════════════════
# Bot
# ══════════════════════════════════════════════════════════════════

class CashflowBot(discord.Client):
    def __init__(self) -> None:
        intents = discord.Intents.default()
        super().__init__(intents=intents)
        self.tree    = app_commands.CommandTree(self)
        self.session: Optional[aiohttp.ClientSession] = None
        self._guild  = discord.Object(id=DISCORD_GUILD_ID)

    async def setup_hook(self) -> None:
        self.session = aiohttp.ClientSession()
        try:
            await _login(self.session)
        except Exception as e:
            logger.warning("Initial login failed (will retry on first command): %s", e)

        self.tree.copy_global_to(guild=self._guild)
        await self.tree.sync(guild=self._guild)
        logger.info("Slash commands synced to guild %d", DISCORD_GUILD_ID)

    async def close(self) -> None:
        if self.session:
            await self.session.close()
        await super().close()

    async def on_ready(self) -> None:
        # Write heartbeat file for Docker HEALTHCHECK
        try:
            with open("/tmp/bot_heartbeat", "w") as f:
                f.write(str(datetime.now(timezone.utc).isoformat()))
        except OSError:
            pass
        logger.info("Ready: %s (id=%d)", self.user, self.user.id)


bot = CashflowBot()


@bot.tree.command(
    name="add",
    description="テンプレートから取引を記録します",
    guild=discord.Object(id=DISCORD_GUILD_ID),
)
async def cmd_add(interaction: discord.Interaction) -> None:
    if not _is_allowed(interaction.user.id):
        await interaction.response.send_message(
            "このBotを使用する権限がありません。", ephemeral=True
        )
        return

    await interaction.response.defer(ephemeral=True)

    if bot.session is None:
        await interaction.followup.send(
            "Botの初期化が完了していません。しばらく待ってから再試行してください。",
            ephemeral=True,
        )
        return

    try:
        templates = await fetch_templates(bot.session)
    except Exception:
        logger.exception("Failed to fetch templates")
        await interaction.followup.send(
            "テンプレートの取得に失敗しました。", ephemeral=True
        )
        return

    if not templates:
        await interaction.followup.send(
            "テンプレートが登録されていません。先にWebアプリでテンプレートを作成してください。",
            ephemeral=True,
        )
        return

    # use_count 降順（よく使うものを上位に）
    templates_sorted = sorted(templates, key=lambda t: t.get("use_count", 0), reverse=True)

    await interaction.followup.send(
        "記録するテンプレートを選択してください：",
        view=TemplateSelectView(templates_sorted, bot.session),
        ephemeral=True,
    )


if __name__ == "__main__":
    bot.run(DISCORD_BOT_TOKEN)
