from __future__ import annotations

from typing import Any

from tradingview_mcp.core.services import crypto_live_service


def test_binance_daily_and_weekly_candles_are_promoted_to_full_history(monkeypatch):
    requested: list[tuple[str, str | int, int]] = []

    def fake_payload(symbol: str, interval: str | int, limit: int) -> tuple[list[list[Any]], bool]:
        requested.append((symbol, interval, limit))
        return [[1700000000000, "1", "2", "0.5", "1.5", "100", 1700086399999]], False

    monkeypatch.setattr(crypto_live_service, "_binance_candle_payload", fake_payload)
    monkeypatch.setattr(crypto_live_service, "write_cache", lambda _key, result, source: result)

    daily = crypto_live_service.get_crypto_candles("BTCUSDT", "binance", "1d", 300)
    weekly = crypto_live_service.get_crypto_candles("BTCUSDT", "binance", "1w", 1500)

    assert daily["limit"] == crypto_live_service.MAX_AGGREGATED_CANDLE_LIMIT
    assert daily["history"]["requested_limit"] == crypto_live_service.MAX_AGGREGATED_CANDLE_LIMIT
    assert weekly["limit"] == crypto_live_service.MAX_AGGREGATED_CANDLE_LIMIT
    assert requested == [
        ("BTCUSDT", "1d", crypto_live_service.MAX_AGGREGATED_CANDLE_LIMIT),
        ("BTCUSDT", "1w", crypto_live_service.MAX_AGGREGATED_CANDLE_LIMIT),
    ]


def test_binance_intraday_candle_limit_remains_request_scoped(monkeypatch):
    requested: list[tuple[str, str | int, int]] = []

    def fake_payload(symbol: str, interval: str | int, limit: int) -> tuple[list[list[Any]], bool]:
        requested.append((symbol, interval, limit))
        return [[1700000000000, "1", "2", "0.5", "1.5", "100", 1700003599999]], False

    monkeypatch.setattr(crypto_live_service, "_binance_candle_payload", fake_payload)
    monkeypatch.setattr(crypto_live_service, "write_cache", lambda _key, result, source: result)

    payload = crypto_live_service.get_crypto_candles("BTCUSDT", "binance", "1h", 300)

    assert payload["limit"] == 300
    assert payload["history"]["requested_limit"] == 300
    assert requested == [("BTCUSDT", "1h", 300)]
