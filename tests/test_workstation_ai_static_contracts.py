from __future__ import annotations

from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
STATIC = ROOT / "src" / "tradingview_mcp" / "workstation_static"


def read_static(name: str) -> str:
    return (STATIC / name).read_text(encoding="utf-8")


def script_load_index(registry: str, module: str) -> int:
    marker = f"loadModuleScript("
    module_index = registry.index(module, registry.index("function loadWorkstationModules"))
    return registry.rfind(marker, 0, module_index)


def test_ai_modules_are_registered_and_loaded_in_expected_order():
    registry = read_static("module_registry.js")
    expected_modules = [
        "ai_trade_idea_module.js",
        "ai_trade_workflow_module.js",
        "ai_backtest_generator_module.js",
        "ai_backtest_review_module.js",
        "ai_watchlist_scanner_module.js",
        "ai_paper_risk_module.js",
        "ai_trade_journal_coach_module.js",
        "ai_confidence_calibration_module.js",
    ]
    for module in expected_modules:
        assert module in registry
        assert (STATIC / module).exists(), f"{module} should exist when registered"

    front_ai_order = [script_load_index(registry, module) for module in expected_modules[:5]]
    assert front_ai_order == sorted(front_ai_order)
    assert script_load_index(registry, "paper_trading_module.js") < script_load_index(registry, "ai_paper_risk_module.js")
    assert script_load_index(registry, "ai_trade_journal_coach_module.js") < script_load_index(registry, "ai_confidence_calibration_module.js")


def test_ai_trade_idea_module_uses_dedicated_endpoint_with_safe_fallback_and_no_trade_contract():
    module = read_static("ai_trade_idea_module.js")
    assert "/api/ai/trade-idea" in module
    assert "/api/ai/analyze" in module
    assert "mode: 'research_trade_idea'" in module
    assert "direction=\"no_trade\"" in module
    assert "Do not force a trade" in module
    assert "not_financial_advice" in module
    assert "no live broker orders" in module.lower()
    for profile in ["swing", "intraday", "breakout", "pullback", "mean_reversion", "risk_review"]:
        assert profile in module
    for action in ["Save AI idea", "Backtest this", "Prefill paper ticket", "Copy JSON"]:
        assert action in module


def test_ai_watchlist_scanner_contract_is_research_only_and_bounded():
    module = read_static("ai_watchlist_scanner_module.js")
    assert "/api/ai/trade-idea" in module
    assert "mode: 'watchlist_trade_scanner'" in module
    assert "Math.max(1, Math.min" in module
    assert "12" in module
    assert "no_trade" in module
    assert "Do not force a trade" in module
    assert "ai_watchlist_scanner" in module
    for action in ["Load chart", "Save idea", "Backtest", "Prefill paper"]:
        assert action in module


def test_ai_paper_risk_review_gates_simulated_submit():
    module = read_static("ai_paper_risk_module.js")
    assert "window.submitPaperOrder" in module
    assert "originalSubmitPaperOrder" in module
    assert "risk_verdict" in module
    assert "acceptable" in module
    assert "too_risky" in module
    assert "reject" in module
    assert "paperRiskReviewAcknowledgement" in module
    assert "No live broker order will be submitted" in module
    assert "live_execution: false" in module


def test_ai_journal_and_calibration_modules_capture_outcomes_without_remote_dependencies():
    journal = read_static("ai_trade_journal_coach_module.js")
    calibration = read_static("ai_confidence_calibration_module.js")
    assert "Review latest paper trade" in journal
    assert "Review selected order" in journal
    assert "review_verdict" in journal
    assert "followed_plan" in journal
    assert "rule_violation" in journal
    assert "live_execution: false" in journal

    assert "localStorage" in calibration
    assert "workstation.aiConfidenceCalibration.v1" in calibration
    assert "lastAiBacktestReview" in calibration
    assert "aiTradeJournalCoachState" in calibration
    assert "Calibration" in calibration


def test_ai_backtest_generator_and_review_modules_have_safe_workflow_contracts():
    generator = read_static("ai_backtest_generator_module.js")
    review = read_static("ai_backtest_review_module.js")

    for strategy in ["donchian", "rsi_pullback", "bollinger", "macd", "triple_ema", "ema_cross"]:
        assert strategy in generator
    assert "Generate backtest plan" in generator
    assert "simulated_only" in generator
    assert "no_live_orders" in generator
    assert "/api/backtest/run" in generator

    assert "Backtest + AI review" in review
    assert "supports" in review
    assert "weakens" in review
    assert "needs_review" in review
    assert "no_trade" in review
    assert "paper trade candidate" in review.lower()


def test_paper_trading_module_exposes_state_for_ai_review_and_uses_paper_api_only():
    module = read_static("paper_trading_module.js")
    assert "window.paperTradingState" in module
    assert "/api/paper/account" in module
    assert "/api/paper/orders" in module
    assert "/api/paper/fills" in module
    assert "live" not in "\n".join(
        line for line in module.splitlines() if "/api/" in line and "/api/paper" not in line
    ).lower()
