"""Yahoo chart helpers for the research workstation."""
from __future__ import annotations

from typing import Any

import requests

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


def _json_error(code: str, message: str, **extra: Any) -> dict[str, Any]:
    payload: dict[str, Any] = {"error": {"code": code, "message": message}}
    payload["error"].update(extra)
    return payload


def get_yahoo_chart(symbol: str, timeframe: str = "1D", limit: int = 500) -> dict[str, Any]:
    yahoo_symbol = normalize_yahoo_symbol(symbol)
    safe_timeframe = sanitize_timeframe(timeframe, "1D")
    range_value, interval = YAHOO_RANGE_BY_TIMEFRAME.get(safe_timeframe, ("1y", "1d"))
    try:
        response = requests.get(
            f"https://query1.finance.yahoo.com/v8/finance/chart/{yahoo_symbol}",
            params={"range": range_value, "interval": interval, "includePrePost": "true", "events": "div,splits"},
            timeout=20,
        )
    except requests.RequestException as exc:
        return _json_error("REQUEST_FAILED", str(exc))

    try:
        payload = response.json()
    except ValueError:
        return _json_error("INVALID_RESPONSE", response.text[:500])

    if response.status_code >= 400:
        return _json_error("UPSTREAM_ERROR", "Yahoo chart request failed.", status_code=response.status_code, payload=payload)

    chart = payload.get("chart", {})
    if chart.get("error"):
        return _json_error("YAHOO_CHART_ERROR", "Yahoo chart returned an error.", details=chart.get("error"))
    results = chart.get("result") or []
    if not results:
        return _json_error("NO_CHART_DATA", f"No chart data returned for {yahoo_symbol}.")

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

    if limit > 0:
        candles = candles[-min(limit, 2000) :]
    meta = result.get("meta", {})
    return {
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
