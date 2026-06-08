"""Public crypto market-data helpers for Binance, Coinbase, and Kraken."""
from __future__ import annotations

from typing import Any

import requests


SUPPORTED_CRYPTO_VENUES = {"binance", "coinbase", "kraken"}


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


def get_crypto_live_ticker(symbol: str, venue: str = "binance") -> dict[str, Any]:
    try:
        clean_venue = _venue(venue)
    except ValueError as exc:
        return {"error": {"code": "INVALID_VENUE", "message": str(exc)}}

    try:
        if clean_venue == "binance":
            clean_symbol = _binance_symbol(symbol)
            payload = _request_json("https://api.binance.com/api/v3/ticker/24hr", params={"symbol": clean_symbol})
            if isinstance(payload, dict) and "error" in payload:
                return payload
            return {
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

        if clean_venue == "coinbase":
            product_id = _coinbase_product_id(symbol)
            payload = _request_json(f"https://api.exchange.coinbase.com/products/{product_id}/ticker")
            if isinstance(payload, dict) and "error" in payload:
                return payload
            return {
                "venue": clean_venue,
                "symbol": product_id,
                "price": payload.get("price"),
                "bid": payload.get("bid"),
                "ask": payload.get("ask"),
                "volume_24h": payload.get("volume"),
                "time": payload.get("time"),
                "raw": payload,
            }

        pair = _kraken_pair(symbol)
        payload = _request_json("https://api.kraken.com/0/public/Ticker", params={"pair": pair})
        if isinstance(payload, dict) and "error" in payload:
            return payload
        if payload.get("error"):
            return {"error": {"code": "UPSTREAM_ERROR", "message": payload.get("error")}}
        result = payload.get("result", {})
        ticker = result.get(next(iter(result), ""), {})
        return {
            "venue": clean_venue,
            "symbol": pair,
            "price": ticker.get("c", [None])[0],
            "bid": ticker.get("b", [None])[0],
            "ask": ticker.get("a", [None])[0],
            "volume_24h": ticker.get("v", [None, None])[1],
            "raw": ticker,
        }
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
            payload = _request_json("https://api.binance.com/api/v3/depth", params={"symbol": clean_symbol, "limit": clean_limit})
            if isinstance(payload, dict) and "error" in payload:
                return payload
            return {"venue": clean_venue, "symbol": clean_symbol, "bids": payload.get("bids", [])[:clean_limit], "asks": payload.get("asks", [])[:clean_limit], "raw": payload}

        if clean_venue == "coinbase":
            product_id = _coinbase_product_id(symbol)
            payload = _request_json(f"https://api.exchange.coinbase.com/products/{product_id}/book", params={"level": 2})
            if isinstance(payload, dict) and "error" in payload:
                return payload
            return {"venue": clean_venue, "symbol": product_id, "bids": payload.get("bids", [])[:clean_limit], "asks": payload.get("asks", [])[:clean_limit], "raw": payload}

        pair = _kraken_pair(symbol)
        payload = _request_json("https://api.kraken.com/0/public/Depth", params={"pair": pair, "count": clean_limit})
        if isinstance(payload, dict) and "error" in payload:
            return payload
        if payload.get("error"):
            return {"error": {"code": "UPSTREAM_ERROR", "message": payload.get("error")}}
        result = payload.get("result", {})
        book = result.get(next(iter(result), ""), {})
        return {"venue": clean_venue, "symbol": pair, "bids": book.get("bids", [])[:clean_limit], "asks": book.get("asks", [])[:clean_limit], "raw": book}
    except ValueError as exc:
        return {"error": {"code": "INVALID_SYMBOL", "message": str(exc)}}


def get_crypto_candles(symbol: str, venue: str = "binance", interval: str = "1h", limit: int = 100) -> dict[str, Any]:
    try:
        clean_venue = _venue(venue)
        clean_limit = max(1, min(int(limit), 300))
    except ValueError as exc:
        return {"error": {"code": "INVALID_ARGUMENT", "message": str(exc)}}

    try:
        venue_interval = _normalize_interval(clean_venue, interval)
        if clean_venue == "binance":
            clean_symbol = _binance_symbol(symbol)
            payload = _request_json("https://api.binance.com/api/v3/klines", params={"symbol": clean_symbol, "interval": venue_interval, "limit": clean_limit})
            if isinstance(payload, dict) and "error" in payload:
                return payload
            bars = [{"open_time": row[0], "open": row[1], "high": row[2], "low": row[3], "close": row[4], "volume": row[5], "close_time": row[6]} for row in payload]
            return {"venue": clean_venue, "symbol": clean_symbol, "interval": venue_interval, "limit": clean_limit, "bars": bars}

        if clean_venue == "coinbase":
            product_id = _coinbase_product_id(symbol)
            payload = _request_json(f"https://api.exchange.coinbase.com/products/{product_id}/candles", params={"granularity": venue_interval})
            if isinstance(payload, dict) and "error" in payload:
                return payload
            bars = [{"time": row[0], "low": row[1], "high": row[2], "open": row[3], "close": row[4], "volume": row[5]} for row in payload[:clean_limit]]
            return {"venue": clean_venue, "symbol": product_id, "interval": interval, "limit": clean_limit, "bars": bars}

        pair = _kraken_pair(symbol)
        payload = _request_json("https://api.kraken.com/0/public/OHLC", params={"pair": pair, "interval": venue_interval})
        if isinstance(payload, dict) and "error" in payload:
            return payload
        if payload.get("error"):
            return {"error": {"code": "UPSTREAM_ERROR", "message": payload.get("error")}}
        result = payload.get("result", {})
        pair_keys = [key for key in result.keys() if key != "last"]
        bars_raw = result.get(pair_keys[0], []) if pair_keys else []
        bars = [{"time": row[0], "open": row[1], "high": row[2], "low": row[3], "close": row[4], "vwap": row[5], "volume": row[6], "count": row[7]} for row in bars_raw[-clean_limit:]]
        return {"venue": clean_venue, "symbol": pair, "interval": venue_interval, "limit": clean_limit, "bars": bars}
    except ValueError as exc:
        return {"error": {"code": "INVALID_SYMBOL", "message": str(exc)}}
