"""aiohttp.ClientSession / ClientResponse の最小限のフェイク実装。

bot.py は aiohttp の async context manager (`async with session.request(...) as resp`)
パターンと `resp.headers.getall("Set-Cookie")`、`resp.raise_for_status()`、`await resp.json()`
を使う。実 HTTP を発生させずにこれらを再現する。
"""
from typing import Any, Optional

import aiohttp


class FakeHeaders:
    """CIMultiDict 風。getall(name, default) のみサポートすれば十分。"""

    def __init__(self, set_cookie: Optional[list[str]] = None) -> None:
        self._set_cookie = set_cookie or []

    def getall(self, name: str, default: Any = None) -> list[str]:
        if name == "Set-Cookie":
            return self._set_cookie
        return default if default is not None else []


class FakeResponse:
    """1 回の HTTP レスポンスを模倣する。async context manager として使える。"""

    def __init__(
        self,
        status: int = 200,
        json_data: Any = None,
        set_cookie: Optional[list[str]] = None,
    ) -> None:
        self.status = status
        self._json_data = json_data
        self.headers = FakeHeaders(set_cookie)

    def raise_for_status(self) -> None:
        if self.status >= 400:
            raise aiohttp.ClientResponseError(
                request_info=None,  # type: ignore[arg-type]
                history=(),
                status=self.status,
                message=f"HTTP {self.status}",
            )

    async def json(self) -> Any:
        return self._json_data

    async def __aenter__(self) -> "FakeResponse":
        return self

    async def __aexit__(self, *exc: Any) -> None:
        return None


class FakeSession:
    """キューに積んだ FakeResponse を順に返す aiohttp.ClientSession のフェイク。

    request / post / get のいずれの呼び出しでも、同じキューから次のレスポンスを取り出す。
    呼び出し引数は self.calls に記録される。
    """

    def __init__(self, responses: Optional[list[FakeResponse]] = None) -> None:
        self._responses = list(responses or [])
        self.calls: list[dict] = []

    def queue(self, response: FakeResponse) -> None:
        self._responses.append(response)

    def _next(self, method: str, url: str, **kwargs: Any) -> FakeResponse:
        self.calls.append({"method": method, "url": url, **kwargs})
        if not self._responses:
            raise AssertionError(
                f"FakeSession: レスポンスが枯渇しました (method={method}, url={url})"
            )
        return self._responses.pop(0)

    def request(self, method: str, url: str, **kwargs: Any) -> FakeResponse:
        return self._next(method, url, **kwargs)

    def post(self, url: str, **kwargs: Any) -> FakeResponse:
        return self._next("POST", url, **kwargs)

    def get(self, url: str, **kwargs: Any) -> FakeResponse:
        return self._next("GET", url, **kwargs)
