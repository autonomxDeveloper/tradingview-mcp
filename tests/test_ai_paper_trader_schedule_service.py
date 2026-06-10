from __future__ import annotations

import importlib
from datetime import datetime, timezone


def load_service(monkeypatch, tmp_path):
    monkeypatch.setenv("TRADING_WORKSTATION_AI_PAPER_SCHEDULES", str(tmp_path / "schedules.json"))
    module = importlib.import_module("tradingview_mcp.core.services.ai_paper_trader_schedule_service")
    return importlib.reload(module)


def test_create_interval_schedule_persists_paper_only_defaults(monkeypatch, tmp_path):
    service = load_service(monkeypatch, tmp_path)
    now = datetime(2026, 6, 10, 14, 0, tzinfo=timezone.utc)

    schedule = service.create_ai_paper_schedule(
        {
            "name": "Open scan",
            "symbols": ["aapl", "AAPL", "msft"],
            "asset_type": "stock",
            "trigger": {"type": "interval", "interval_minutes": 30},
            "risk": {"max_position_value": 500},
        },
        now=now,
    )

    assert schedule["name"] == "Open scan"
    assert schedule["symbols"] == ["AAPL", "MSFT"]
    assert schedule["paper_only"] is True
    assert schedule["live_execution"] is False
    assert schedule["execution"]["auto_execute"] is False
    assert schedule["next_run_at"] == "2026-06-10T14:30:00+00:00"
    assert service.list_ai_paper_schedules()[0]["id"] == schedule["id"]


def test_market_open_schedule_uses_weekday_utc_open_with_offset(monkeypatch, tmp_path):
    service = load_service(monkeypatch, tmp_path)
    friday_after_open = datetime(2026, 6, 12, 16, 0, tzinfo=timezone.utc)

    schedule = service.create_ai_paper_schedule(
        {
            "symbols": ["SPY"],
            "trigger": {"type": "market_open", "time_utc": "14:30", "offset_minutes": 5, "market": "US"},
        },
        now=friday_after_open,
    )

    assert schedule["trigger"]["type"] == "market_open"
    assert schedule["next_run_at"] == "2026-06-15T14:35:00+00:00"


def test_due_schedules_and_record_run_advance_next_run(monkeypatch, tmp_path):
    service = load_service(monkeypatch, tmp_path)
    created_at = datetime(2026, 6, 10, 14, 0, tzinfo=timezone.utc)
    due_at = datetime(2026, 6, 10, 14, 31, tzinfo=timezone.utc)

    schedule = service.create_ai_paper_schedule(
        {"symbols": ["BTCUSDT"], "asset_type": "crypto", "trigger": {"type": "interval", "interval_minutes": 30}},
        now=created_at,
    )

    due = service.due_ai_paper_schedules(now=due_at)
    assert [item["id"] for item in due] == [schedule["id"]]

    updated = service.record_ai_paper_schedule_run(schedule["id"], {"decision": "no_trade"}, now=due_at)
    assert updated["run_count"] == 1
    assert updated["last_result"] == {"decision": "no_trade"}
    assert updated["next_run_at"] == "2026-06-10T15:01:00+00:00"


def test_build_run_request_is_decision_only_and_paper_only(monkeypatch, tmp_path):
    service = load_service(monkeypatch, tmp_path)
    schedule = service.create_ai_paper_schedule(
        {
            "name": "US open",
            "symbols": ["AAPL", "NVDA"],
            "asset_type": "stock",
            "exchange": "NASDAQ",
            "timeframe": "5m",
            "timeframes": ["5m", "15m", "1h"],
            "profile": "intraday_paper",
            "risk": {"require_market_open": True},
            "execution": {"fill_market_orders": True, "auto_execute": True},
        }
    )

    request = service.build_ai_paper_schedule_run_request(schedule, symbol="NVDA")

    assert request["symbol"] == "NVDA"
    assert request["asset_type"] == "stock"
    assert request["mode"] == "paper_trader_scheduled_decision"
    assert request["chart_context"]["schedule_id"] == schedule["id"]
    assert request["risk"] == {"require_market_open": True}
    assert request["paper_only"] is True
    assert request["live_execution"] is False
    assert request["execution"]["auto_execute"] is False


def test_update_and_delete_schedule(monkeypatch, tmp_path):
    service = load_service(monkeypatch, tmp_path)
    schedule = service.create_ai_paper_schedule({"name": "Draft", "symbols": ["AAPL"]})

    updated = service.update_ai_paper_schedule(schedule["id"], {"name": "Updated", "enabled": False, "symbols": ["MSFT"]})
    assert updated["name"] == "Updated"
    assert updated["enabled"] is False
    assert updated["symbols"] == ["MSFT"]

    result = service.delete_ai_paper_schedule(schedule["id"])
    assert result["deleted"] is True
    assert service.list_ai_paper_schedules() == []
