from __future__ import annotations

from fastapi.testclient import TestClient

from tradingview_mcp.workstation_app import create_app


def test_default_app_exposes_ai_paper_lifecycle_route(monkeypatch, tmp_path):
    monkeypatch.setenv("TRADING_WORKSTATION_PAPER_TRADING", str(tmp_path / "paper.json"))
    monkeypatch.setenv("TRADING_WORKSTATION_JOURNAL", str(tmp_path / "journal.jsonl"))

    from tradingview_mcp.core.services import paper_trading_service

    paper_trading_service.reset_paper_account(initial_cash=1000)
    order = paper_trading_service.submit_paper_order("AAPL", "buy", 2, "market", "stock")
    paper_trading_service.fill_paper_order(order["id"], 100)

    response = TestClient(create_app()).post(
        "/api/ai/paper-trader/lifecycle",
        json={
            "market_context": {
                "symbol": "AAPL",
                "summary": {"latest_close": 92, "trend_alignment": "bearish_aligned", "momentum_votes": ["bearish"]},
                "paper_only": True,
                "live_execution": False,
            },
            "risk": {"max_unrealized_loss_pct": 5},
        },
    )
    payload = response.json()

    assert response.status_code == 200
    assert payload["paper_only"] is True
    assert payload["live_execution"] is False
    assert payload["execution_submitted"] is False
    assert payload["lifecycle"]["summary"]["requires_attention"] is True
    assert payload["lifecycle"]["position_reviews"][0]["recommendation"] == "review_close"
    assert payload["journal_event"]["event_type"] == "ai_paper_trader_lifecycle_review"


def test_lifecycle_route_accepts_marks_without_market_context(monkeypatch, tmp_path):
    monkeypatch.setenv("TRADING_WORKSTATION_PAPER_TRADING", str(tmp_path / "paper.json"))
    monkeypatch.setenv("TRADING_WORKSTATION_JOURNAL", str(tmp_path / "journal.jsonl"))

    from tradingview_mcp.core.services import paper_trading_service

    paper_trading_service.reset_paper_account(initial_cash=1000)
    order = paper_trading_service.submit_paper_order("MSFT", "buy", 1, "market", "stock")
    paper_trading_service.fill_paper_order(order["id"], 100)

    response = TestClient(create_app()).post(
        "/api/ai/paper-trader/lifecycle",
        json={"marks": {"MSFT": 112}, "risk": {"take_profit_review_pct": 8}},
    )
    payload = response.json()

    assert response.status_code == 200
    assert payload["lifecycle"]["position_reviews"][0]["recommendation"] == "take_profit_review"
    assert payload["lifecycle"]["position_reviews"][0]["mark_price"] == 112
    assert payload["paper_only"] is True
    assert payload["live_execution"] is False
