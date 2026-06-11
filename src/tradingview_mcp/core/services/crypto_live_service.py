"""Public crypto market-data helpers for Binance, Coinbase, and Kraken."""
from __future__ import annotations

from typing import Any

import requests

from tradingview_mcp.core.services.market_data_cache_service import fallback_from_cache, write_cache


SUPPORTED_CRYPTO_VENUES = {"binance", "coinbase", "kraken"}
MAX_AGGREGATED_CANDLE_LIMIT = 5000
BINANCE_KLINES_PAGE_LIMIT = 1000


def _request_json(url: str, *, params: dict[str, Any] | None = None, timeout: float = 15.0) -> Any:
    try:
        response = requests.get(url, params=params, timeout=timeout)
    except requests.RequestException as exc:
        return {"error": {"code": "REQUEST_FAILED", "message": str(exc)}}

    try:
        payload = response.json()
    except ValueError:
        payload = {"raw": response.text[:500]}

    if response.status_code >= 400:
        return {"error": {"code": "UPSTREAM_ERROR", "status_code": response.status_code, "message": payload}}
    return payload


def _venue(value: str) -> str:
    venue = value.strip().lower()
    if venue not in SUPPORTED_CRYPTO_VENUES:
        raise ValueError(f"Unsupported venue {value!r}. Use one of: {', '.join(sorted(SUPPORTED_CRYPTO_VENUES))}")
    return venue


def _base_quote(symbol: str) -> tuple[str, str]:
    cleaned = symbol.strip().upper().replace("-", "").replace("/", "")
    for quote in ("USDT", "USDC", "USD", "BTC", "ETH", "EUR"):
        if cleaned.endswith(quote) and len(cleaned) > len(quote):
            return cleaned[: -len(quote)], quote
    raise ValueError("Could not infer base/quote from symbol. Use symbols like BTCUSDT, BTC-USD, or BTC/USD.")


def _binance_symbol(symbol: str) -> str:
    return "".join(_base_quote(symbol))


def _coinbase_product_id(symbol: str) -> str:
    base, quote = _base_quote(symbol)
    if quote == "USDT":
        quote = "USD"
    return f"{base}-{quote}"


def _kraken_pair(symbol: str) -> str:
    base, quote = _base_quote(symbol)
    kraken_base = {"BTC": "XBT"}.get(base, base)
    return f"{kraken_base}{quote}"


def _normalize_interval(venue: str, interval: str) -> str | int:
    value = interval.strip().lower()
    if venue == "binance":
        return {"1m": "1m", "5m": "5m", "15m": "15m", "30m": "30m", "1h": "1h", "4h": "4h", "1d": "1d", "1w": "1w"}.get(value, "1h")
    if venue == "coinbase":
        return {"1m": 60, "5m": 300, "15m": 900, "30m": 1800, "1h": 3600, "1d": 86400}.get(value, 3600)
    return {"1m": 1, "5m": 5, "15m": 15, "30m": 30, "1h": 60, "4h": 240, "1d": 1440}.get(value, 60)


def _cache_key(kind: str, venue: str, symbol: str, *parts: object) -> str:
    suffix = ":".join(str(part) for part in parts if part is not None)
    return f"crypto:{kind}:{venue}:{symbol}:{suffix}"


def _cache_or_error(cache_key: str, payload: dict[str, Any]) -> dict[str, Any]:
    return fallback_from_cache(cache_key, payload)


def _clamp_candle_limit(limit: int) -> int:
    return max(1, min(int(limit), MAX_AGGREGATED_CANDLE_LIMIT))


def _binance_klines_page(symbol: str, interval: str | int, limit: int, end_time: int | None = None) -> Any:
    params: dict[str, Any] = {"symbol": symbol, "interval": interval, "limit": limit}
    if end_time is not None:
        params["endTime"] = end_time
    return _request_json("https://api.binance.com/api/v3/klines", params=params)


def _binance_candle_payload(symbol: str, interval: str | int, limit: int) -> tuple[Any, bool]:
    remaining = limit
    end_time: int | None = None
    pages: list[list[Any]] = []
    history_complete = False

    while remaining > 0:
        page_limit = min(BINANCE_KLINES_PAGE_LIMIT, remaining)
        payload = _binance_klines_page(symbol, interval, page_limit, end_time=end_time)
        if isinstance(payload, dict) and "error" in payload:
            return payload, False
        if not isinstance(payload, list) or not payload:
            history_complete = True
            break

        pages = payload + pages
        remaining -= len(payload)
        oldest_open_time = int(payload[0][0])
        if len(payload) < page_limit:
            history_complete = True
            break
        next_end_time = oldest_open_time - 1
        if end_time == next_end_time:
            break
        end_time = next_end_time

    return pages[-limit:], history_complete


def _history_payload(bars: list[dict[str, Any]], *, requested_limit: int, history_complete: bool) -> dict[str, Any]:
    first = bars[0] if bars else {}
    last = bars[-1] if bars else {}
    first_open_time = first.get("open_time") or first.get("time")
    last_open_time = last.get("open_time") or last.get("time")
    return {
        "requested_limit": requested_limit,
        "bars_count": len(bars),
        "first_open_time": first_open_time,
        "last_open_time": last_open_time,
        "history_complete": bool(history_complete),
    }


def get_crypto_live_ticker(symbol: str, venue: str = "binance") -> dict[str, Any]:
    try:
        clean_venue = _venue(venue)
    except ValueError as exc:
        return {"error": {"code": "INVALID_VENUE", "message": str(exc)}}

    try:
        if clean_venue == "binance":
            clean_symbol = _binance_symbol(symbol)
            cache_key = _cache_key("ticker", clean_venue, clean_symbol)
            payload = _request_json("https://api.binance.com/api/v3/ticker/24hr", params={"symbol": clean_symbol})
            if isinstance(payload, dict) and "error" in payload:
                return _cache_or_error(cache_key, payload)
            result = {
                "venue": clean_venue,
                "symbol": clean_symbol,
                "price": payload.get("lastPrice"),
                "bid": payload.get("bidPrice"),
                "ask": payload.get("askPrice"),
                "price_change_pct_24h": payload.get("priceChangePercent"),
                "volume_24h": payload.get("volume"),
                "quote_volume_24h": payload.get("quoteVolume"),
                "raw": payload,
            }
            return write_cache(cache_key, result, source="binance_ticker")

        if clean_venue == "coinbase":
            product_id = _coinbase_product_id(symbol)
            cache_key = _cache_key("ticker", clean_venue, product_id)
            payload = _request_json(f"https://api.exchange.coinbase.com/products/{product_id}/ticker")
            if isinstance(payload, dict) and "error" in payload:
                return _cache_or_error(cache_key, payload)
            result = {
                "venue": clean_venue,
                "symbol": product_id,
                "price": payload.get("price"),
                "bid": payload.get("bid"),
                "ask": payload.get("ask"),
                "volume_24h": payload.get("volume"),
                "time": payload.get("time"),
                "raw": payload,
            }
            return write_cache(cache_key, result, source="coinbase_ticker")

        pair = _kraken_pair(symbol)
        cache_key = _cache_key("ticker", clean_venue, pair)
        payload = _request_json("https://api.kraken.com/0/public/Ticker", params={"pair": pair})
        if isinstance(payload, dict) and "error" in payload:
            return _cache_or_error(cache_key, payload)
        if payload.get("error"):
            return _cache_or_error(cache_key, {"error": {"code": "UPSTREAM_ERROR", "message": payload.get("error")}})
        result = payload.get("result", {})
        ticker = result.get(next(iter(result), ""), {})
        payload_out = {
            "venue": clean_venue,
            "symbol": pair,
            "price": ticker.get("c", [None])[0],
            "bid": ticker.get("b", [None])[0],
            "ask": ticker.get("a", [None])[0],
            "volume_24h": ticker.get("v", [None, None])[1],
            "raw": ticker,
        }
        return write_cache(cache_key, payload_out, source="kraken_ticker")
    except ValueError as exc:
        return {"error": {"code": "INVALID_SYMBOL", "message": str(exc)}}


def get_crypto_order_book(symbol: str, venue: str = "binance", limit: int = 20) -> dict[str, Any]:
    try:
        clean_venue = _venue(venue)
        clean_limit = max(1, min(int(limit), 100))
    except ValueError as exc:
        return {"error": {"code": "INVALID_ARGUMENT", "message": str(exc)}}

    try:
        if clean_venue == "binance":
            clean_symbol = _binance_symbol(symbol)
            cache_key = _cache_key("book", clean_venue, clean_symbol, clean_limit)
            payload = _request_json("https://api.binance.com/api/v3/depth", params={"symbol": clean_symbol, "limit": clean_limit})
            if isinstance(payload, dict) and "error" in payload:
                return _cache_or_error(cache_key, payload)
            return write_cache(cache_key, {"venue": clean_venue, "symbol": clean_symbol, "bids": payload.get("bids", [])[:clean_limit], "asks": payload.get("asks", [])[:clean_limit], "raw": payload}, source="binance_book")

        if clean_venue == "coinbase":
            product_id = _coinbase_product_id(symbol)
            cache_key = _cache_key("book", clean_venue, product_id, clean_limit)
            payload = _request_json(f"https://api.exchange.coinbase.com/products/{product_id}/book", params={"level": 2})
            if isinstance(payload, dict) and "error" in payload:
                return _cache_or_error(cache_key, payload)
            return write_cache(cache_key, {"venue": clean_venue, "symbol": product_id, "bids": payload.get("bids", [])[:clean_limit], "asks": payload.get("asks", [])[:clean_limit], "raw": payload}, source="coinbase_book")

        pair = _kraken_pair(symbol)
        cache_key = _cache_key("book", clean_venue, pair, clean_limit)
        payload = _request_json("https://api.kraken.com/0/public/Depth", params={"pair": pair, "count": clean_limit})
        if isinstance(payload, dict) and "error" in payload:
            return _cache_or_error(cache_key, payload)
        if payload.get("error"):
            return _cache_or_error(cache_key, {"error": {"code": "UPSTREAM_ERROR", "message": payload.get("error")}})
        result = payload.get("result", {})
        book = result.get(next(iter(result), ""), {})
        return write_cache(cache_key, {"venue": clean_venue, "symbol": pair, "bids": book.get("bids", [])[:clean_limit], "asks": book.get("asks", [])[:clean_limit], "raw": book}, source="kraken_book")
    except ValueError as exc:
        return {"error": {"code": "INVALID_SYMBOL", "message": str(exc)}}


def get_crypto_candles(symbol: str, venue: str = "binance", interval: str = "1h", limit: int = 100) -> dict[str, Any]:
    try:
        clean_venue = _venue(venue)
        clean_limit = _clamp_candle_limit(limit)
    except ValueError as exc:
        return {"error": {"code": "INVALID_ARGUMENT", "message": str(exc)}}

    try:
        venue_interval = _normalize_interval(clean_venue, interval)
        if clean_venue == "binance":
            clean_symbol = _binance_symbol(symbol)
            cache_key = _cache_key("candles", clean_venue, clean_symbol, venue_interval, clean_limit)
            payload, history_complete = _binance_candle_payload(clean_symbol, venue_interval, clean_limit)
            if isinstance(payload, dict) and "error" in payload:
                return _cache_or_error(cache_key, payload)
            bars = [{"open_time": row[0], "open": row[1], "high": row[2], "low": row[3], "close": row[4], "volume": row[5], "close_time": row[6]} for row in payload]
            result = {"venue": clean_venue, "symbol": clean_symbol, "interval": venue_interval, "limit": clean_limit, "bars": bars, "history": _history_payload(bars, requested_limit=clean_limit, history_complete=history_complete)}
            return write_cache(cache_key, result, source="binance_candles")

        if clean_venue == "coinbase":
            product_id = _coinbase_product_id(symbol)
            cache_key = _cache_key("candles", clean_venue, product_id, venue_interval, clean_limit)
            payload = _request_json(f"https://api.exchange.coinbase.com/products/{product_id}/candles", params={"granularity": venue_interval})
            if isinstance(payload, dict) and "error" in payload:
                return _cache_or_error(cache_key, payload)
            bars = [{"time": row[0], "low": row[1], "high": row[2], "open": row[3], "close": row[4], "volume": row[5]} for row in payload[:clean_limit]]
            return write_cache(cache_key, {"venue": clean_venue, "symbol": product_id, "interval": interval, "limit": clean_limit, "bars": bars, "history": _history_payload(bars, requested_limit=clean_limit, history_complete=len(bars) < clean_limit)}, source="coinbase_candles")

        pair = _kraken_pair(symbol)
        cache_key = _cache_key("candles", clean_venue, pair, venue_interval, clean_limit)
        payload = _request_json("https://api.kraken.com/0/public/OHLC", params={"pair": pair, "interval": venue_interval})
        if isinstance(payload, dict) and "error" in payload:
            return _cache_or_error(cache_key, payload)
        if payload.get("error"):
            return _cache_or_error(cache_key, {"error": {"code": "UPSTREAM_ERROR", "message": payload.get("error")}})
        result = payload.get("result", {})
        pair_keys = [key for key in result.keys() if key != "last"]
        bars_raw = result.get(pair_keys[0], []) if pair_keys else []
        bars = [{"time": row[0], "open": row[1], "high": row[2], "low": row[3], "close": row[4], "vwap": row[5], "volume": row[6], "count": row[7]} for row in bars_raw[-clean_limit:]]
        return write_cache(cache_key, {"venue": clean_venue, "symbol": pair, "interval": venue_interval, "limit": clean_limit, "bars": bars, "history": _history_payload(bars, requested_limit=clean_limit, history_complete=len(bars) < clean_limit)}, source="kraken_candles")
    except ValueError as exc:
        return {"error": {"code": "INVALID_SYMBOL", "message": str(exc)}}
