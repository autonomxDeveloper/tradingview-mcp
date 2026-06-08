"""Small JSON-file cache helpers for workstation market data.

The cache is intentionally simple and local. It stores successful market-data
payloads so the workstation can return a marked stale response when an upstream
provider fails.
"""
from __future__ import annotations

import json
import os
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


DEFAULT_CACHE_TTL_SECONDS = 300
DEFAULT_STALE_AFTER_SECONDS = 3600


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def utc_now_iso() -> str:
    return utc_now().isoformat()


def _cache_root() -> Path:
    return Path(os.environ.get("TRADING_WORKSTATION_MARKET_CACHE", "data/market_cache"))


def _safe_key(value: str) -> str:
    safe = re.sub(r"[^A-Za-z0-9_.-]+", "_", value.strip())
    return safe[:180] or "cache"


def cache_path(key: str) -> Path:
    return _cache_root() / f"{_safe_key(key)}.json"


def _parse_time(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value)
    except ValueError:
        return None


def payload_age_seconds(payload: dict[str, Any], *, now: datetime | None = None) -> int | None:
    metadata = payload.get("metadata", {}) if isinstance(payload, dict) else {}
    fetched_at = _parse_time(metadata.get("fetched_at_utc"))
    if fetched_at is None:
        return None
    current = now or utc_now()
    return max(0, int((current - fetched_at).total_seconds()))


def with_freshness_metadata(
    payload: dict[str, Any],
    *,
    source: str,
    cache_status: str = "live",
    stale: bool = False,
    now: datetime | None = None,
) -> dict[str, Any]:
    current = now or utc_now()
    result = dict(payload)
    metadata = dict(result.get("metadata", {}))
    metadata.update(
        {
            "source": source,
            "fetched_at_utc": metadata.get("fetched_at_utc") or current.isoformat(),
            "cache_status": cache_status,
            "stale": stale,
        }
    )
    fetched_at = _parse_time(metadata.get("fetched_at_utc"))
    metadata["age_seconds"] = max(0, int((current - fetched_at).total_seconds())) if fetched_at else None
    result["metadata"] = metadata
    if "source" not in result:
        result["source"] = source
    return result


def write_cache(key: str, payload: dict[str, Any], *, source: str) -> dict[str, Any]:
    cached = with_freshness_metadata(payload, source=source, cache_status="live", stale=False)
    path = cache_path(key)
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as handle:
        json.dump(cached, handle, sort_keys=True)
    return cached


def read_cache(key: str, *, stale_after_seconds: int = DEFAULT_STALE_AFTER_SECONDS) -> dict[str, Any] | None:
    path = cache_path(key)
    if not path.exists():
        return None
    try:
        with path.open("r", encoding="utf-8") as handle:
            payload = json.load(handle)
    except (OSError, json.JSONDecodeError):
        return None
    age = payload_age_seconds(payload)
    stale = age is None or age > stale_after_seconds
    metadata = dict(payload.get("metadata", {}))
    metadata.update({"cache_status": "cached", "stale": stale, "age_seconds": age})
    cached = dict(payload)
    cached["metadata"] = metadata
    return cached


def fallback_from_cache(
    key: str,
    error_payload: dict[str, Any],
    *,
    stale_after_seconds: int = DEFAULT_STALE_AFTER_SECONDS,
) -> dict[str, Any]:
    cached = read_cache(key, stale_after_seconds=stale_after_seconds)
    if cached is None:
        miss = dict(error_payload)
        metadata = dict(miss.get("metadata", {}))
        metadata.update({"cache_status": "miss", "stale": True, "fetched_at_utc": utc_now_iso(), "age_seconds": None})
        miss["metadata"] = metadata
        return miss
    metadata = dict(cached.get("metadata", {}))
    metadata.update({"cache_status": "stale", "stale": True, "fallback_error": error_payload.get("error")})
    cached["metadata"] = metadata
    return cached
