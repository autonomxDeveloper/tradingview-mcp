from __future__ import annotations

import importlib.util
from pathlib import Path

import pytest


ROOT = Path(__file__).resolve().parents[1]
SERVICE_PATH = ROOT / "src" / "tradingview_mcp" / "core" / "services" / "paper_trading_service.py"


def load_service(monkeypatch, tmp_path):
    state_path = tmp_path / "paper_state.json"
    monkeypatch.setenv("TRADING_WORKSTATION_PAPER_TRADING", str(state_path))
    spec = importlib.util.spec_from_file_location("paper_trading_service_under_test", SERVICE_PATH)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_paper_account_buy_fill_and_mark_to_market(monkeypatch, tmp_path):
    service = load_service(monkeypatch, tmp_path)

    state = service.reset_paper_account(initial_cash=1_000, currency="usd")
    assert state["execution_enabled"] is False
    assert state["paper_simulation_enabled"] is True
    assert state["account"]["cash"] == 1_000
    assert state["account"]["currency"] == "USD"

    order = service.submit_paper_order(
        symbol=" aapl ",
        side="buy",
        quantity=2,
        order_type="market",
        asset_type="stock",
        idea_id="idea-1",
        notes="unit test",
    )
    assert order["symbol"] == "AAPL"
    assert order["status"] == "open"
    assert order["simulated"] is True
    assert order["live_execution"] is False

    result = service.fill_paper_order(order["id"], fill_price=100, source="pytest")
    assert result["order"]["status"] == "filled"
    assert result["fill"]["notional"] == 200
    assert result["fill"]["simulated"] is True
    assert result["fill"]["live_execution"] is False

    snapshot = service.paper_account_snapshot(mark_prices={"AAPL": 125})
    assert snapshot["execution_enabled"] is False
    assert snapshot["paper_simulation_enabled"] is True
    assert snapshot["account"]["cash"] == 800
    assert snapshot["account"]["market_value"] == 250
    assert snapshot["account"]["equity"] == 1_050
    assert snapshot["account"]["unrealized_pnl"] == 50
    assert len(snapshot["positions"]) == 1
    position = snapshot["positions"][0]
    assert position["symbol"] == "AAPL"
    assert position["quantity"] == pytest.approx(2)
    assert position["average_price"] == pytest.approx(100)
    assert position["realized_pnl"] == pytest.approx(0)
    assert position["mark_price"] == pytest.approx(125)
    assert position["market_value"] == pytest.approx(250)
    assert position["unrealized_pnl"] == pytest.approx(50)


def test_paper_account_sell_realizes_pnl_and_removes_flat_position(monkeypatch, tmp_path):
    service = load_service(monkeypatch, tmp_path)
    service.reset_paper_account(initial_cash=1_000)

    buy = service.submit_paper_order("MSFT", "buy", 4)
    service.fill_paper_order(buy["id"], fill_price=50)

    sell = service.submit_paper_order("MSFT", "sell", 4)
    result = service.fill_paper_order(sell["id"], fill_price=75)

    assert result["order"]["status"] == "filled"
    assert result["fill"]["realized_pnl"] == 100
    snapshot = service.paper_account_snapshot(mark_prices={"MSFT": 75})
    assert snapshot["positions"] == []
    assert snapshot["account"]["cash"] == 1_100
    assert snapshot["account"]["equity"] == 1_100
    assert snapshot["account"]["realized_pnl"] == 100


def test_paper_order_validation_and_cancel(monkeypatch, tmp_path):
    service = load_service(monkeypatch, tmp_path)
    service.reset_paper_account(initial_cash=500)

    with pytest.raises(ValueError, match="quantity must be greater than zero"):
        service.submit_paper_order("BTCUSDT", "buy", 0, asset_type="crypto")

    with pytest.raises(ValueError, match="limit_price is required"):
        service.submit_paper_order("BTCUSDT", "buy", 1, order_type="limit", asset_type="crypto")

    with pytest.raises(ValueError, match="unsupported paper order side"):
        service.submit_paper_order("BTCUSDT", "hold", 1, asset_type="crypto")

    order = service.submit_paper_order("BTCUSDT", "buy", 0.01, asset_type="crypto")
    cancelled = service.cancel_paper_order(order["id"])
    assert cancelled["status"] == "cancelled"

    with pytest.raises(ValueError, match="paper order is not open"):
        service.fill_paper_order(order["id"], fill_price=50_000)


def test_paper_account_rejects_insufficient_cash_and_oversell(monkeypatch, tmp_path):
    service = load_service(monkeypatch, tmp_path)
    service.reset_paper_account(initial_cash=100)

    too_large = service.submit_paper_order("AAPL", "buy", 2)
    with pytest.raises(ValueError, match="insufficient paper cash"):
        service.fill_paper_order(too_large["id"], fill_price=100)

    with pytest.raises(ValueError, match="sell quantity exceeds open paper position"):
        sell = service.submit_paper_order("AAPL", "sell", 1)
        service.fill_paper_order(sell["id"], fill_price=100)
