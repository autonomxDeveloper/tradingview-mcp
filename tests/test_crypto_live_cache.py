from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import requests

from tradingview_mcp.core.services import crypto_live_service


@dataclass
class _FakeResponse:
    status_code: int
    payload: Any
    text: str = ""

    def json(self) -> Any:
        return self.payload


def test_crypto_ticker_includes_cache_metadata(monkeypatch, tmp_path):
    monkeypatch.setenv("TRADING_WORKSTATION_MARKET_CACHE", str(tmp_path / "cache"))

    def fake_get(url, params=None, timeout=None):
        return _FakeResponse(
            200,
            {
                "lastPrice": "100",
                "bidPrice": "99",
                "askPrice": "101",
                "priceChangePercent": "1",
                "volume": "10",
                "quoteVolume": "1000",
            },
        )

    monkeypatch.setattr(crypto_live_service.requests, "get", fake_get)

    result = crypto_live_service.get_crypto_live_ticker("BTCUSDT", "binance")

    assert result["price"] == "100"
    assert result["metadata"]["source"] == "binance_ticker"
    assert result["metadata"]["cache_status"] == "live"
    assert result["metadata"]["stale"] is False


def test_crypto_ticker_falls_back_to_cache(monkeypatch, tmp_path):
    monkeypatch.setenv("TRADING_WORKSTATION_MARKET_CACHE", str(tmp_path / "cache"))

    def good_get(url, params=None, timeout=None):
        return _FakeResponse(
            200,
            {
                "lastPrice": "100",
                "bidPrice": "99",
                "askPrice": "101",
                "priceChangePercent": "1",
                "volume": "10",
                "quoteVolume": "1000",
            },
        )

    monkeypatch.setattr(crypto_live_service.requests, "get", good_get)
    live = crypto_live_service.get_crypto_live_ticker("BTCUSDT", "binance")
    assert live["metadata"]["cache_status"] == "live"

    def failing_get(url, params=None, timeout=None):
        raise requests.RequestException("network down")

    monkeypatch.setattr(crypto_live_service.requests, "get", failing_get)
    fallback = crypto_live_service.get_crypto_live_ticker("BTCUSDT", "binance")

    assert fallback["price"] == "100"
    assert fallback["metadata"]["cache_status"] == "stale"
    assert fallback["metadata"]["stale"] is True
    assert fallback["metadata"]["fallback_error"]["code"] == "REQUEST_FAILED"


def test_crypto_candles_includes_cache_metadata(monkeypatch, tmp_path):
    monkeypatch.setenv("TRADING_WORKSTATION_MARKET_CACHE", str(tmp_path / "cache"))

    def fake_get(url, params=None, timeout=None):
        return _FakeResponse(200, [[1, "10", "11", "9", "10.5", "5", 2]])

    monkeypatch.setattr(crypto_live_service.requests, "get", fake_get)

    result = crypto_live_service.get_crypto_candles("BTCUSDT", "binance", "1h", 1)

    assert result["bars"][0]["close"] == "10.5"
    assert result["metadata"]["source"] == "binance_candles"
    assert result["metadata"]["cache_status"] == "live"
