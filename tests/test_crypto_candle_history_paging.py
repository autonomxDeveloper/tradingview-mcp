from __future__ import annotations

from typing import Any

from tradingview_mcp.core.services import crypto_live_service as service


class FakeResponse:
    status_code = 200

    def __init__(self, payload: list[list[Any]]):
        self._payload = payload
        self.text = "[]"

    def json(self) -> list[list[Any]]:
        return self._payload


def row(open_time: int, close: str) -> list[Any]:
    return [open_time, "1", "2", "0.5", close, "10", open_time + 59999]


def test_binance_intraday_candles_page_backwards_and_report_history(monkeypatch):
    calls: list[dict[str, Any]] = []
    pages = [
        [row(3000, "3"), row(4000, "4"), row(5000, "5")],
        [row(1000, "1"), row(2000, "2")],
    ]

    def fake_get(url: str, params: dict[str, Any] | None = None, timeout: float = 15.0) -> FakeResponse:
        assert url.endswith("/api/v3/klines")
        calls.append(dict(params or {}))
        return FakeResponse(pages[len(calls) - 1])

    monkeypatch.setattr(service, "BINANCE_KLINES_PAGE_LIMIT", 3)
    monkeypatch.setattr(service.requests, "get", fake_get)
    monkeypatch.setattr(service, "write_cache", lambda _key, payload, source="": payload)

    payload = service.get_crypto_candles("BTCUSDT", "binance", "1h", 5)

    assert payload["venue"] == "binance"
    assert payload["symbol"] == "BTCUSDT"
    assert payload["limit"] == 5
    assert [bar["open_time"] for bar in payload["bars"]] == [1000, 2000, 3000, 4000, 5000]
    assert payload["history"] == {
        "requested_limit": 5,
        "bars_count": 5,
        "first_open_time": 1000,
        "last_open_time": 5000,
        "history_complete": False,
    }
    assert calls[0] == {"symbol": "BTCUSDT", "interval": "1h", "limit": 3}
    assert calls[1] == {"symbol": "BTCUSDT", "interval": "1h", "limit": 2, "endTime": 2999}


def test_crypto_candle_limit_allows_deeper_daily_history_without_unbounded_requests(monkeypatch):
    monkeypatch.setattr(service, "write_cache", lambda _key, payload, source="": payload)
    monkeypatch.setattr(service.requests, "get", lambda *args, **kwargs: FakeResponse([]))

    payload = service.get_crypto_candles("BTCUSDT", "binance", "1d", 999999)

    assert payload["limit"] == service.MAX_AGGREGATED_CANDLE_LIMIT
    assert payload["history"]["requested_limit"] == service.MAX_AGGREGATED_CANDLE_LIMIT
    assert payload["history"]["history_complete"] is True
