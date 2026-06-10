from __future__ import annotations

from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SERVICE = ROOT / "src" / "tradingview_mcp" / "core" / "services" / "paper_trading_service.py"
APP = ROOT / "src" / "tradingview_mcp" / "workstation_app.py"
PAPER_UI = ROOT / "src" / "tradingview_mcp" / "workstation_static" / "paper_trading_module.js"


def read(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def test_paper_trading_service_is_simulation_only_and_local():
    service = read(SERVICE)
    assert "Simulated paper-trading account storage" in service
    assert "does not place live broker orders" in service
    assert "TRADING_WORKSTATION_PAPER_TRADING" in service
    assert "execution_enabled" in service
    assert "paper_simulation_enabled" in service
    assert "live_execution" in service
    assert "data/workstation_paper_trading.json" in service


def test_paper_trading_service_exposes_accounting_and_safety_helpers():
    service = read(SERVICE)
    for function_name in [
        "reset_paper_account",
        "read_paper_state",
        "submit_paper_order",
        "fill_paper_order",
        "cancel_paper_order",
        "paper_account_snapshot",
        "list_paper_orders",
        "list_paper_fills",
        "paper_trading_status",
    ]:
        assert f"def {function_name}" in service

    for validation in [
        "quantity must be greater than zero",
        "unsupported paper order side",
        "unsupported paper order type",
        "insufficient paper cash",
        "sell quantity exceeds open paper position",
    ]:
        assert validation in service


def test_paper_trading_api_routes_are_paper_only():
    app = read(APP)
    for route in [
        '"/api/paper/account"',
        '"/api/paper/account/mark-to-market"',
        '"/api/paper/positions"',
        '"/api/paper/orders"',
        '"/api/paper/fills"',
        '"/api/paper/reset"',
        '"/api/paper/orders/{order_id}/fill"',
        '"/api/paper/orders/{order_id}/cancel"',
    ]:
        assert route in app
    assert "paper_only" in app
    assert "live_execution" in app
    assert "paper_order_submitted" in app
    assert "paper_order_filled" in app
    assert "paper_order_cancelled" in app


def test_paper_trading_ui_calls_only_paper_endpoints_and_exports_state():
    module = read(PAPER_UI)
    assert "window.paperTradingState" in module
    for endpoint in [
        "/api/paper/account",
        "/api/paper/orders",
        "/api/paper/fills",
        "/api/paper/reset",
        "/api/paper/account/mark-to-market",
    ]:
        assert endpoint in module
    assert "window.submitPaperOrder" in module
    assert "window.fillPaperOrder" in module
    assert "window.cancelPaperOrder" in module
    assert "live_execution: false" in module
