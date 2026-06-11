"""Yahoo chart helpers for the research workstation."""
from __future__ import annotations

import csv
from datetime import datetime, timezone
from io import StringIO
from typing import Any

import requests

from tradingview_mcp.core.services.market_data_cache_service import fallback_from_cache, write_cache
from tradingview_mcp.core.utils.validators import normalize_yahoo_symbol, sanitize_timeframe


YAHOO_RANGE_BY_TIMEFRAME = {
    "1m": ("1d", "1m"),
    "5m": ("5d", "5m"),
    "15m": ("5d", "15m"),
    "30m": ("1mo", "30m"),
    "1h": ("3mo", "1h"),
    "4h": ("6mo", "1h"),
    "1D": ("1y", "1d"),
    "1W": ("5y", "1wk"),
    "1M": ("10y", "1mo"),
}
STOOQ_FALLBACK_TIMEFRAMES = {"1D"}
MARKET_DATA_HEADERS = {
    "Accept": "text/csv,application/json,text/plain,*/*",
    "Accept-Language": "en-US,en;q=0.9",
    "Cache-Control": "no-cache",
    "Pragma": "no-cache",
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/125.0.0.0 Safari/537.36"
    ),
}


def _json_error(code: str, message: str, **extra: Any) -> dict[str, Any]:
    payload: dict[str, Any] = {"error": {"code": code, "message": message}}
    payload["error"].update(extra)
    return payload


def _cache_key(symbol: str, timeframe: str, limit: int) -> str:
    return f"yahoo-chart:{normalize_yahoo_symbol(symbol)}:{sanitize_timeframe(timeframe, '1D')}:{max(1, min(int(limit), 2000))}"


def _stooq_symbol(symbol: str) -> str:
    clean = normalize_yahoo_symbol(symbol).strip().lower()
    if not clean:
        return clean
    if clean.startswith("^") or "-" in clean:
        return clean
    if "." in clean:
        return clean
    return f"{clean}.us"


def _looks_like_provider_error(text: str) -> bool:
    sample = (text or "").strip().lower()[:200]
    if not sample:
        return True
    return any(
        marker in sample
        for marker in (
            "too many requests",
            "edge:",
            "rate limit",
            "access denied",
            "forbidden",
            "not found",
            "no data",
            "<html",
            "<!doctype",
        )
    )


def _parse_stooq_daily_csv(symbol: str, text: str, limit: int) -> dict[str, Any] | None:
    if _looks_like_provider_error(text):
        return None
    rows = list(csv.DictReader(StringIO(text)))
    candles: list[dict[str, Any]] = []
    for row in rows:
        try:
            date_text = row.get("Date") or ""
            date_value = datetime.strptime(date_text, "%Y-%m-%d").replace(tzinfo=timezone.utc)
            open_price = float(row.get("Open") or "nan")
            high_price = float(row.get("High") or "nan")
            low_price = float(row.get("Low") or "nan")
            close_price = float(row.get("Close") or "nan")
            volume = int(float(row.get("Volume") or 0))
        except (TypeError, ValueError):
            continue
        candles.append(
            {
                "time": int(date_value.timestamp()),
                "open": open_price,
                "high": high_price,
                "low": low_price,
                "close": close_price,
                "volume": volume,
            }
        )
    if not candles:
        return None
    clean_limit = max(1, min(int(limit), 2000))
    return {
        "symbol": normalize_yahoo_symbol(symbol),
        "timeframe": "1D",
        "range": "stooq_daily_history",
        "interval": "1d",
        "currency": "USD",
        "exchange": "US",
        "regular_market_price": candles[-1]["close"],
        "previous_close": candles[-2]["close"] if len(candles) > 1 else None,
        "candles": candles[-clean_limit:],
        "source": "stooq_daily_csv",
    }


def _get_stooq_daily_chart(symbol: str, limit: int) -> dict[str, Any] | None:
    stooq_symbol = _stooq_symbol(symbol)
    if not stooq_symbol or stooq_symbol.startswith("^") or "-" in stooq_symbol:
        return None
    try:
        response = requests.get(
            "https://stooq.com/q/d/l/",
            params={"s": stooq_symbol, "i": "d"},
            headers=MARKET_DATA_HEADERS,
            timeout=20,
        )
    except requests.RequestException:
        return None
    if response.status_code >= 400:
        return None
    return _parse_stooq_daily_csv(symbol, response.text, limit)


def _fallback_stock_chart(cache_key: str, symbol: str, safe_timeframe: str, limit: int, error_payload: dict[str, Any]) -> dict[str, Any]:
    if safe_timeframe in STOOQ_FALLBACK_TIMEFRAMES:
        stooq_payload = _get_stooq_daily_chart(symbol, limit)
        if stooq_payload and stooq_payload.get("candles"):
            stooq_payload["fallback_from"] = error_payload.get("error", {}).get("code")
            return write_cache(cache_key, stooq_payload, source="stooq_daily_csv")
    return fallback_from_cache(cache_key, error_payload)


def get_yahoo_chart(symbol: str, timeframe: str = "1D", limit: int = 500) -> dict[str, Any]:
    yahoo_symbol = normalize_yahoo_symbol(symbol)
    safe_timeframe = sanitize_timeframe(timeframe, "1D")
    clean_limit = max(1, min(int(limit), 2000))
    cache_key = _cache_key(yahoo_symbol, safe_timeframe, clean_limit)
    range_value, interval = YAHOO_RANGE_BY_TIMEFRAME.get(safe_timeframe, ("1y", "1d"))
    try:
        response = requests.get(
            f"https://query1.finance.yahoo.com/v8/finance/chart/{yahoo_symbol}",
            params={"range": range_value, "interval": interval, "includePrePost": "true", "events": "div,splits"},
            headers=MARKET_DATA_HEADERS,
            timeout=20,
        )
    except requests.RequestException as exc:
        return _fallback_stock_chart(cache_key, yahoo_symbol, safe_timeframe, clean_limit, _json_error("REQUEST_FAILED", str(exc)))

    try:
        payload = response.json()
    except ValueError:
        return _fallback_stock_chart(cache_key, yahoo_symbol, safe_timeframe, clean_limit, _json_error("INVALID_RESPONSE", response.text[:500]))

    if response.status_code >= 400:
        return _fallback_stock_chart(
            cache_key,
            yahoo_symbol,
            safe_timeframe,
            clean_limit,
            _json_error("UPSTREAM_ERROR", "Yahoo chart request failed.", status_code=response.status_code, payload=payload),
        )

    chart = payload.get("chart", {})
    if chart.get("error"):
        return _fallback_stock_chart(cache_key, yahoo_symbol, safe_timeframe, clean_limit, _json_error("YAHOO_CHART_ERROR", "Yahoo chart returned an error.", details=chart.get("error")))
    results = chart.get("result") or []
    if not results:
        return _fallback_stock_chart(cache_key, yahoo_symbol, safe_timeframe, clean_limit, _json_error("NO_CHART_DATA", f"No chart data returned for {yahoo_symbol}."))

    result = results[0]
    timestamps = result.get("timestamp") or []
    quote = (result.get("indicators", {}).get("quote") or [{}])[0]
    opens = quote.get("open") or []
    highs = quote.get("high") or []
    lows = quote.get("low") or []
    closes = quote.get("close") or []
    volumes = quote.get("volume") or []
    candles: list[dict[str, Any]] = []
    for index, timestamp in enumerate(timestamps):
        try:
            open_price = opens[index]
            high_price = highs[index]
            low_price = lows[index]
            close_price = closes[index]
        except IndexError:
            continue
        if None in (open_price, high_price, low_price, close_price):
            continue
        candles.append(
            {
                "time": int(timestamp),
                "open": float(open_price),
                "high": float(high_price),
                "low": float(low_price),
                "close": float(close_price),
                "volume": int(volumes[index]) if index < len(volumes) and volumes[index] is not None else 0,
            }
        )

    if not candles:
        return _fallback_stock_chart(cache_key, yahoo_symbol, safe_timeframe, clean_limit, _json_error("NO_VALID_CANDLES", f"No valid candles returned for {yahoo_symbol}."))

    candles = candles[-clean_limit:]
    meta = result.get("meta", {})
    result_payload = {
        "symbol": yahoo_symbol,
        "timeframe": safe_timeframe,
        "range": range_value,
        "interval": interval,
        "currency": meta.get("currency"),
        "exchange": meta.get("exchangeName"),
        "regular_market_price": meta.get("regularMarketPrice"),
        "previous_close": meta.get("chartPreviousClose"),
        "candles": candles,
        "source": "yahoo_finance_chart",
    }
    return write_cache(cache_key, result_payload, source="yahoo_finance_chart")
