from __future__ import annotations

from fastapi import FastAPI
from fastapi.testclient import TestClient

from tradingview_mcp.workstation_event_routes import register_research_event_routes


def _client(monkeypatch, tmp_path) -> TestClient:
    monkeypatch.setenv("TRADING_WORKSTATION_EVENT_INBOX", str(tmp_path / "events.jsonl"))
    app = FastAPI()
    register_research_event_routes(app)
    return TestClient(app)


def test_event_routes_create_and_list(monkeypatch, tmp_path):
    client = _client(monkeypatch, tmp_path)

    created = client.post(
        "/api/events",
        json={
            "source": "manual",
            "symbol": "aapl",
            "timeframe": "1D",
            "kind": "note",
            "message": "watch prior high",
            "metadata": {"level": 123.45},
        },
    )

    assert created.status_code == 200
    payload = created.json()
    assert payload["research_only"] is True
    assert payload["symbol"] == "AAPL"

    listed = client.get("/api/events", params={"symbol": "AAPL"})
    assert listed.status_code == 200
    assert [row["id"] for row in listed.json()["events"]] == [payload["id"]]


def test_event_routes_status(monkeypatch, tmp_path):
    client = _client(monkeypatch, tmp_path)

    response = client.get("/api/events/status")

    assert response.status_code == 200
    payload = response.json()
    assert payload["mode"] == "research_only"
    assert "manual" in payload["supported_sources"]
