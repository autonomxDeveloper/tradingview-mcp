"""Compact multi-timeframe market context for AI paper-trader decisions.

This service summarizes existing candle payloads into deterministic features for
AI prompts. It does not call an LLM, submit paper orders, or touch live broker
execution APIs.
"""
from __future__ import annotations

from statistics import mean
from typing import Any, Callable

from tradingview_mcp.core.services.crypto_live_service import get_crypto_candles
from tradingview_mcp.core.services.workstation_chart_service import get_yahoo_chart
from tradingview_mcp.core.utils.validators import sanitize_timeframe

DEFAULT_TIMEFRAMES = ["5m", "15m", "1h", "1D"]


def _float(value: Any) -> float | None:
    try:
        parsed = float(value)
    except (TypeError, ValueError):
        return None
    return parsed


def _int_time(value: Any) -> int | None:
    try:
        return int(float(value))
    except (TypeError, ValueError):
        return None


def _clean_timeframes(values: list[str] | None, fallback: list[str] | None = None) -> list[str]:
    source = values or fallback or DEFAULT_TIMEFRAMES
    cleaned: list[str] = []
    seen: set[str] = set()
    for raw in source:
        timeframe = sanitize_timeframe(str(raw or ""), "1D")
        if timeframe not in seen:
            seen.add(timeframe)
            cleaned.append(timeframe)
    return cleaned or list(DEFAULT_TIMEFRAMES)


def normalize_candles(payload: dict[str, Any]) -> list[dict[str, Any]]:
    """Normalize stock candles or crypto bars into OHLCV candles."""
    raw_rows = payload.get("candles") or payload.get("bars") or []
    candles: list[dict[str, Any]] = []
    for row in raw_rows:
        if not isinstance(row, dict):
            continue
        open_price = _float(row.get("open"))
        high = _float(row.get("high"))
        low = _float(row.get("low"))
        close = _float(row.get("close"))
        if None in (open_price, high, low, close):
            continue
        volume = _float(row.get("volume")) or 0.0
        timestamp = _int_time(row.get("time") or row.get("open_time") or row.get("close_time"))
        candles.append(
            {
                "time": timestamp,
                "open": open_price,
                "high": high,
                "low": low,
                "close": close,
                "volume": volume,
            }
        )
    return candles


def _sma(values: list[float], period: int) -> float | None:
    if len(values) < period:
        return None
    return mean(values[-period:])


def _ema(values: list[float], period: int) -> float | None:
    if not values:
        return None
    if len(values) < period:
        return mean(values)
    multiplier = 2 / (period + 1)
    ema = mean(values[:period])
    for value in values[period:]:
        ema = (value - ema) * multiplier + ema
    return ema


def _rsi(values: list[float], period: int = 14) -> float | None:
    if len(values) <= period:
        return None
    gains: list[float] = []
    losses: list[float] = []
    for previous, current in zip(values[-period - 1 : -1], values[-period:]):
        change = current - previous
        if change >= 0:
            gains.append(change)
            losses.append(0.0)
        else:
            gains.append(0.0)
            losses.append(abs(change))
    average_gain = mean(gains) if gains else 0.0
    average_loss = mean(losses) if losses else 0.0
    if average_loss == 0:
        return 100.0 if average_gain > 0 else 50.0
    rs = average_gain / average_loss
    return 100 - (100 / (1 + rs))


def _atr(candles: list[dict[str, Any]], period: int = 14) -> float | None:
    if len(candles) <= period:
        return None
    true_ranges: list[float] = []
    recent = candles[-period - 1 :]
    for previous, current in zip(recent[:-1], recent[1:]):
        high = current["high"]
        low = current["low"]
        previous_close = previous["close"]
        true_ranges.append(max(high - low, abs(high - previous_close), abs(low - previous_close)))
    return mean(true_ranges) if true_ranges else None


def _safe_round(value: float | None, digits: int = 4) -> float | None:
    return round(value, digits) if value is not None else None


def summarize_candles(candles: list[dict[str, Any]], *, timeframe: str, source: str = "unknown") -> dict[str, Any]:
    if not candles:
        return {
            "timeframe": timeframe,
            "source": source,
            "candle_count": 0,
            "error": "no_candles",
        }

    closes = [candle["close"] for candle in candles]
    volumes = [candle["volume"] for candle in candles]
    latest = candles[-1]
    first = candles[0]
    close = latest["close"]
    previous_close = candles[-2]["close"] if len(candles) >= 2 else None
    sma20 = _sma(closes, 20)
    sma50 = _sma(closes, 50)
    ema21 = _ema(closes, 21)
    atr14 = _atr(candles, 14)
    rsi14 = _rsi(closes, 14)
    recent_window = candles[-20:] if len(candles) >= 20 else candles
    recent_high = max(candle["high"] for candle in recent_window)
    recent_low = min(candle["low"] for candle in recent_window)
    average_volume_20 = mean(volumes[-20:]) if len(volumes) >= 20 else mean(volumes)
    price_change = close - first["close"]
    price_change_pct = (price_change / first["close"] * 100) if first["close"] else None
    one_bar_change_pct = ((close - previous_close) / previous_close * 100) if previous_close else None

    trend = "unknown"
    if sma20 is not None and sma50 is not None:
        if close > sma20 > sma50:
            trend = "uptrend"
        elif close < sma20 < sma50:
            trend = "downtrend"
        else:
            trend = "mixed"
    elif sma20 is not None:
        trend = "above_sma20" if close > sma20 else "below_sma20"

    volatility = "unknown"
    atr_pct = (atr14 / close * 100) if atr14 and close else None
    if atr_pct is not None:
        if atr_pct < 1:
            volatility = "low"
        elif atr_pct < 3:
            volatility = "medium"
        else:
            volatility = "high"

    momentum = "neutral"
    if rsi14 is not None:
        if rsi14 >= 70:
            momentum = "overbought"
        elif rsi14 <= 30:
            momentum = "oversold"
        elif rsi14 >= 55:
            momentum = "bullish"
        elif rsi14 <= 45:
            momentum = "bearish"

    return {
        "timeframe": timeframe,
        "source": source,
        "candle_count": len(candles),
        "latest": {
            "time": latest.get("time"),
            "open": _safe_round(latest["open"]),
            "high": _safe_round(latest["high"]),
            "low": _safe_round(latest["low"]),
            "close": _safe_round(close),
            "volume": _safe_round(latest["volume"], 2),
        },
        "change": {
            "from_first_close": _safe_round(price_change),
            "from_first_close_pct": _safe_round(price_change_pct),
            "one_bar_pct": _safe_round(one_bar_change_pct),
        },
        "trend": trend,
        "momentum": momentum,
        "volatility": volatility,
        "indicators": {
            "sma20": _safe_round(sma20),
            "sma50": _safe_round(sma50),
            "ema21": _safe_round(ema21),
            "rsi14": _safe_round(rsi14),
            "atr14": _safe_round(atr14),
            "atr14_pct": _safe_round(atr_pct),
            "average_volume_20": _safe_round(average_volume_20, 2),
        },
        "levels": {
            "recent_high_20": _safe_round(recent_high),
            "recent_low_20": _safe_round(recent_low),
            "distance_to_recent_high_pct": _safe_round(((recent_high - close) / close * 100) if close else None),
            "distance_to_recent_low_pct": _safe_round(((close - recent_low) / close * 100) if close else None),
        },
    }


def _default_stock_fetcher(symbol: str, timeframe: str, limit: int) -> dict[str, Any]:
    return get_yahoo_chart(symbol, timeframe=timeframe, limit=limit)


def _default_crypto_fetcher(symbol: str, timeframe: str, limit: int, venue: str) -> dict[str, Any]:
    return get_crypto_candles(symbol, venue=venue, interval=timeframe, limit=limit)


def build_multi_timeframe_market_context(
    *,
    symbol: str,
    asset_type: str = "stock",
    exchange: str = "NASDAQ",
    timeframes: list[str] | None = None,
    limit: int = 120,
    stock_fetcher: Callable[[str, str, int], dict[str, Any]] | None = None,
    crypto_fetcher: Callable[[str, str, int, str], dict[str, Any]] | None = None,
) -> dict[str, Any]:
    """Fetch and summarize multi-timeframe candles into compact AI context."""
    clean_symbol = str(symbol or "").strip().upper()
    clean_asset_type = str(asset_type or "stock").strip().lower()
    clean_exchange = str(exchange or "NASDAQ").strip()
    clean_timeframes = _clean_timeframes(timeframes)
    clean_limit = max(20, min(int(limit), 300))
    stock_fetch = stock_fetcher or _default_stock_fetcher
    crypto_fetch = crypto_fetcher or _default_crypto_fetcher

    contexts: list[dict[str, Any]] = []
    errors: list[dict[str, Any]] = []
    for timeframe in clean_timeframes:
        if clean_asset_type == "crypto":
            payload = crypto_fetch(clean_symbol, timeframe, clean_limit, clean_exchange.lower() or "binance")
        else:
            payload = stock_fetch(clean_symbol, timeframe, clean_limit)
        if payload.get("error"):
            errors.append({"timeframe": timeframe, "error": payload.get("error")})
            contexts.append({"timeframe": timeframe, "source": payload.get("source", "unknown"), "candle_count": 0, "error": payload.get("error")})
            continue
        candles = normalize_candles(payload)
        contexts.append(summarize_candles(candles, timeframe=timeframe, source=str(payload.get("source") or payload.get("venue") or "unknown")))

    trend_votes = [item.get("trend") for item in contexts if not item.get("error") and item.get("trend") not in {None, "unknown"}]
    momentum_votes = [item.get("momentum") for item in contexts if not item.get("error") and item.get("momentum")]
    latest_closes = [item.get("latest", {}).get("close") for item in contexts if isinstance(item.get("latest"), dict) and item.get("latest", {}).get("close") is not None]
    alignment = "unknown"
    if trend_votes:
        if all(vote in {"uptrend", "above_sma20"} for vote in trend_votes):
            alignment = "bullish_aligned"
        elif all(vote in {"downtrend", "below_sma20"} for vote in trend_votes):
            alignment = "bearish_aligned"
        else:
            alignment = "mixed"

    return {
        "symbol": clean_symbol,
        "asset_type": clean_asset_type,
        "exchange": clean_exchange,
        "timeframes": clean_timeframes,
        "limit": clean_limit,
        "paper_only": True,
        "live_execution": False,
        "summary": {
            "timeframe_count": len(contexts),
            "valid_timeframe_count": len([item for item in contexts if not item.get("error")]),
            "trend_alignment": alignment,
            "trend_votes": trend_votes,
            "momentum_votes": momentum_votes,
            "latest_close": latest_closes[0] if latest_closes else None,
            "errors": errors,
        },
        "contexts": contexts,
    }
