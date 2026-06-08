from __future__ import annotations

from fastapi.testclient import TestClient

from tradingview_mcp.workstation_event_app import create_event_enabled_app


def test_event_enabled_app_status(monkeypatch, tmp_path):
    monkeypatch.setenv("TRADING_WORKSTATION_EVENT_INBOX", str(tmp_path / "events.jsonl"))

    client = TestClient(create_event_enabled_app())
    response = client.get("/api/events/status")

    assert response.status_code == 200
    payload = response.json()
    assert payload["mode"] == "research_only"
    assert "manual" in payload["supported_sources"]


def test_event_enabled_app_create_and_list(monkeypatch, tmp_path):
    monkeypatch.setenv("TRADING_WORKSTATION_EVENT_INBOX", str(tmp_path / "events.jsonl"))

    client = TestClient(create_event_enabled_app())
    created = client.post(
        "/api/events",
        json={
            "source": "manual",
            "symbol": "ethusdt",
            "timeframe": "1H",
            "kind": "note",
            "message": "review prior range",
        },
    )

    assert created.status_code == 200
    event = created.json()
    assert event["research_only"] is True
    assert event["symbol"] == "ETHUSDT"

    listed = client.get("/api/events", params={"symbol": "ETHUSDT"})
    assert listed.status_code == 200
    assert [row["id"] for row in listed.json()["events"]] == [event["id"]]
