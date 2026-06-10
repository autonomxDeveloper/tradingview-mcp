from __future__ import annotations

from fastapi.testclient import TestClient

from tradingview_mcp.core.services.workstation_journal_service import append_journal_event
from tradingview_mcp.workstation_app import create_app


def test_default_app_exposes_read_only_ai_paper_decision_history(monkeypatch, tmp_path):
    monkeypatch.setenv("TRADING_WORKSTATION_JOURNAL", str(tmp_path / "journal.jsonl"))
    append_journal_event(
        "ai_paper_trader_decision",
        {
            "request": {"symbol": "AAPL", "timeframe": "1D"},
            "context": {"symbol": "AAPL", "asset_type": "stock", "active_timeframe": "1D"},
            "decision": {
                "action": "open_trade",
                "side": "buy",
                "quantity": 1,
                "order_type": "market",
                "paper_trade_candidate": True,
                "paper_only": True,
                "live_execution": False,
                "guardrail_warnings": [],
            },
        },
    )

    response = TestClient(create_app()).get("/api/ai/paper-trader/decision-history?limit=5&symbol=AAPL")
    payload = response.json()

    assert response.status_code == 200
    assert payload["paper_only"] is True
    assert payload["live_execution"] is False
    assert payload["execution_submitted"] is False
    assert payload["background_loop_enabled"] is False
    assert payload["read_only"] is True
    assert payload["summary"]["decision_count"] == 1
    assert payload["decisions"][0]["symbol"] == "AAPL"
    assert payload["replay_records"][0]["decision"]["action"] == "open_trade"


def test_decision_history_route_filters_non_trade(monkeypatch, tmp_path):
    monkeypatch.setenv("TRADING_WORKSTATION_JOURNAL", str(tmp_path / "journal.jsonl"))
    append_journal_event(
        "ai_paper_trader_decision",
        {"request": {"symbol": "AAPL"}, "decision": {"action": "no_trade", "side": "none", "paper_only": True, "live_execution": False}},
    )

    response = TestClient(create_app()).get("/api/ai/paper-trader/decision-history?include_non_trade=false")
    payload = response.json()

    assert response.status_code == 200
    assert payload["summary"]["decision_count"] == 0
    assert payload["replay_records"] == []
