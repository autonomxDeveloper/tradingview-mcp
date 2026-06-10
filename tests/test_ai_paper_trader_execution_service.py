from __future__ import annotations

import importlib

import pytest

from tradingview_mcp.core.services.ai_paper_trader_execution_service import execute_ai_paper_trader_decision


def load_paper_service(monkeypatch, tmp_path):
    state_path = tmp_path / "paper_state.json"
    monkeypatch.setenv("TRADING_WORKSTATION_PAPER_TRADING", str(state_path))
    paper_service = importlib.import_module("tradingview_mcp.core.services.paper_trading_service")
    execution_service = importlib.import_module("tradingview_mcp.core.services.ai_paper_trader_execution_service")
    importlib.reload(paper_service)
    importlib.reload(execution_service)
    return paper_service, execution_service


def valid_open_decision(**overrides):
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


def test_execute_rejects_guardrail_warnings(monkeypatch, tmp_path):
    _paper_service, execution_service = load_paper_service(monkeypatch, tmp_path)
    decision = valid_open_decision(guardrail_warnings=["blocked by test"])

    result = execution_service.execute_ai_paper_trader_decision(decision, symbol="AAPL")

    assert result["executed"] is False
    assert result["execution_submitted"] is False
    assert result["paper_only"] is True
    assert result["live_execution"] is False
    assert "guardrail" in result["reason"]


def test_execute_rejects_missing_paper_only_boundary(monkeypatch, tmp_path):
    _paper_service, execution_service = load_paper_service(monkeypatch, tmp_path)
    decision = valid_open_decision(paper_only=False)

    result = execution_service.execute_ai_paper_trader_decision(decision, symbol="AAPL")

    assert result["executed"] is False
    assert result["execution_submitted"] is False
    assert "paper-only" in result["reason"]


def test_execute_open_trade_submits_local_paper_order_only(monkeypatch, tmp_path):
    paper_service, execution_service = load_paper_service(monkeypatch, tmp_path)
    paper_service.reset_paper_account(initial_cash=1000)

    result = execution_service.execute_ai_paper_trader_decision(
        valid_open_decision(),
        symbol="AAPL",
        asset_type="stock",
        idea_id="idea-1",
        notes="unit test ai paper execution",
    )

    assert result["executed"] is True
    assert result["execution_action"] == "submitted_open_order"
    assert result["execution_submitted"] is True
    assert result["paper_only"] is True
    assert result["live_execution"] is False
    assert result["order"]["symbol"] == "AAPL"
    assert result["order"]["side"] == "buy"
    assert result["order"]["quantity"] == 2
    assert result["order"]["simulated"] is True
    assert result["order"]["live_execution"] is False
    assert result["decision"]["execution_submitted"] is True


def test_execute_open_trade_can_optionally_fill_market_order(monkeypatch, tmp_path):
    paper_service, execution_service = load_paper_service(monkeypatch, tmp_path)
    paper_service.reset_paper_account(initial_cash=1000)

    result = execution_service.execute_ai_paper_trader_decision(
        valid_open_decision(),
        symbol="AAPL",
        fill_market_orders=True,
        fill_price=100,
    )

    assert result["executed"] is True
    assert result["fill_result"]["fill"]["notional"] == 200
    assert result["account"]["account"]["cash"] == pytest.approx(800)
    assert result["account"]["positions"][0]["symbol"] == "AAPL"


def test_execute_prevents_duplicate_open_orders_for_symbol(monkeypatch, tmp_path):
    paper_service, execution_service = load_paper_service(monkeypatch, tmp_path)
    paper_service.reset_paper_account(initial_cash=1000)
    first = execution_service.execute_ai_paper_trader_decision(valid_open_decision(), symbol="AAPL")
    second = execution_service.execute_ai_paper_trader_decision(valid_open_decision(), symbol="AAPL")

    assert first["executed"] is True
    assert second["executed"] is False
    assert "already has open paper orders" in second["reason"]


def test_execute_close_trade_submits_local_sell_order(monkeypatch, tmp_path):
    paper_service, execution_service = load_paper_service(monkeypatch, tmp_path)
    paper_service.reset_paper_account(initial_cash=1000)
    buy = paper_service.submit_paper_order("AAPL", "buy", 3)
    paper_service.fill_paper_order(buy["id"], fill_price=100)

    close_decision = valid_open_decision(
        action="close_trade",
        side="sell",
        quantity=0,
        paper_trade_candidate=False,
    )
    result = execution_service.execute_ai_paper_trader_decision(close_decision, symbol="AAPL")

    assert result["executed"] is True
    assert result["execution_action"] == "submitted_close_order"
    assert result["order"]["side"] == "sell"
    assert result["order"]["quantity"] == 3
    assert result["paper_only"] is True
    assert result["live_execution"] is False


def test_execute_no_trade_can_cancel_open_orders_when_requested(monkeypatch, tmp_path):
    paper_service, execution_service = load_paper_service(monkeypatch, tmp_path)
    paper_service.reset_paper_account(initial_cash=1000)
    paper_service.submit_paper_order("AAPL", "buy", 1)

    no_trade = valid_open_decision(action="no_trade", side="none", quantity=0, paper_trade_candidate=False)
    result = execution_service.execute_ai_paper_trader_decision(
        no_trade,
        symbol="AAPL",
        cancel_open_orders_on_no_trade=True,
    )

    assert result["executed"] is True
    assert result["execution_action"] == "cancelled_open_orders"
    assert result["cancelled_orders"][0]["status"] == "cancelled"
    assert result["execution_submitted"] is False
    assert result["live_execution"] is False
