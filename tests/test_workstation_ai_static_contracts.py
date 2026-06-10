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
    "ai_paper_schedule_module.js",
    "ai_paper_lifecycle_module.js",
    "ai_paper_replay_module.js",
    "ai_paper_history_module.js",
    "ai_paper_performance_module.js",
    "ai_paper_review_packet_module.js",
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


def test_ai_paper_schedule_ui_is_manual_and_paper_only():
    module = read_static("ai_paper_schedule_module.js")
    registry = read_static("module_registry.js")
    bindings = read_static("ui_bindings.js")
    module_lower = module.lower()
    for expected in [
        "/api/ai/paper-trader/schedules",
        "/api/ai/paper-trader/decision",
        "auto_execute: false",
        "paper_only: true",
        "live_execution: false",
        "Run scheduled decision",
        "Run AI decision from schedule request",
        "Record last decision",
    ]:
        assert expected in module
    assert "background loop disabled" in module_lower
    assert "manual decision requests only" in module_lower
    assert "ai_paper_schedule_module.js" in registry
    for action in [
        "aiPaperSchedule.refresh",
        "aiPaperSchedule.create",
        "aiPaperSchedule.delete",
        "aiPaperSchedule.run",
        "aiPaperSchedule.decision",
        "aiPaperSchedule.record",
    ]:
        assert action in bindings


def test_ai_paper_lifecycle_ui_is_advisory_and_paper_only():
    module = read_static("ai_paper_lifecycle_module.js")
    registry = read_static("module_registry.js")
    bindings = read_static("ui_bindings.js")
    module_lower = module.lower()
    for expected in [
        "/api/ai/paper-trader/lifecycle",
        "runAiPaperLifecycleReview",
        "renderAiPaperLifecycleReview",
        "paper_only: true",
        "live_execution: false",
        "execution_submitted: false",
        "Run lifecycle review",
        "hold",
        "review_close",
        "tighten_stop_review",
        "cancel_stale_order_review",
    ]:
        assert expected in module
    assert "advisory only" in module_lower
    assert "no paper order action is submitted automatically" in module_lower
    assert "do not submit, fill, cancel, or live-execute orders" in module_lower
    assert "ai_paper_lifecycle_module.js" in registry
    assert "aiPaperLifecycle.review" in bindings


def test_ai_paper_replay_ui_is_research_only_and_paper_only():
    module = read_static("ai_paper_replay_module.js")
    registry = read_static("module_registry.js")
    bindings = read_static("ui_bindings.js")
    module_lower = module.lower()
    for expected in [
        "/api/ai/paper-trader/replay",
        "runAiPaperReplay",
        "loadAiPaperReplayExample",
        "renderAiPaperReplay",
        "paper_only: true",
        "live_execution: false",
        "execution_submitted: false",
        "Run deterministic replay",
        "Load replay example",
        "win_rate",
        "max_favorable_excursion_pct",
        "max_adverse_excursion_pct",
    ]:
        assert expected in module
    assert "research-only" in module_lower
    assert "does not mutate the paper account" in module_lower
    assert "submit simulated orders" in module_lower
    assert "ai_paper_replay_module.js" in registry
    assert "aiPaperReplay.example" in bindings
    assert "aiPaperReplay.run" in bindings


def test_ai_paper_history_ui_is_read_only_and_loads_replay_records():
    module = read_static("ai_paper_history_module.js")
    registry = read_static("module_registry.js")
    bindings = read_static("ui_bindings.js")
    module_lower = module.lower()
    for expected in [
        "/api/ai/paper-trader/decision-history",
        "refreshAiPaperDecisionHistory",
        "loadAiPaperHistoryReplayRecords",
        "loadOneAiPaperHistoryDecision",
        "renderAiPaperDecisionHistory",
        "read_only: true",
        "paper_only: true",
        "live_execution: false",
        "execution_submitted: false",
        "Load decision history",
        "Load all replay records",
        "Load this decision into replay",
        "aiPaperReplayDecisions",
    ]:
        assert expected in module
    assert "history is read-only" in module_lower
    assert "does not mutate the paper account or execute orders" in module_lower
    assert "does not submit simulated orders" in module_lower
    assert "ai_paper_history_module.js" in registry
    for action in ["aiPaperHistory.refresh", "aiPaperHistory.loadReplay", "aiPaperHistory.loadOne"]:
        assert action in bindings


def test_ai_paper_performance_ui_is_read_only_reporting():
    module = read_static("ai_paper_performance_module.js")
    registry = read_static("module_registry.js")
    bindings = read_static("ui_bindings.js")
    module_lower = module.lower()
    for expected in [
        "/api/ai/paper-trader/performance",
        "runAiPaperPerformanceSummary",
        "loadAiPaperPerformanceExample",
        "loadReplayResultIntoPerformance",
        "loadHistoryIntoPerformance",
        "renderAiPaperPerformance",
        "paper_only: true",
        "live_execution: false",
        "execution_submitted: false",
        "read_only: true",
        "Summarize performance",
        "win_rate",
        "average_mfe_pct",
        "average_mae_pct",
        "aiPaperPerformanceReplay",
        "aiPaperPerformanceHistory",
    ]:
        assert expected in module
    assert "read-only reporting" in module_lower
    assert "does not mutate paper state" in module_lower
    assert "submit simulated orders" in module_lower
    assert "live broker endpoints" in module_lower
    assert "ai_paper_performance_module.js" in registry
    for action in [
        "aiPaperPerformance.example",
        "aiPaperPerformance.fromReplay",
        "aiPaperPerformance.fromHistory",
        "aiPaperPerformance.run",
    ]:
        assert action in bindings


def test_ai_paper_review_packet_ui_is_read_only_export():
    module = read_static("ai_paper_review_packet_module.js")
    registry = read_static("module_registry.js")
    bindings = read_static("ui_bindings.js")
    module_lower = module.lower()
    for expected in [
        "/api/ai/paper-trader/review-packet",
        "buildAiPaperReviewPacket",
        "renderAiPaperReviewPacket",
        "copyAiPaperReviewPacket",
        "syncReviewPacketInputs",
        "loadReviewPacketExample",
        "aiPaperReviewPacketReplay",
        "aiPaperReviewPacketMarks",
        "paper_only: true",
        "live_execution: false",
        "execution_submitted: false",
        "read_only: true",
        "Build review packet",
        "Copy packet JSON",
        "win_rate",
        "total_realized_pnl",
    ]:
        assert expected in module
    assert "read-only audit/export" in module_lower
    assert "no llm calls" in module_lower
    assert "mutate paper state" in module_lower
    assert "submit simulated orders" in module_lower
    assert "live broker endpoints" in module_lower
    assert "ai_paper_review_packet_module.js" in registry
    for action in [
        "aiPaperReviewPacket.sync",
        "aiPaperReviewPacket.example",
        "aiPaperReviewPacket.build",
        "aiPaperReviewPacket.copy",
    ]:
        assert action in bindings


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
