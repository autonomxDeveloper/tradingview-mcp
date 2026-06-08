from __future__ import annotations

from datetime import datetime, timedelta, timezone

from tradingview_mcp.core.services import market_data_cache_service


def test_cache_write_and_read_round_trip(monkeypatch, tmp_path):
    monkeypatch.setenv("TRADING_WORKSTATION_MARKET_CACHE", str(tmp_path / "cache"))

    written = market_data_cache_service.write_cache("test:key", {"value": 1}, source="unit_test")
    cached = market_data_cache_service.read_cache("test:key")

    assert written["metadata"]["source"] == "unit_test"
    assert written["metadata"]["cache_status"] == "live"
    assert cached is not None
    assert cached["value"] == 1
    assert cached["metadata"]["cache_status"] == "cached"
    assert cached["metadata"]["stale"] is False


def test_cache_stale_detection(monkeypatch, tmp_path):
    monkeypatch.setenv("TRADING_WORKSTATION_MARKET_CACHE", str(tmp_path / "cache"))
    old_time = (datetime.now(timezone.utc) - timedelta(hours=2)).isoformat()
    payload = {"value": 1, "metadata": {"fetched_at_utc": old_time}}
    market_data_cache_service.write_cache("old:key", payload, source="unit_test")

    cached = market_data_cache_service.read_cache("old:key", stale_after_seconds=60)

    assert cached is not None
    assert cached["metadata"]["stale"] is True
    assert cached["metadata"]["age_seconds"] >= 60


def test_fallback_returns_cache_when_present(monkeypatch, tmp_path):
    monkeypatch.setenv("TRADING_WORKSTATION_MARKET_CACHE", str(tmp_path / "cache"))
    market_data_cache_service.write_cache("fallback:key", {"value": 5}, source="unit_test")

    fallback = market_data_cache_service.fallback_from_cache(
        "fallback:key",
        {"error": {"code": "UPSTREAM_ERROR", "message": "provider failed"}},
    )

    assert fallback["value"] == 5
    assert fallback["metadata"]["cache_status"] == "stale"
    assert fallback["metadata"]["stale"] is True
    assert fallback["metadata"]["fallback_error"]["code"] == "UPSTREAM_ERROR"


def test_fallback_returns_miss_when_no_cache(monkeypatch, tmp_path):
    monkeypatch.setenv("TRADING_WORKSTATION_MARKET_CACHE", str(tmp_path / "cache"))

    fallback = market_data_cache_service.fallback_from_cache(
        "missing:key",
        {"error": {"code": "REQUEST_FAILED", "message": "network"}},
    )

    assert fallback["error"]["code"] == "REQUEST_FAILED"
    assert fallback["metadata"]["cache_status"] == "miss"
    assert fallback["metadata"]["stale"] is True
