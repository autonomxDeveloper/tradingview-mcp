"""Local watchlist storage for the research workstation."""
from __future__ import annotations

import json
import os
from pathlib import Path

DEFAULT_SYMBOLS = ["AAPL", "NVDA", "TSLA", "SPY", "QQQ", "BTCUSDT", "ETHUSDT", "SOLUSDT"]


def watchlist_path() -> Path:
    return Path(os.environ.get("TRADING_WORKSTATION_WATCHLIST_FILE", "data/workstation_watchlist.json"))


def clean_symbols(symbols: list[str]) -> list[str]:
    seen: set[str] = set()
    result: list[str] = []
    for symbol in symbols:
        clean = str(symbol or "").strip().upper()
        if not clean or clean in seen:
            continue
        seen.add(clean)
        result.append(clean)
    return result


def read_watchlist(defaults: list[str] | None = None) -> list[str]:
    path = watchlist_path()
    if not path.exists():
        return clean_symbols(defaults or DEFAULT_SYMBOLS)
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return clean_symbols(defaults or DEFAULT_SYMBOLS)
    if isinstance(payload, dict):
        return clean_symbols(payload.get("symbols") or defaults or DEFAULT_SYMBOLS)
    if isinstance(payload, list):
        return clean_symbols(payload)
    return clean_symbols(defaults or DEFAULT_SYMBOLS)


def save_watchlist(symbols: list[str]) -> dict[str, object]:
    path = watchlist_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    clean = clean_symbols(symbols)
    payload = {"symbols": clean}
    path.write_text(json.dumps(payload, sort_keys=True, indent=2) + "\n", encoding="utf-8")
    return payload


def watchlist_status(defaults: list[str] | None = None) -> dict[str, object]:
    symbols = read_watchlist(defaults)
    return {"mode": "research_only", "watchlist_path": str(watchlist_path()), "count": len(symbols), "symbols": symbols}
