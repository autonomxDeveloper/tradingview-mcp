from __future__ import annotations

from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
APP = ROOT / "src" / "tradingview_mcp" / "workstation_app.py"
SERVICE = ROOT / "src" / "tradingview_mcp" / "core" / "services" / "ai_paper_trader_service.py"


def read(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def test_ai_paper_trader_endpoint_is_decision_only():
    app = read(APP)
    assert '"/api/ai/paper-trader/decision"' in app
    assert "PaperTraderDecisionRequest" in app
    assert "build_ai_paper_trader_context" in app
    assert "parse_ai_paper_trader_decision" in app
    assert "validate_ai_paper_trader_decision" in app
    assert "ai_paper_trader_decision" in app
    assert "execution_submitted" in app
    assert "False" in app[app.index("ai_paper_trader_decision") : app.index("@app.post(\"/api/backtest/run\")")]


def test_ai_paper_trader_service_preserves_paper_boundary():
    service = read(SERVICE)
    assert "never submits live or simulated orders" in service
    assert "execution_adapter_enabled" in service
    assert "paper_only" in service
    assert "live_execution" in service
    assert "open_trade | close_trade | hold | no_trade" in service
    assert "validate_ai_paper_trader_decision" in service
