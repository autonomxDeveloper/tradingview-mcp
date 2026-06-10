from __future__ import annotations

import importlib

from fastapi.testclient import TestClient

from tradingview_mcp.workstation_ai_paper_execution_routes import register_ai_paper_execution_routes
from tradingview_mcp.workstation_app import create_app


def load_services(monkeypatch, tmp_path):
    state_path = tmp_path / "paper_state.json"
    journal_path = tmp_path / "journal.jsonl"
    monkeypatch.setenv("TRADING_WORKSTATION_PAPER_TRADING", str(state_path))
    monkeypatch.setenv("TRADING_WORKSTATION_JOURNAL", str(journal_path))
    paper_service = importlib.import_module("tradingview_mcp.core.services.paper_trading_service")
    execution_service = importlib.import_module("tradingview_mcp.core.services.ai_paper_trader_execution_service")
    journal_service = importlib.import_module("tradingview_mcp.core.services.workstation_journal_service")
    importlib.reload(paper_service)
    importlib.reload(execution_service)
    importlib.reload(journal_service)
    return paper_service, journal_service


def client_with_route():
    app = create_app()
    register_ai_paper_execution_routes(app)
    return TestClient(app)


def valid_decision(**overrides):
    decision = {
        "action": "open_trade",
        "side": "buy",
        "order_type": "market",
        "quantity": 2,
        "limit_price": None,
        "stop_price": 96,
        "take_profit": 110,
        "confidence": "medium",
        "risk_reward": "2:1",
        "reasoning_summary": "pullback held support",
        "invalidation": "close below 96",
        "risks": [],
        "required_confirmations": ["RSI reclaim"],
        "paper_trade_candidate": True,
        "not_financial_advice": True,
        "paper_only": True,
        "live_execution": False,
        "execution_submitted": False,
        "guardrail_warnings": [],
    }
    decision.update(overrides)
    return decision


def test_paper_execute_route_rejects_empty_decision(monkeypatch, tmp_path):
    load_services(monkeypatch, tmp_path)
    client = client_with_route()

    response = client.post("/api/ai/paper-trader/execute", json={"symbol": "AAPL", "decision": {}})

    assert response.status_code == 200
    payload = response.json()
    assert payload["error"]["code"] == "AI_PAPER_EXECUTION_REJECTED"
    assert payload["error"]["paper_only"] is True
    assert payload["error"]["live_execution"] is False


def test_paper_execute_route_submits_local_paper_order_only(monkeypatch, tmp_path):
    paper_service, journal_service = load_services(monkeypatch, tmp_path)
    paper_service.reset_paper_account(initial_cash=1000)
    client = client_with_route()

    response = client.post(
        "/api/ai/paper-trader/execute",
        json={
            "symbol": "AAPL",
            "asset_type": "stock",
            "decision": valid_decision(),
            "idea_id": "idea-1",
            "notes": "route test",
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["paper_only"] is True
    assert payload["live_execution"] is False
    assert payload["execution_submitted"] is True
    result = payload["result"]
    assert result["executed"] is True
    assert result["execution_action"] == "submitted_open_order"
    assert result["order"]["symbol"] == "AAPL"
    assert result["order"]["simulated"] is True
    assert result["order"]["live_execution"] is False
    events = journal_service.read_journal_events(limit=10)
    assert events[-1]["event_type"] == "ai_paper_trader_execution"
    assert events[-1]["payload"]["live_execution"] is False


def test_paper_execute_route_optionally_fills_market_order(monkeypatch, tmp_path):
    paper_service, _journal_service = load_services(monkeypatch, tmp_path)
    paper_service.reset_paper_account(initial_cash=1000)
    client = client_with_route()

    response = client.post(
        "/api/ai/paper-trader/execute",
        json={
            "symbol": "AAPL",
            "decision": valid_decision(),
            "fill_market_orders": True,
            "fill_price": 100,
        },
    )

    payload = response.json()
    assert payload["result"]["fill_result"]["fill"]["notional"] == 200
    assert payload["result"]["account"]["account"]["cash"] == 800
    assert payload["result"]["account"]["positions"][0]["symbol"] == "AAPL"


def test_paper_execute_route_preserves_adapter_rejections(monkeypatch, tmp_path):
    load_services(monkeypatch, tmp_path)
    client = client_with_route()

    response = client.post(
        "/api/ai/paper-trader/execute",
        json={"symbol": "AAPL", "decision": valid_decision(guardrail_warnings=["blocked"])} ,
    )

    payload = response.json()
    assert payload["paper_only"] is True
    assert payload["live_execution"] is False
    assert payload["execution_submitted"] is False
    assert payload["result"]["executed"] is False
    assert "guardrail" in payload["result"]["reason"]
