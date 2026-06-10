from __future__ import annotations

from fastapi.testclient import TestClient

from tradingview_mcp.workstation_app import create_app


def test_default_app_exposes_ai_paper_schedule_routes(monkeypatch, tmp_path):
    monkeypatch.setenv("TRADING_WORKSTATION_AI_PAPER_SCHEDULES", str(tmp_path / "schedules.json"))
    monkeypatch.setenv("TRADING_WORKSTATION_JOURNAL", str(tmp_path / "journal.jsonl"))
    client = TestClient(create_app())

    create_response = client.post(
        "/api/ai/paper-trader/schedules",
        json={
            "name": "Market open AAPL",
            "symbols": ["AAPL"],
            "asset_type": "stock",
            "exchange": "NASDAQ",
            "timeframe": "5m",
            "trigger": {"type": "market_open", "time_utc": "14:30", "offset_minutes": 5},
            "risk": {"require_market_open": True},
            "execution": {"fill_market_orders": True, "auto_execute": True},
        },
    )
    created = create_response.json()

    assert create_response.status_code == 200
    assert created["paper_only"] is True
    assert created["live_execution"] is False
    schedule = created["schedule"]
    assert schedule["name"] == "Market open AAPL"
    assert schedule["execution"]["auto_execute"] is False

    list_response = client.get("/api/ai/paper-trader/schedules")
    listed = list_response.json()
    assert listed["schedules"][0]["id"] == schedule["id"]
    assert listed["status"]["background_loop_enabled"] is False

    run_response = client.post(f"/api/ai/paper-trader/schedules/{schedule['id']}/run-request")
    run_payload = run_response.json()
    assert run_response.status_code == 200
    assert run_payload["decision_request"]["symbol"] == "AAPL"
    assert run_payload["decision_request"]["paper_only"] is True
    assert run_payload["decision_request"]["live_execution"] is False
    assert run_payload["background_loop_enabled"] is False

    record_response = client.post(f"/api/ai/paper-trader/schedules/{schedule['id']}/record-run", json={"result": {"action": "no_trade"}})
    record_payload = record_response.json()
    assert record_response.status_code == 200
    assert record_payload["schedule"]["run_count"] == 1
    assert record_payload["paper_only"] is True
    assert record_payload["live_execution"] is False


def test_schedule_routes_report_missing_schedule(monkeypatch, tmp_path):
    monkeypatch.setenv("TRADING_WORKSTATION_AI_PAPER_SCHEDULES", str(tmp_path / "schedules.json"))
    client = TestClient(create_app())

    response = client.post("/api/ai/paper-trader/schedules/missing/run-request")
    payload = response.json()

    assert response.status_code == 200
    assert payload["error"]["code"] == "AI_PAPER_SCHEDULE_NOT_FOUND"
    assert payload["error"]["schedule_id"] == "missing"
