from __future__ import annotations

from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DOC = ROOT / "docs" / "ai-paper-runtime-smoke-test-checklist.md"


def test_ai_paper_runtime_smoke_checklist_exists_and_covers_workflow():
    content = DOC.read_text(encoding="utf-8")

    for expected in [
        "# AI paper runtime smoke test checklist",
        "uv run tradingview-workstation",
        "/api/health",
        "AI paper dashboard",
        "Get AI paper decision",
        "Execute simulated paper decision",
        "Manual schedules",
        "Lifecycle advisory review",
        "Replay",
        "Decision history",
        "Performance summary",
        "Review packet",
        "Audit export",
        "/api/ai/paper-trader/decision",
        "/api/ai/paper-trader/execute",
        "/api/ai/paper-trader/schedules",
        "/api/ai/paper-trader/lifecycle",
        "/api/ai/paper-trader/replay",
        "/api/ai/paper-trader/decision-history",
        "/api/ai/paper-trader/performance",
        "/api/ai/paper-trader/review-packet",
        "/api/ai/paper-trader/audit-export",
    ]:
        assert expected in content


def test_ai_paper_runtime_smoke_checklist_preserves_safety_boundary():
    content = DOC.read_text(encoding="utf-8")
    content_lower = content.lower()

    for expected in [
        "paper_only=true",
        "live_execution=false",
        "execution_submitted=false",
        "background_loop_enabled=false",
        "read_only=true",
        "no order is submitted automatically",
        "manual decision requests only",
        "does not mutate the paper account",
        "no live broker endpoint is contacted",
        "backend response should not write export files to the server",
    ]:
        assert expected in content

    assert "do not enable live broker execution" in content_lower
    assert "do not introduce background autonomous order submission" in content_lower
    assert "simulated paper" in content_lower
    assert "research-only" in content_lower
