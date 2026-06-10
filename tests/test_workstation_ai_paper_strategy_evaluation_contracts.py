from __future__ import annotations

from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "src" / "tradingview_mcp"


def read_src(path: str) -> str:
    return (SRC / path).read_text(encoding="utf-8")


def test_strategy_evaluation_service_and_route_preserve_read_only_boundary():
    service = read_src("core/services/ai_paper_strategy_evaluation_service.py")
    route = read_src("workstation_ai_paper_strategy_evaluation_routes.py")
    service_lower = service.lower()

    for expected in [
        "evaluate_ai_paper_strategy_packets",
        "ai_paper_strategy_evaluation_bundle",
        "ranked_strategies",
        "best_strategy",
        "paper_only",
        "live_execution",
        "execution_submitted",
        "background_loop_enabled",
        "read_only",
    ]:
        assert expected in service

    for forbidden in ["requests.post", "submit_paper_order", "fill_paper_order", "cancel_paper_order", "append_journal_event", "save_export_packet"]:
        assert forbidden not in service

    assert "no llm calls" in service_lower
    assert "no paper account mutation" in service_lower
    assert "no simulated order submission" in service_lower
    assert "no live broker calls" in service_lower
    assert "/api/ai/paper-trader/strategy-evaluation" in route
    assert "register_ai_paper_strategy_evaluation_routes" in route
    assert "install_ai_paper_strategy_evaluation_route_autoregistry" in route


def test_validators_preserve_all_ai_paper_route_hooks():
    validators = read_src("core/utils/validators.py")

    for expected in [
        "install_ai_paper_execution_route_autoregistry",
        "install_ai_paper_history_route_autoregistry",
        "install_ai_paper_performance_route_autoregistry",
        "install_ai_paper_review_packet_route_autoregistry",
        "install_ai_paper_audit_export_route_autoregistry",
        "install_ai_paper_strategy_evaluation_route_autoregistry",
    ]:
        assert expected in validators
