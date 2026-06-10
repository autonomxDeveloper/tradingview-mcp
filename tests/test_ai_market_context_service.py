from __future__ import annotations

from tradingview_mcp.core.services.ai_market_context_service import (
    build_multi_timeframe_market_context,
    normalize_candles,
    summarize_candles,
)


def sample_candles(count: int = 60, start: float = 100.0, step: float = 1.0):
    rows = []
    for index in range(count):
        close = start + index * step
        rows.append(
            {
                "time": 1_700_000_000 + index * 60,
                "open": close - 0.5,
                "high": close + 1,
                "low": close - 1,
                "close": close,
                "volume": 1000 + index,
            }
        )
    return rows


def test_normalize_candles_accepts_stock_candles_and_crypto_bars():
    stock = normalize_candles({"candles": [{"time": "1", "open": "1", "high": "2", "low": "0.5", "close": "1.5", "volume": "10"}]})
    crypto = normalize_candles({"bars": [{"open_time": "2", "open": "3", "high": "4", "low": "2", "close": "3.5", "volume": "20"}]})

    assert stock == [{"time": 1, "open": 1.0, "high": 2.0, "low": 0.5, "close": 1.5, "volume": 10.0}]
    assert crypto == [{"time": 2, "open": 3.0, "high": 4.0, "low": 2.0, "close": 3.5, "volume": 20.0}]


def test_summarize_candles_returns_compact_features():
    summary = summarize_candles(sample_candles(), timeframe="1h", source="unit")

    assert summary["timeframe"] == "1h"
    assert summary["source"] == "unit"
    assert summary["candle_count"] == 60
    assert summary["latest"]["close"] == 159.0
    assert summary["trend"] == "uptrend"
    assert summary["momentum"] in {"bullish", "overbought"}
    assert summary["indicators"]["sma20"] is not None
    assert summary["indicators"]["sma50"] is not None
    assert summary["indicators"]["ema21"] is not None
    assert summary["indicators"]["rsi14"] is not None
    assert summary["indicators"]["atr14"] is not None
    assert summary["levels"]["recent_high_20"] == 160.0
    assert summary["levels"]["recent_low_20"] == 139.0


def test_build_multi_timeframe_context_uses_injected_stock_fetcher():
    def stock_fetcher(symbol: str, timeframe: str, limit: int):
        return {"symbol": symbol, "timeframe": timeframe, "source": "stub_stock", "candles": sample_candles(limit)}

    context = build_multi_timeframe_market_context(
        symbol="aapl",
        asset_type="stock",
        exchange="NASDAQ",
        timeframes=["5m", "15m", "1h"],
        limit=60,
        stock_fetcher=stock_fetcher,
    )

    assert context["symbol"] == "AAPL"
    assert context["asset_type"] == "stock"
    assert context["paper_only"] is True
    assert context["live_execution"] is False
    assert context["summary"]["valid_timeframe_count"] == 3
    assert context["summary"]["trend_alignment"] == "bullish_aligned"
    assert [item["source"] for item in context["contexts"]] == ["stub_stock", "stub_stock", "stub_stock"]


def test_build_multi_timeframe_context_uses_injected_crypto_fetcher_and_reports_errors():
    def crypto_fetcher(symbol: str, timeframe: str, limit: int, venue: str):
        if timeframe == "15m":
            return {"error": {"code": "NO_DATA", "message": "missing"}}
        return {"venue": venue, "symbol": symbol, "bars": sample_candles(limit)}

    context = build_multi_timeframe_market_context(
        symbol="btcusdt",
        asset_type="crypto",
        exchange="binance",
        timeframes=["5m", "15m"],
        limit=60,
        crypto_fetcher=crypto_fetcher,
    )

    assert context["symbol"] == "BTCUSDT"
    assert context["asset_type"] == "crypto"
    assert context["summary"]["valid_timeframe_count"] == 1
    assert context["summary"]["errors"] == [{"timeframe": "15m", "error": {"code": "NO_DATA", "message": "missing"}}]
    assert context["contexts"][1]["error"]["code"] == "NO_DATA"
