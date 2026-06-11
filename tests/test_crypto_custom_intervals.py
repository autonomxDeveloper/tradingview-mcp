from __future__ import annotations

from tradingview_mcp.core.services.crypto_live_service import _normalize_interval


def test_binance_accepts_tradingview_style_custom_intervals():
    for interval in ["1s", "3m", "2h", "6h", "8h", "12h", "3d"]:
        assert _normalize_interval("binance", interval) == interval


def test_binance_custom_intervals_are_case_insensitive():
    assert _normalize_interval("binance", "3D") == "3d"
    assert _normalize_interval("binance", "1W") == "1w"


def test_unsupported_binance_interval_falls_back_to_hourly():
    assert _normalize_interval("binance", "10m") == "1h"
