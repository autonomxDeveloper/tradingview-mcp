from __future__ import annotations

from fastapi.testclient import TestClient

from tradingview_mcp.workstation_app import create_app


def test_default_app_exposes_ai_paper_performance_route(monkeypatch, tmp_path):
    monkeypatch.setenv("TRADING_WORKSTATION_JOURNAL", str(tmp_path / "journal.jsonl"))
    client = TestClient(create_app())

    response = client.post(
        "/api/ai/paper-trader/performance",
        json={
            "replay": {
                "replays": [
                    {
                        "symbol": "AAPL",
                        "action": "open_trade",
                        "side": "buy",
                        "outcome": "win",
                        "exit_reason": "target_hit",
                        "realized_pnl": 10,
                        "realized_pnl_pct": 5,
                    }
                ]
            },
            "decision_history": [
                {"symbol": "AAPL", "action": "open_trade", "side": "buy", "confidence": "high", "paper_trade_candidate": True}
            ],
            "groups": ["symbol", "confidence"],
        },
    )
    payload = response.json()

    assert response.status_code == 200
    assert payload["summary"]["decision_count"] == 1
    assert payload["summary"]["win_count"] == 1
    assert payload["summary"]["win_rate"] == 1
    assert payload["groups"]["symbol"][0]["key"] == "AAPL"
    assert payload["groups"]["confidence"][0]["key"] == "high"
    assert payload["paper_only"] is True
    assert payload["live_execution"] is False
    assert payload["execution_submitted"] is False
    assert payload["background_loop_enabled"] is False
    assert payload["read_only"] is True
