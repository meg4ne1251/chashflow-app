"""
cashflow-app Discord Bot

/add   – テンプレートを選択し、取引を素早く登録する。
/summary – 今月の収支サマリーを表示する。
/history – 直近の取引履歴を表示する。
/quick – カテゴリと金額を指定して素早く取引を登録する。

Ktor バックエンド API と aiohttp で通信する。
"""

import asyncio
import logging
import os
import sys
from datetime import datetime, timezone, timedelta
from http.cookies import SimpleCookie
from typing import Any, Optional, Union

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
MAX_HISTORY_COUNT = 25  # /history の最大表示件数
EMBED_COLOR_INCOME = 0x2ECC71  # 収入 – 緑
EMBED_COLOR_EXPENSE = 0xE74C3C  # 支出 – 赤
EMBED_COLOR_INFO = 0x3498DB  # 情報 – 青
EMBED_COLOR_SUCCESS = 0x27AE60  # 成功 – 濃い緑
EMBED_COLOR_ERROR = 0xE74C3C  # エラー – 赤
EMBED_COLOR_WARN = 0xF39C12  # 警告 – オレンジ

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


def _extract_cookie_value(response: aiohttp.ClientResponse, cookie_name: str) -> Optional[str]:
    """
    aiohttp レスポンスの Set-Cookie ヘッダーから指定名の cookie 値を抽出する。
    aiohttp の response.cookies は path 付き cookie を正しく扱えない場合があるため、
    raw ヘッダーを直接パースする。
    """
    for header_value in response.headers.getall("Set-Cookie", []):
        cookie = SimpleCookie()
        try:
            cookie.load(header_value)
        except Exception:
            continue
        if cookie_name in cookie:
            return cookie[cookie_name].value
    return None


# ══════════════════════════════════════════════════════════════════
# API クライアント
# ══════════════════════════════════════════════════════════════════

async def _login(session: aiohttp.ClientSession) -> None:
    """
    ログインしてトークンを取得する。
    バックエンドはCookieベース認証に移行済みのため、
    Set-Cookieヘッダーからトークンを抽出する。
    """
    url = f"{API_BASE_URL}/api/v1/auth/login"
    async with session.post(
        url,
        json={"username": API_USERNAME, "password": API_PASSWORD},
        timeout=API_TIMEOUT,
    ) as resp:
        resp.raise_for_status()
        access = _extract_cookie_value(resp, "access_token")
        refresh = _extract_cookie_value(resp, "refresh_token")
        if not access or not refresh:
            raise RuntimeError(
                "Login succeeded but tokens not found in Set-Cookie headers. "
                "Ensure the backend auth API sets httpOnly cookies."
            )
        _auth.access_token = access
        _auth.refresh_token = refresh
    logger.info("Logged in to cashflow API")


async def _refresh(session: aiohttp.ClientSession) -> None:
    """
    リフレッシュトークンで新しいトークンペアを取得する。
    バックエンドはCookieからrefresh_tokenを読み取り、Origin検証を行うため、
    Cookie送信 + Originヘッダーを付与する。
    """
    url = f"{API_BASE_URL}/api/v1/auth/refresh"
    headers = {
        "Cookie": f"refresh_token={_auth.refresh_token}",
        "Origin": API_BASE_URL,
    }
    async with session.post(
        url,
        headers=headers,
        timeout=API_TIMEOUT,
    ) as resp:
        resp.raise_for_status()
        access = _extract_cookie_value(resp, "access_token")
        refresh = _extract_cookie_value(resp, "refresh_token")
        if not access or not refresh:
            raise RuntimeError(
                "Token refresh succeeded but tokens not found in Set-Cookie headers."
            )
        _auth.access_token = access
        _auth.refresh_token = refresh
    logger.info("Token refreshed")


async def api_request(
    session: aiohttp.ClientSession,
    method: str,
    path: str,
    **kwargs: Any,
) -> Union[dict[str, Any], list[Any]]:
    """
    認証付き API リクエスト。
    401 受信時は refresh → 失敗なら再ログイン → 再試行。
    """
    async with _auth._lock:
        if _auth.access_token is None:
            await _login(session)

    headers = kwargs.pop("headers", {})
    headers["Authorization"] = f"Bearer {_auth.access_token}"
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
        except (aiohttp.ClientResponseError, RuntimeError):
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
    result = await api_request(session, "GET", "/api/v1/templates")
    return result if isinstance(result, list) else []


async def post_transaction(session: aiohttp.ClientSession,
                           template: dict, amount: int) -> dict:
    payload: dict = {
        "type":     template["type"],
        "amount":   amount,
        "currency": template.get("currency", "JPY"),
        "date":     datetime.now(timezone.utc).isoformat(),
    }
    # テンプレートの transaction_name があればトランザクション名として使用
    if template.get("transaction_name"):
        payload["name"] = template["transaction_name"]
    for key in ("category_id", "account_id", "memo"):
        if template.get(key):
            payload[key] = template[key]
    tag_ids = [t["id"] for t in template.get("tags", [])]
    if tag_ids:
        payload["tag_ids"] = tag_ids

    result = await api_request(session, "POST", "/api/v1/transactions", json=payload)
    return result if isinstance(result, dict) else {}


async def post_quick_transaction(session: aiohttp.ClientSession,
                                 type_str: str,
                                 amount: int,
                                 category_id: Optional[str] = None,
                                 memo: Optional[str] = None) -> dict:
    """テンプレートなしで直接取引を作成する"""
    payload: dict = {
        "type":     type_str,
        "amount":   amount,
        "currency": "JPY",
        "date":     datetime.now(timezone.utc).isoformat(),
    }
    if category_id:
        payload["category_id"] = category_id
    if memo:
        payload["memo"] = memo

    result = await api_request(session, "POST", "/api/v1/transactions", json=payload)
    return result if isinstance(result, dict) else {}


async def mark_template_used(session: aiohttp.ClientSession, template_id: str) -> None:
    await api_request(session, "POST", f"/api/v1/templates/{template_id}/use")


async def fetch_dashboard(session: aiohttp.ClientSession) -> dict:
    result = await api_request(session, "GET", "/api/v1/analytics/dashboard")
    return result if isinstance(result, dict) else {}


async def fetch_transactions(session: aiohttp.ClientSession,
                             count: int = 5) -> list[dict]:
    # sort は API 規約どおり "<field>,<dir>" 形式で送る（Web フロントと同一）。
    # "date_desc" でも現状は else 分岐で日付降順になるが、将来 sort 値が厳格化されると
    # 壊れるため正規形式に揃えておく。
    result = await api_request(
        session, "GET",
        f"/api/v1/transactions?size={count}&sort=date,desc"
    )
    # ページネーションされたレスポンスの場合、content フィールドを取得
    if isinstance(result, dict):
        return result.get("content", result.get("data", []))
    return result if isinstance(result, list) else []


async def fetch_categories(session: aiohttp.ClientSession,
                           type_filter: Optional[str] = None) -> list[dict]:
    path = "/api/v1/categories"
    if type_filter:
        path += f"?type={type_filter}"
    result = await api_request(session, "GET", path)
    return result if isinstance(result, list) else []


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


def _make_success_embed(template: dict, amount: int) -> discord.Embed:
    """取引成功時のEmbed作成"""
    currency = template.get("currency", "JPY")
    is_income = template["type"] == "income"
    type_label = "収入" if is_income else "支出"
    color = EMBED_COLOR_INCOME if is_income else EMBED_COLOR_EXPENSE

    embed = discord.Embed(
        title="✅ 取引を記録しました",
        color=color,
        timestamp=datetime.now(timezone.utc),
    )
    embed.add_field(name="テンプレート", value=template.get("name", "不明"), inline=True)
    embed.add_field(name="種別", value=type_label, inline=True)
    embed.add_field(name="金額", value=_fmt_amount(amount, currency), inline=True)

    if template.get("memo"):
        embed.add_field(name="メモ", value=template["memo"], inline=False)

    tags = template.get("tags", [])
    if tags:
        tag_names = ", ".join(t.get("name", "") for t in tags if t.get("name"))
        if tag_names:
            embed.add_field(name="タグ", value=tag_names, inline=False)

    embed.set_footer(text="cashflow-app")
    return embed


def _make_error_embed(message: str) -> discord.Embed:
    """エラーEmbed作成"""
    return discord.Embed(
        title="❌ エラー",
        description=message,
        color=EMBED_COLOR_ERROR,
    )


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
    except aiohttp.ClientResponseError as e:
        logger.error("API error: status=%s, message=%s", e.status, str(e))
        embed = _make_error_embed(f"APIエラーが発生しました (HTTP {e.status})")
        await interaction.followup.send(embed=embed, ephemeral=True)
        return
    except Exception:
        logger.exception("Unexpected error during transaction creation")
        embed = _make_error_embed("予期しないエラーが発生しました。")
        await interaction.followup.send(embed=embed, ephemeral=True)
        return

    # 使用回数の更新は付随的な処理。ここで失敗しても取引登録自体は成功しているため、
    # ユーザーにエラーを見せると「失敗したと思って再登録 → 二重計上」を招く。
    # 失敗はログのみに留め、成功 Embed を返す。
    try:
        await mark_template_used(session, template["id"])
    except Exception:
        logger.warning("Failed to mark template %s as used", template.get("id"))

    embed = _make_success_embed(template, amount)
    await interaction.followup.send(embed=embed, ephemeral=True)


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
            embed = _make_error_embed("金額は正の整数で入力してください。")
            await interaction.response.send_message(embed=embed, ephemeral=True)
            return
        amount = int(raw)
        if amount > MAX_AMOUNT:
            embed = _make_error_embed(f"金額は{MAX_AMOUNT:,}円以下で入力してください。")
            await interaction.response.send_message(embed=embed, ephemeral=True)
            return
        await interaction.response.defer(ephemeral=True)
        await _execute(interaction, self.session, self.template, amount)

    async def on_error(self, interaction: discord.Interaction, error: Exception) -> None:
        logger.exception("Error in AmountModal: %s", error)
        try:
            embed = _make_error_embed("金額の処理中にエラーが発生しました。")
            if interaction.response.is_done():
                await interaction.followup.send(embed=embed, ephemeral=True)
            else:
                await interaction.response.send_message(embed=embed, ephemeral=True)
        except Exception:
            logger.exception("Failed to send error response in AmountModal")


class ChangeAmountModal(discord.ui.Modal, title="金額を変更"):
    """テンプレートのデフォルト金額を上書きして記録するためのモーダル"""
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
        # デフォルト値としてテンプレートの金額を入れる
        if template.get("amount"):
            self.amount_input.default = str(template["amount"])

    async def on_submit(self, interaction: discord.Interaction) -> None:
        raw = self.amount_input.value.strip().replace(",", "").replace("，", "")
        if not raw.isdecimal() or int(raw) <= 0:
            embed = _make_error_embed("金額は正の整数で入力してください。")
            await interaction.response.send_message(embed=embed, ephemeral=True)
            return
        amount = int(raw)
        if amount > MAX_AMOUNT:
            embed = _make_error_embed(f"金額は{MAX_AMOUNT:,}円以下で入力してください。")
            await interaction.response.send_message(embed=embed, ephemeral=True)
            return
        await interaction.response.defer(ephemeral=True)
        await _execute(interaction, self.session, self.template, amount)

    async def on_error(self, interaction: discord.Interaction, error: Exception) -> None:
        logger.exception("Error in ChangeAmountModal: %s", error)
        try:
            embed = _make_error_embed("金額の処理中にエラーが発生しました。")
            if interaction.response.is_done():
                await interaction.followup.send(embed=embed, ephemeral=True)
            else:
                await interaction.response.send_message(embed=embed, ephemeral=True)
        except Exception:
            logger.exception("Failed to send error response in ChangeAmountModal")


class ConfirmView(discord.ui.View):
    def __init__(self, template: dict, session: aiohttp.ClientSession) -> None:
        super().__init__(timeout=INTERACTION_TIMEOUT)
        self.template = template
        self.session  = session
        self._message: Optional[discord.Message] = None

    def set_message(self, message: discord.Message) -> None:
        self._message = message

    @discord.ui.button(label="記録する", style=discord.ButtonStyle.success, emoji="✅")
    async def confirm(self, interaction: discord.Interaction,
                      button: discord.ui.Button) -> None:
        if not _is_allowed(interaction.user.id):
            await interaction.response.send_message("権限がありません。", ephemeral=True)
            return
        await interaction.response.defer(ephemeral=True)
        await _execute(interaction, self.session, self.template, self.template["amount"])
        self.stop()

    @discord.ui.button(label="金額を変更", style=discord.ButtonStyle.primary, emoji="✏️")
    async def change_amount(self, interaction: discord.Interaction,
                            button: discord.ui.Button) -> None:
        if not _is_allowed(interaction.user.id):
            await interaction.response.send_message("権限がありません。", ephemeral=True)
            return
        await interaction.response.send_modal(
            ChangeAmountModal(self.template, self.session)
        )

    @discord.ui.button(label="キャンセル", style=discord.ButtonStyle.secondary, emoji="✖️")
    async def cancel(self, interaction: discord.Interaction,
                     button: discord.ui.Button) -> None:
        if not _is_allowed(interaction.user.id):
            await interaction.response.send_message("権限がありません。", ephemeral=True)
            return
        await interaction.response.edit_message(content="キャンセルしました。", view=None, embed=None)
        self.stop()

    async def on_timeout(self) -> None:
        """タイムアウト時にボタンを無効化してメッセージを更新する"""
        try:
            if self._message:
                for item in self.children:
                    if isinstance(item, discord.ui.Button):
                        item.disabled = True
                await self._message.edit(
                    content="⏰ タイムアウトしました。再度 `/add` を実行してください。",
                    view=self,
                )
        except Exception:
            logger.debug("Failed to update timed-out ConfirmView message")


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

            embed = discord.Embed(
                title="取引の確認",
                description=f"**{name}** を記録しますか？",
                color=EMBED_COLOR_INFO,
            )
            embed.add_field(name="種別", value=type_label, inline=True)
            embed.add_field(name="金額", value=_fmt_amount(amount, currency), inline=True)
            if template.get("memo"):
                embed.add_field(name="メモ", value=template["memo"], inline=False)

            view = ConfirmView(template, self.session)
            await interaction.response.edit_message(
                content=None, embed=embed, view=view
            )
            # followup経由で取得したメッセージにset_messageする
            try:
                msg = await interaction.original_response()
                view.set_message(msg)
            except Exception:
                pass
        else:
            await interaction.response.send_modal(
                AmountModal(template, self.session)
            )


class TemplateSelectView(discord.ui.View):
    def __init__(self, templates: list[dict], session: aiohttp.ClientSession) -> None:
        super().__init__(timeout=INTERACTION_TIMEOUT)
        self.add_item(TemplateSelect(templates, session))
        self._message: Optional[discord.Message] = None

    def set_message(self, message: discord.Message) -> None:
        self._message = message

    async def on_timeout(self) -> None:
        """タイムアウト時にセレクトメニューを無効化する"""
        try:
            if self._message:
                for item in self.children:
                    item.disabled = True
                await self._message.edit(
                    content="⏰ タイムアウトしました。再度 `/add` を実行してください。",
                    view=self,
                )
        except Exception:
            logger.debug("Failed to update timed-out TemplateSelectView message")


# ══════════════════════════════════════════════════════════════════
# カテゴリ選択UI (/quick コマンド用)
# ══════════════════════════════════════════════════════════════════

class CategorySelect(discord.ui.Select):
    def __init__(self, categories: list[dict], type_str: str,
                 amount: int, memo: Optional[str],
                 session: aiohttp.ClientSession) -> None:
        self._map = {c["id"]: c for c in categories}
        self.type_str = type_str
        self.amount = amount
        self.memo = memo
        self.session = session

        options = [
            discord.SelectOption(
                label=c.get("name", "不明")[:MAX_LABEL_LENGTH],
                value=c["id"],
            )
            for c in categories[:MAX_TEMPLATES_IN_SELECT]
        ]
        super().__init__(
            placeholder="カテゴリを選択...",
            min_values=1,
            max_values=1,
            options=options,
        )

    async def callback(self, interaction: discord.Interaction) -> None:
        if not _is_allowed(interaction.user.id):
            await interaction.response.send_message("権限がありません。", ephemeral=True)
            return

        if not self.values:
            await interaction.response.send_message(
                "カテゴリが選択されていません。", ephemeral=True
            )
            return

        category_id = self.values[0]
        category = self._map.get(category_id)
        category_name = category.get("name", "不明") if category else "不明"

        await interaction.response.defer(ephemeral=True)

        try:
            await post_quick_transaction(
                self.session, self.type_str, self.amount,
                category_id=category_id, memo=self.memo
            )

            is_income = self.type_str == "income"
            type_label = "収入" if is_income else "支出"
            color = EMBED_COLOR_INCOME if is_income else EMBED_COLOR_EXPENSE

            embed = discord.Embed(
                title="✅ 取引を記録しました",
                color=color,
                timestamp=datetime.now(timezone.utc),
            )
            embed.add_field(name="種別", value=type_label, inline=True)
            embed.add_field(name="金額", value=_fmt_amount(self.amount), inline=True)
            embed.add_field(name="カテゴリ", value=category_name, inline=True)
            if self.memo:
                embed.add_field(name="メモ", value=self.memo, inline=False)
            embed.set_footer(text="cashflow-app")

            await interaction.followup.send(embed=embed, ephemeral=True)

        except aiohttp.ClientResponseError as e:
            logger.error("API error: status=%s, message=%s", e.status, str(e))
            embed = _make_error_embed(f"APIエラーが発生しました (HTTP {e.status})")
            await interaction.followup.send(embed=embed, ephemeral=True)
        except Exception:
            logger.exception("Unexpected error during quick transaction")
            embed = _make_error_embed("予期しないエラーが発生しました。")
            await interaction.followup.send(embed=embed, ephemeral=True)


class CategorySelectView(discord.ui.View):
    def __init__(self, categories: list[dict], type_str: str,
                 amount: int, memo: Optional[str],
                 session: aiohttp.ClientSession) -> None:
        super().__init__(timeout=INTERACTION_TIMEOUT)
        self.add_item(CategorySelect(categories, type_str, amount, memo, session))

    async def on_timeout(self) -> None:
        try:
            for item in self.children:
                item.disabled = True
        except Exception:
            pass


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
        # Use /app/.heartbeat instead of /tmp to avoid symlink attacks in shared directories
        try:
            with open("/app/.heartbeat", "w") as f:
                f.write(str(datetime.now(timezone.utc).isoformat()))
        except OSError:
            pass
        logger.info("Ready: %s (id=%d)", self.user, self.user.id)


bot = CashflowBot()


# ── /add コマンド ─────────────────────────────────────────────────

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
        embed = _make_error_embed("Botの初期化が完了していません。しばらく待ってから再試行してください。")
        await interaction.followup.send(embed=embed, ephemeral=True)
        return

    try:
        templates = await fetch_templates(bot.session)
    except Exception:
        logger.exception("Failed to fetch templates")
        embed = _make_error_embed("テンプレートの取得に失敗しました。")
        await interaction.followup.send(embed=embed, ephemeral=True)
        return

    if not templates:
        embed = discord.Embed(
            title="📝 テンプレートが未登録です",
            description="先にWebアプリでテンプレートを作成してください。",
            color=EMBED_COLOR_WARN,
        )
        await interaction.followup.send(embed=embed, ephemeral=True)
        return

    # use_count 降順（よく使うものを上位に）
    templates_sorted = sorted(templates, key=lambda t: t.get("use_count", 0), reverse=True)

    total = len(templates_sorted)
    content = "記録するテンプレートを選択してください："
    if total > MAX_TEMPLATES_IN_SELECT:
        content += f"\n⚠️ テンプレートが{total}件ありますが、上位{MAX_TEMPLATES_IN_SELECT}件のみ表示しています。"

    view = TemplateSelectView(templates_sorted, bot.session)
    msg = await interaction.followup.send(
        content,
        view=view,
        ephemeral=True,
        wait=True,
    )
    view.set_message(msg)


# ── /summary コマンド ─────────────────────────────────────────────

@bot.tree.command(
    name="summary",
    description="今月の収支サマリーを表示します",
    guild=discord.Object(id=DISCORD_GUILD_ID),
)
async def cmd_summary(interaction: discord.Interaction) -> None:
    if not _is_allowed(interaction.user.id):
        await interaction.response.send_message(
            "このBotを使用する権限がありません。", ephemeral=True
        )
        return

    await interaction.response.defer(ephemeral=True)

    if bot.session is None:
        embed = _make_error_embed("Botの初期化が完了していません。")
        await interaction.followup.send(embed=embed, ephemeral=True)
        return

    try:
        dashboard = await fetch_dashboard(bot.session)
    except Exception:
        logger.exception("Failed to fetch dashboard")
        embed = _make_error_embed("ダッシュボード情報の取得に失敗しました。")
        await interaction.followup.send(embed=embed, ephemeral=True)
        return

    income = dashboard.get("income_total", 0)
    expense = dashboard.get("expense_total", 0)
    balance = dashboard.get("balance", 0)
    mom = dashboard.get("month_over_month", {})

    now = datetime.now(timezone.utc)
    month_str = f"{now.year}年{now.month}月"

    embed = discord.Embed(
        title=f"📊 {month_str}の収支サマリー",
        color=EMBED_COLOR_INFO,
        timestamp=now,
    )

    # 収支概要
    balance_emoji = "📈" if balance >= 0 else "📉"
    embed.add_field(
        name="💰 収入",
        value=f"```\n{_fmt_amount(income)}\n```",
        inline=True,
    )
    embed.add_field(
        name="💸 支出",
        value=f"```\n{_fmt_amount(expense)}\n```",
        inline=True,
    )
    embed.add_field(
        name=f"{balance_emoji} 収支",
        value=f"```\n{_fmt_amount(balance)}\n```",
        inline=True,
    )

    # 前月比
    income_change = mom.get("income_change", 0)
    expense_change = mom.get("expense_change", 0)
    income_rate = mom.get("income_change_rate")
    expense_rate = mom.get("expense_change_rate")

    def _fmt_change(change: int, rate: Optional[float]) -> str:
        sign = "+" if change >= 0 else ""
        rate_str = f" ({sign}{rate:.1f}%)" if rate is not None else ""
        return f"{sign}{_fmt_amount(change)}{rate_str}"

    mom_text = (
        f"収入: {_fmt_change(income_change, income_rate)}\n"
        f"支出: {_fmt_change(expense_change, expense_rate)}"
    )
    embed.add_field(name="📅 前月比", value=mom_text, inline=False)

    # 予算消化率（上位3件）
    budgets = dashboard.get("budget_consumption", [])
    if budgets:
        budget_lines = []
        for b in sorted(budgets, key=lambda x: x.get("consumption_rate", 0), reverse=True)[:3]:
            rate = b.get("consumption_rate", 0)
            name = b.get("category_name", "不明")
            spent = b.get("spent_amount", 0)
            total_budget = b.get("budget_amount", 0)
            bar = _progress_bar(rate)
            budget_lines.append(
                f"{name}: {bar} {rate:.0f}% ({_fmt_amount(spent)}/{_fmt_amount(total_budget)})"
            )
        embed.add_field(
            name="📋 予算消化率 (上位3件)",
            value="\n".join(budget_lines),
            inline=False,
        )

    # 口座残高
    accounts = dashboard.get("account_balances", [])
    if accounts:
        acc_lines = []
        for a in accounts[:5]:
            name = a.get("name", "不明")
            bal = a.get("balance", 0)
            acc_lines.append(f"• {name}: {_fmt_amount(bal)}")
        embed.add_field(
            name="🏦 口座残高",
            value="\n".join(acc_lines),
            inline=False,
        )

    embed.set_footer(text="cashflow-app")
    await interaction.followup.send(embed=embed, ephemeral=True)


def _progress_bar(rate: float, length: int = 10) -> str:
    """プログレスバーを生成"""
    filled = min(int(rate / 100 * length), length)
    empty = length - filled
    if rate >= 100:
        return "🟥" * length
    elif rate >= 80:
        return "🟧" * filled + "⬜" * empty
    else:
        return "🟩" * filled + "⬜" * empty


# ── /history コマンド ─────────────────────────────────────────────

@bot.tree.command(
    name="history",
    description="直近の取引履歴を表示します",
    guild=discord.Object(id=DISCORD_GUILD_ID),
)
@app_commands.describe(count="表示件数 (1-25, デフォルト: 5)")
async def cmd_history(interaction: discord.Interaction, count: int = 5) -> None:
    if not _is_allowed(interaction.user.id):
        await interaction.response.send_message(
            "このBotを使用する権限がありません。", ephemeral=True
        )
        return

    if count < 1 or count > MAX_HISTORY_COUNT:
        embed = _make_error_embed(f"件数は1〜{MAX_HISTORY_COUNT}の範囲で指定してください。")
        await interaction.response.send_message(embed=embed, ephemeral=True)
        return

    await interaction.response.defer(ephemeral=True)

    if bot.session is None:
        embed = _make_error_embed("Botの初期化が完了していません。")
        await interaction.followup.send(embed=embed, ephemeral=True)
        return

    try:
        transactions = await fetch_transactions(bot.session, count)
    except Exception:
        logger.exception("Failed to fetch transactions")
        embed = _make_error_embed("取引履歴の取得に失敗しました。")
        await interaction.followup.send(embed=embed, ephemeral=True)
        return

    if not transactions:
        embed = discord.Embed(
            title="📜 取引履歴",
            description="取引が登録されていません。",
            color=EMBED_COLOR_WARN,
        )
        await interaction.followup.send(embed=embed, ephemeral=True)
        return

    embed = discord.Embed(
        title=f"📜 直近{len(transactions)}件の取引履歴",
        color=EMBED_COLOR_INFO,
        timestamp=datetime.now(timezone.utc),
    )

    for tx in transactions:
        is_income = tx.get("type") == "income"
        emoji = "📈" if is_income else "📉"
        type_label = "収入" if is_income else "支出"
        amount = tx.get("amount", 0)
        currency = tx.get("currency", "JPY")
        date_str = tx.get("date", "")[:10]  # YYYY-MM-DD部分のみ

        # カテゴリ名の取得（nested objectまたはフラット）
        category = tx.get("category", {})
        category_name = category.get("name", "") if isinstance(category, dict) else ""

        # 取引名またはメモ
        name = tx.get("name") or tx.get("memo") or category_name or "（メモなし）"

        field_value = (
            f"{type_label} | {_fmt_amount(amount, currency)}"
        )
        if category_name:
            field_value += f" | {category_name}"

        embed.add_field(
            name=f"{emoji} {date_str} — {name[:50]}",
            value=field_value,
            inline=False,
        )

    embed.set_footer(text="cashflow-app")
    await interaction.followup.send(embed=embed, ephemeral=True)


# ── /quick コマンド ───────────────────────────────────────────────

@bot.tree.command(
    name="quick",
    description="カテゴリと金額を指定して素早く支出/収入を記録します",
    guild=discord.Object(id=DISCORD_GUILD_ID),
)
@app_commands.describe(
    amount="金額（円）",
    type="種別",
    memo="メモ（任意）",
)
@app_commands.choices(type=[
    app_commands.Choice(name="支出", value="expense"),
    app_commands.Choice(name="収入", value="income"),
])
async def cmd_quick(
    interaction: discord.Interaction,
    amount: int,
    type: app_commands.Choice[str],
    memo: Optional[str] = None,
) -> None:
    if not _is_allowed(interaction.user.id):
        await interaction.response.send_message(
            "このBotを使用する権限がありません。", ephemeral=True
        )
        return

    if amount <= 0 or amount > MAX_AMOUNT:
        embed = _make_error_embed(f"金額は1〜{MAX_AMOUNT:,}の範囲で指定してください。")
        await interaction.response.send_message(embed=embed, ephemeral=True)
        return

    await interaction.response.defer(ephemeral=True)

    if bot.session is None:
        embed = _make_error_embed("Botの初期化が完了していません。")
        await interaction.followup.send(embed=embed, ephemeral=True)
        return

    type_str = type.value

    # カテゴリを取得して選択させる
    try:
        categories = await fetch_categories(bot.session, type_filter=type_str)
    except Exception:
        logger.exception("Failed to fetch categories")
        embed = _make_error_embed("カテゴリの取得に失敗しました。")
        await interaction.followup.send(embed=embed, ephemeral=True)
        return

    if not categories:
        # カテゴリなしで直接登録
        try:
            await post_quick_transaction(bot.session, type_str, amount, memo=memo)
            is_income = type_str == "income"
            color = EMBED_COLOR_INCOME if is_income else EMBED_COLOR_EXPENSE
            embed = discord.Embed(
                title="✅ 取引を記録しました",
                color=color,
                timestamp=datetime.now(timezone.utc),
            )
            embed.add_field(name="種別", value="収入" if is_income else "支出", inline=True)
            embed.add_field(name="金額", value=_fmt_amount(amount), inline=True)
            if memo:
                embed.add_field(name="メモ", value=memo, inline=False)
            embed.set_footer(text="cashflow-app")
            await interaction.followup.send(embed=embed, ephemeral=True)
        except aiohttp.ClientResponseError as e:
            embed = _make_error_embed(f"APIエラーが発生しました (HTTP {e.status})")
            await interaction.followup.send(embed=embed, ephemeral=True)
        except Exception:
            logger.exception("Unexpected error during quick transaction")
            embed = _make_error_embed("予期しないエラーが発生しました。")
            await interaction.followup.send(embed=embed, ephemeral=True)
        return

    type_label = "収入" if type_str == "income" else "支出"
    content = f"**{type_label} {_fmt_amount(amount)}** のカテゴリを選択してください："

    view = CategorySelectView(categories, type_str, amount, memo, bot.session)
    await interaction.followup.send(
        content,
        view=view,
        ephemeral=True,
    )


if __name__ == "__main__":
    bot.run(DISCORD_BOT_TOKEN)
