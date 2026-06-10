from __future__ import annotations

from fastapi.testclient import TestClient

from tradingview_mcp.workstation_app import create_app


def test_default_app_exposes_ai_paper_replay_route(monkeypatch, tmp_path):
    monkeypatch.setenv("TRADING_WORKSTATION_JOURNAL", str(tmp_path / "journal.jsonl"))
    client = TestClient(create_app())

    response = client.post(
        "/api/ai/paper-trader/replay",
        json={
            "decisions": [
                {
                    "symbol": "AAPL",
                    "decision": {
                        "action": "open_trade",
                        "side": "buy",
                        "quantity": 1,
                        "order_type": "market",
                        "limit_price": 100,
                        "take_profit": 105,
                        "stop_price": 95,
                    },
                }
            ],
            "marks_by_symbol": {
                "AAPL": [
                    {"timestamp": "2026-06-10T14:30:00Z", "high": 104, "low": 99, "close": 102},
                    {"timestamp": "2026-06-10T15:30:00Z", "high": 106, "low": 101, "close": 105},
                ]
            },
        },
    )
    payload = response.json()

    assert response.status_code == 200
    assert payload["paper_only"] is True
    assert payload["live_execution"] is False
    assert payload["execution_submitted"] is False
    assert payload["replay"]["summary"]["win_count"] == 1
    assert payload["replay"]["summary"]["total_realized_pnl"] == 5
    assert payload["replay"]["background_loop_enabled"] is False
    assert payload["journal_event"]["event_type"] == "ai_paper_trader_replay"


def test_replay_route_does_not_require_decisions(monkeypatch, tmp_path):
    monkeypatch.setenv("TRADING_WORKSTATION_JOURNAL", str(tmp_path / "journal.jsonl"))
    client = TestClient(create_app())

    response = client.post("/api/ai/paper-trader/replay", json={"decisions": [], "marks_by_symbol": {}})
    payload = response.json()

    assert response.status_code == 200
    assert payload["replay"]["summary"]["decision_count"] == 0
    assert payload["paper_only"] is True
    assert payload["live_execution"] is False
    assert payload["execution_submitted"] is False
