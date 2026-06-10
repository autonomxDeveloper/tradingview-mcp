from __future__ import annotations

from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
STATIC = ROOT / "src" / "tradingview_mcp" / "workstation_static"


def read_static(name: str) -> str:
    return (STATIC / name).read_text(encoding="utf-8")


def test_ai_paper_dashboard_is_registered_loaded_and_bound():
    module = read_static("ai_paper_dashboard_module.js")
    registry = read_static("module_registry.js")
    bindings = read_static("ui_bindings.js")

    assert "ai_paper_dashboard_module.js" in registry
    assert "/static/ai_paper_dashboard_module.js" in registry
    assert "aiPaperDashboardModuleScript" in registry
    assert "aiPaperDashboard.refresh" in bindings
    assert "aiPaperDashboard.focus" in bindings
    assert "refreshAiPaperDashboard" in module
    assert "focusAiPaperDashboardPanel" in module


def test_ai_paper_dashboard_covers_paper_workflow_panels_without_runtime_calls():
    module = read_static("ai_paper_dashboard_module.js")
    module_lower = module.lower()

    for expected in [
        "aiPaperDashboardPanel",
        "aiPaperDashboardCards",
        "aiPaperTraderPanel",
        "aiPaperSchedulePanel",
        "aiPaperLifecyclePanel",
        "aiPaperReplayPanel",
        "aiPaperHistoryPanel",
        "aiPaperPerformancePanel",
        "aiPaperReviewPacketPanel",
        "aiPaperAuditExportPanel",
        "paper_only: true",
        "live_execution: false",
        "execution_submitted: false",
        "background_loop_enabled: false",
        "read_only: true",
        "Refresh dashboard",
        "Compact read-only navigation",
    ]:
        assert expected in module

    assert "does not call llms" in module_lower
    assert "submit simulated orders" in module_lower
    assert "mutate paper state" in module_lower
    assert "server files" in module_lower
    assert "background loops" in module_lower
    assert "live broker endpoints" in module_lower
    assert "fetch(" not in module
    assert "postJson" not in module
    assert "/api/" not in module
