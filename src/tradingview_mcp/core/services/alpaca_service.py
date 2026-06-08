"""Read-only Alpaca market-data helpers.

This module intentionally does not place orders. Paper trading is simulated in
risk_service/workstation_app so the workstation can be tested without broker
execution permissions.
"""
from __future__ import annotations

import os
from typing import Any

import requests


ALPACA_PAPER_TRADING_BASE_URL = "https://paper-api.alpaca.markets"
ALPACA_DATA_BASE_URL = "https://data.alpaca.markets"
REAL_ORDER_CONFIRMATION = "I understand this places a real order"


def _alpaca_credentials() -> tuple[str | None, str | None]:
    api_key = os.environ.get("ALPACA_API_KEY") or os.environ.get("APCA_API_KEY_ID")
    secret_key = os.environ.get("ALPACA_SECRET_KEY") or os.environ.get("APCA_API_SECRET_KEY")
    return api_key, secret_key


def _alpaca_headers() -> dict[str, str]:
    api_key, secret_key = _alpaca_credentials()
    if not api_key or not secret_key:
        raise RuntimeError(
            "Missing Alpaca credentials. Set ALPACA_API_KEY/ALPACA_SECRET_KEY "
            "or APCA_API_KEY_ID/APCA_API_SECRET_KEY."
        )
    return {
        "APCA-API-KEY-ID": api_key,
        "APCA-API-SECRET-KEY": secret_key,
        "accept": "application/json",
        "content-type": "application/json",
    }


def _request_json(
    method: str,
    url: str,
    *,
    params: dict[str, Any] | None = None,
    headers: dict[str, str] | None = None,
    timeout: float = 15.0,
) -> dict[str, Any]:
    try:
        response = requests.request(method, url, params=params, headers=headers, timeout=timeout)
    except requests.RequestException as exc:
        return {"error": {"code": "REQUEST_FAILED", "message": str(exc)}}

    try:
        payload = response.json()
    except ValueError:
        payload = {"raw": response.text[:500]}

    if response.status_code >= 400:
        return {"error": {"code": "UPSTREAM_ERROR", "status_code": response.status_code, "message": payload}}
    return payload if isinstance(payload, dict) else {"data": payload}


def get_alpaca_safety_status() -> dict[str, Any]:
    api_key, secret_key = _alpaca_credentials()
    return {
        "alpaca_credentials_configured": bool(api_key and secret_key),
        "market_data_available": bool(api_key and secret_key),
        "account_read_available": bool(api_key and secret_key),
        "broker_order_submission_available": False,
        "paper_trading_mode": "local_simulation_only",
        "real_execution_available": False,
        "real_execution_status": "disabled_in_this_workstation",
        "real_order_confirmation_required": REAL_ORDER_CONFIRMATION,
    }


def get_alpaca_account() -> dict[str, Any]:
    return _request_json("GET", f"{ALPACA_PAPER_TRADING_BASE_URL}/v2/account", headers=_alpaca_headers())


def get_alpaca_positions() -> dict[str, Any]:
    return _request_json("GET", f"{ALPACA_PAPER_TRADING_BASE_URL}/v2/positions", headers=_alpaca_headers())


def get_alpaca_stock_quote(symbol: str, feed: str | None = None) -> dict[str, Any]:
    clean_symbol = symbol.strip().upper()
    clean_feed = (feed or os.environ.get("ALPACA_DATA_FEED", "iex")).strip().lower()
    payload = _request_json(
        "GET",
        f"{ALPACA_DATA_BASE_URL}/v2/stocks/{clean_symbol}/quotes/latest",
        headers=_alpaca_headers(),
        params={"feed": clean_feed},
    )
    if "error" in payload:
        return payload
    return {"symbol": clean_symbol, "feed": clean_feed, "quote": payload.get("quote"), "source": "alpaca"}


def get_alpaca_stock_bars(symbol: str, timeframe: str = "1Day", limit: int = 100, feed: str | None = None) -> dict[str, Any]:
    clean_symbol = symbol.strip().upper()
    clean_feed = (feed or os.environ.get("ALPACA_DATA_FEED", "iex")).strip().lower()
    clean_limit = max(1, min(int(limit), 1000))
    payload = _request_json(
        "GET",
        f"{ALPACA_DATA_BASE_URL}/v2/stocks/{clean_symbol}/bars",
        headers=_alpaca_headers(),
        params={"timeframe": timeframe.strip(), "limit": clean_limit, "feed": clean_feed, "adjustment": "raw"},
    )
    if "error" in payload:
        return payload
    return {
        "symbol": clean_symbol,
        "timeframe": timeframe.strip(),
        "feed": clean_feed,
        "limit": clean_limit,
        "bars": payload.get("bars", []),
        "source": "alpaca",
    }
