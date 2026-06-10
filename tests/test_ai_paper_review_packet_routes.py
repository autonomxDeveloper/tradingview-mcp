from __future__ import annotations

from fastapi.testclient import TestClient

from tradingview_mcp.core.services.workstation_journal_service import append_journal_event
from tradingview_mcp.workstation_app import create_app


def test_default_app_exposes_ai_paper_review_packet_route(monkeypatch, tmp_path):
    monkeypatch.setenv("TRADING_WORKSTATION_JOURNAL", str(tmp_path / "journal.jsonl"))
    append_journal_event(
        "ai_paper_trader_decision",
        {
            "context": {"symbol": "AAPL", "asset_type": "stock"},
            "decision": {
                "symbol": "AAPL",
                "action": "open_trade",
                "side": "buy",
                "quantity": 1,
                "entry_price": 100,
                "take_profit": 105,
                "stop_price": 95,
                "confidence": "medium",
                "paper_only": True,
                "live_execution": False,
                "execution_submitted": False,
            },
        },
    )
    client = TestClient(create_app())

    response = client.post(
        "/api/ai/paper-trader/review-packet",
        json={
            "limit": 10,
            "marks_by_symbol": {"AAPL": [{"timestamp": "2026-01-01T00:00:00Z", "close": 100, "high": 106, "low": 99}]},
            "groups": ["symbol", "confidence", "outcome"],
        },
    )
    payload = response.json()

    assert response.status_code == 200
    assert payload["packet_type"] == "ai_paper_review_packet"
    assert payload["summary"]["decision_count"] == 1
    assert payload["summary"]["replayed_count"] == 1
    assert payload["performance"]["groups"]["symbol"][0]["key"] == "AAPL"
    assert payload["paper_only"] is True
    assert payload["live_execution"] is False
    assert payload["execution_submitted"] is False
    assert payload["background_loop_enabled"] is False
    assert payload["read_only"] is True
