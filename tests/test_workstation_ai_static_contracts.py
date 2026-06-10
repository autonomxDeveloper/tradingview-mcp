from __future__ import annotations

from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
STATIC = ROOT / "src" / "tradingview_mcp" / "workstation_static"


AI_MODULES = [
    "ai_trade_idea_module.js",
    "ai_trade_workflow_module.js",
    "ai_backtest_generator_module.js",
    "ai_backtest_review_module.js",
    "ai_watchlist_scanner_module.js",
    "ai_paper_risk_module.js",
    "ai_paper_trader_module.js",
    "ai_trade_journal_coach_module.js",
    "ai_confidence_calibration_module.js",
]


def read_static(name: str) -> str:
    return (STATIC / name).read_text(encoding="utf-8")


def test_ai_modules_are_registered_and_loaded():
    registry = read_static("module_registry.js")
    for module in AI_MODULES:
        assert module in registry
        assert (STATIC / module).exists(), f"{module} should exist when registered"
        assert f"/static/{module}" in registry


def test_ai_trade_idea_contract_has_dedicated_endpoint_fallback_and_no_trade_support():
    module = read_static("ai_trade_idea_module.js")
    for expected in [
        "/api/ai/trade-idea",
        "/api/ai/analyze",
        "research_trade_idea",
        "no_trade",
        "not_financial_advice",
        "Do not force a trade",
        "Save AI idea",
        "Backtest this",
        "Prefill paper ticket",
    ]:
        assert expected in module


def test_ai_watchlist_scanner_contract_has_bounds_and_research_metadata():
    module = read_static("ai_watchlist_scanner_module.js")
    for expected in [
        "/api/ai/trade-idea",
        "watchlist_trade_scanner",
        "Math.max(1, Math.min(12",
        "no_trade",
        "no_live_orders",
        "simulated_only",
        "Load chart",
        "Save idea",
        "Backtest",
        "Prefill paper",
    ]:
        assert expected in module


def test_ai_paper_risk_review_wraps_submit_and_preserves_paper_boundary():
    module = read_static("ai_paper_risk_module.js")
    for expected in [
        "window.submitPaperOrder",
        "originalSubmit",
        "risk_verdict",
        "acceptable",
        "too_risky",
        "reject",
        "aiPaperRiskAck",
        "live_execution: false",
    ]:
        assert expected in module
    assert "no live broker order will be submitted" in module.lower()


def test_ai_paper_trader_ui_uses_decision_then_explicit_paper_execution():
    module = read_static("ai_paper_trader_module.js")
    registry = read_static("module_registry.js")
    bindings = read_static("ui_bindings.js")
    for expected in [
        "/api/ai/paper-trader/decision",
        "/api/ai/paper-trader/execute",
        "decisionIsExecutable",
        "aiPaperExecuteAck",
        "no live order will be placed",
        "paper_only: true",
        "live_execution: false",
        "execution_submitted",
        "Get AI paper decision",
        "Execute simulated paper decision",
    ]:
        assert expected in module
    assert "ai_paper_trader_module.js" in registry
    assert "aiPaperTrader.decision" in bindings
    assert "aiPaperTrader.execute" in bindings


def test_ai_journal_and_calibration_modules_track_review_outcomes_locally():
    journal = read_static("ai_trade_journal_coach_module.js")
    calibration = read_static("ai_confidence_calibration_module.js")
    for expected in ["review_verdict", "followed_plan", "rule_violation", "live_execution: false"]:
        assert expected in journal
    for expected in ["localStorage", "workstation.aiConfidenceCalibration.v1", "lastAiBacktestReview", "aiTradeJournalCoachState"]:
        assert expected in calibration


def test_ai_backtest_modules_cover_generation_and_review_contracts():
    generator = read_static("ai_backtest_generator_module.js")
    review = read_static("ai_backtest_review_module.js")
    for expected in ["Generate backtest plan", "no_live_orders", "simulated_only", "/api/backtest/run"]:
        assert expected in generator
    for expected in ["Backtest + AI review", "supports", "weakens", "needs_review", "no_trade"]:
        assert expected in review
