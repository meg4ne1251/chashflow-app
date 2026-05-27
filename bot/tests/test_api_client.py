"""API クライアント (_login / _refresh / api_request および各 fetch/post 関数) のテスト。

実 HTTP は発生させず、FakeSession でレスポンスをキューに積む。
"""
import aiohttp
import pytest

import bot
from tests._fakes import FakeResponse, FakeSession


def _cookie(name: str, value: str) -> str:
    return f"{name}={value}; Path=/; HttpOnly"


@pytest.fixture(autouse=True)
def reset_auth():
    """各テストの前後で認証グローバル状態をリセットする。"""
    bot._auth.access_token = None
    bot._auth.refresh_token = None
    yield
    bot._auth.access_token = None
    bot._auth.refresh_token = None


@pytest.fixture
def authed():
    """既にログイン済みの状態にする（initial login をスキップさせる）。"""
    bot._auth.access_token = "existing-access"
    bot._auth.refresh_token = "existing-refresh"


class TestLogin:
    async def test_stores_tokens_from_cookies(self):
        session = FakeSession([
            FakeResponse(status=200, set_cookie=[
                _cookie("access_token", "acc-1"),
                _cookie("refresh_token", "ref-1"),
            ])
        ])
        await bot._login(session)
        assert bot._auth.access_token == "acc-1"
        assert bot._auth.refresh_token == "ref-1"

    async def test_raises_when_tokens_missing(self):
        session = FakeSession([FakeResponse(status=200, set_cookie=[])])
        with pytest.raises(RuntimeError):
            await bot._login(session)

    async def test_propagates_http_error(self):
        session = FakeSession([FakeResponse(status=401)])
        with pytest.raises(aiohttp.ClientResponseError):
            await bot._login(session)


class TestRefresh:
    async def test_sends_cookie_and_origin_headers(self):
        bot._auth.refresh_token = "old-ref"
        session = FakeSession([
            FakeResponse(status=200, set_cookie=[
                _cookie("access_token", "acc-2"),
                _cookie("refresh_token", "ref-2"),
            ])
        ])
        await bot._refresh(session)
        assert bot._auth.access_token == "acc-2"
        assert bot._auth.refresh_token == "ref-2"
        sent = session.calls[0]
        assert "refresh_token=old-ref" in sent["headers"]["Cookie"]
        assert sent["headers"]["Origin"] == bot.API_BASE_URL


class TestApiRequest:
    async def test_logs_in_automatically_when_no_token(self):
        session = FakeSession([
            # 1) initial login
            FakeResponse(status=200, set_cookie=[
                _cookie("access_token", "acc"), _cookie("refresh_token", "ref"),
            ]),
            # 2) the actual request
            FakeResponse(status=200, json_data={"ok": True}),
        ])
        result = await bot.api_request(session, "GET", "/api/v1/ping")
        assert result == {"ok": True}
        assert bot._auth.access_token == "acc"

    async def test_attaches_bearer_token(self, authed):
        session = FakeSession([FakeResponse(status=200, json_data={"x": 1})])
        await bot.api_request(session, "GET", "/api/v1/ping")
        assert session.calls[0]["headers"]["Authorization"] == "Bearer existing-access"
        assert session.calls[0]["url"] == f"{bot.API_BASE_URL}/api/v1/ping"

    async def test_204_returns_empty_dict(self, authed):
        session = FakeSession([FakeResponse(status=204)])
        assert await bot.api_request(session, "POST", "/api/v1/x") == {}

    async def test_401_triggers_refresh_then_retries(self, authed):
        session = FakeSession([
            FakeResponse(status=401),  # first attempt rejected
            FakeResponse(status=200, set_cookie=[  # refresh succeeds
                _cookie("access_token", "acc-new"), _cookie("refresh_token", "ref-new"),
            ]),
            FakeResponse(status=200, json_data={"retried": True}),  # retry succeeds
        ])
        result = await bot.api_request(session, "GET", "/api/v1/x")
        assert result == {"retried": True}
        assert bot._auth.access_token == "acc-new"
        # retry should carry the refreshed token
        assert session.calls[-1]["headers"]["Authorization"] == "Bearer acc-new"

    async def test_401_then_refresh_fails_falls_back_to_login(self, authed):
        session = FakeSession([
            FakeResponse(status=401),                 # first attempt
            FakeResponse(status=401),                 # refresh fails
            FakeResponse(status=200, set_cookie=[     # re-login succeeds
                _cookie("access_token", "acc-relog"), _cookie("refresh_token", "ref-relog"),
            ]),
            FakeResponse(status=200, json_data={"done": True}),  # retry
        ])
        result = await bot.api_request(session, "GET", "/api/v1/x")
        assert result == {"done": True}
        assert bot._auth.access_token == "acc-relog"

    async def test_non_401_error_raises(self, authed):
        session = FakeSession([FakeResponse(status=500)])
        with pytest.raises(aiohttp.ClientResponseError):
            await bot.api_request(session, "GET", "/api/v1/x")


class TestFetchTemplates:
    async def test_returns_list(self, authed):
        session = FakeSession([FakeResponse(status=200, json_data=[{"id": "1"}])])
        assert await bot.fetch_templates(session) == [{"id": "1"}]

    async def test_non_list_response_returns_empty(self, authed):
        session = FakeSession([FakeResponse(status=200, json_data={"unexpected": 1})])
        assert await bot.fetch_templates(session) == []


class TestPostTransaction:
    async def test_builds_payload_with_optional_fields(self, authed):
        session = FakeSession([FakeResponse(status=200, json_data={"id": "tx1"})])
        template = {
            "id": "tmpl1",
            "type": "expense",
            "currency": "JPY",
            "transaction_name": "コーヒー",
            "category_id": "cat1",
            "account_id": "acc1",
            "memo": "朝",
            "tags": [{"id": "tag1"}, {"id": "tag2"}],
        }
        await bot.post_transaction(session, template, 500)
        payload = session.calls[0]["json"]
        assert payload["type"] == "expense"
        assert payload["amount"] == 500
        assert payload["currency"] == "JPY"
        assert payload["name"] == "コーヒー"
        assert payload["category_id"] == "cat1"
        assert payload["account_id"] == "acc1"
        assert payload["memo"] == "朝"
        assert payload["tag_ids"] == ["tag1", "tag2"]
        assert "date" in payload

    async def test_omits_unset_optional_fields(self, authed):
        session = FakeSession([FakeResponse(status=200, json_data={})])
        await bot.post_transaction(session, {"id": "t", "type": "income"}, 1000)
        payload = session.calls[0]["json"]
        assert "category_id" not in payload
        assert "tag_ids" not in payload
        assert "name" not in payload
        assert payload["currency"] == "JPY"  # default


class TestPostQuickTransaction:
    async def test_includes_category_and_memo(self, authed):
        session = FakeSession([FakeResponse(status=200, json_data={})])
        await bot.post_quick_transaction(session, "expense", 1200, category_id="cat9", memo="昼食")
        payload = session.calls[0]["json"]
        assert payload["type"] == "expense"
        assert payload["amount"] == 1200
        assert payload["category_id"] == "cat9"
        assert payload["memo"] == "昼食"

    async def test_omits_category_when_none(self, authed):
        session = FakeSession([FakeResponse(status=200, json_data={})])
        await bot.post_quick_transaction(session, "income", 5000)
        payload = session.calls[0]["json"]
        assert "category_id" not in payload
        assert "memo" not in payload


class TestFetchTransactions:
    async def test_unwraps_paginated_content(self, authed):
        session = FakeSession([
            FakeResponse(status=200, json_data={"content": [{"id": "a"}, {"id": "b"}]})
        ])
        result = await bot.fetch_transactions(session, count=2)
        assert result == [{"id": "a"}, {"id": "b"}]

    async def test_accepts_plain_list(self, authed):
        session = FakeSession([FakeResponse(status=200, json_data=[{"id": "a"}])])
        assert await bot.fetch_transactions(session) == [{"id": "a"}]

    async def test_passes_count_in_query(self, authed):
        session = FakeSession([FakeResponse(status=200, json_data=[])])
        await bot.fetch_transactions(session, count=7)
        assert "size=7" in session.calls[0]["url"]


class TestFetchCategories:
    async def test_adds_type_filter(self, authed):
        session = FakeSession([FakeResponse(status=200, json_data=[])])
        await bot.fetch_categories(session, type_filter="expense")
        assert "type=expense" in session.calls[0]["url"]

    async def test_no_filter_omits_query(self, authed):
        session = FakeSession([FakeResponse(status=200, json_data=[{"id": "c"}])])
        result = await bot.fetch_categories(session)
        assert result == [{"id": "c"}]
        assert "?" not in session.calls[0]["url"]


class TestFetchDashboard:
    async def test_returns_dict(self, authed):
        session = FakeSession([FakeResponse(status=200, json_data={"balance": 100})])
        assert await bot.fetch_dashboard(session) == {"balance": 100}

    async def test_non_dict_returns_empty(self, authed):
        session = FakeSession([FakeResponse(status=200, json_data=[1, 2])])
        assert await bot.fetch_dashboard(session) == {}
