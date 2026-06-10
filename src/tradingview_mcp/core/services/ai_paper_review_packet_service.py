"""Read-only review packets for AI paper decision audits.

This module bundles decision history, optional replay results, and performance
summaries into one portable packet. It never calls an LLM, mutates the paper
account, submits simulated orders, or calls live broker endpoints.
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from tradingview_mcp.core.services.ai_paper_decision_history_service import list_ai_paper_decision_history
from tradingview_mcp.core.services.ai_paper_performance_service import summarize_ai_paper_performance
from tradingview_mcp.core.services.ai_paper_replay_service import replay_ai_paper_decisions


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _positive_int(value: Any, fallback: int = 100) -> int:
    try:
        parsed = int(value)
    except (TypeError, ValueError):
        return fallback
    return parsed if parsed > 0 else fallback


def _normalize_symbol(value: Any) -> str:
    return str(value or "").strip().upper()


def _replay_payload_from_input(
    replay: dict[str, Any] | list[dict[str, Any]] | None,
    *,
    replay_records: list[dict[str, Any]],
    marks_by_symbol: dict[str, list[dict[str, Any]]] | None,
) -> dict[str, Any]:
    """Resolve replay input into a normalized replay payload."""
    if isinstance(replay, dict):
        if isinstance(replay.get("replays"), list):
            return replay
        if isinstance(replay.get("replay"), dict) and isinstance(replay["replay"].get("replays"), list):
            return replay["replay"]
    if isinstance(replay, list):
        return {"replays": [row for row in replay if isinstance(row, dict)]}
    if marks_by_symbol:
        return replay_ai_paper_decisions(replay_records, marks_by_symbol)
    return {
        "generated_at_utc": _utc_now(),
        "replays": [],
        "summary": {
            "decision_count": len(replay_records),
            "replayed_count": 0,
            "win_count": 0,
            "loss_count": 0,
            "flat_count": 0,
            "missed_entry_count": 0,
            "win_rate": 0.0,
            "total_realized_pnl": 0.0,
            "average_realized_pnl": 0.0,
        },
        "paper_only": True,
        "live_execution": False,
        "execution_submitted": False,
        "background_loop_enabled": False,
    }


def build_ai_paper_review_packet(
    *,
    limit: int = 100,
    symbol: str | None = None,
    include_blocked: bool = True,
    include_non_trade: bool = True,
    replay: dict[str, Any] | list[dict[str, Any]] | None = None,
    marks_by_symbol: dict[str, list[dict[str, Any]]] | None = None,
    groups: list[str] | None = None,
    include_decisions: bool = True,
    include_replay_records: bool = True,
) -> dict[str, Any]:
    """Build a portable, read-only AI paper review packet."""
    normalized_limit = max(1, min(_positive_int(limit, 100), 1000))
    normalized_symbol = _normalize_symbol(symbol)
    history = list_ai_paper_decision_history(
        limit=normalized_limit,
        symbol=normalized_symbol or None,
        include_blocked=include_blocked,
        include_non_trade=include_non_trade,
    )
    replay_records = history.get("replay_records", []) if isinstance(history, dict) else []
    replay_payload = _replay_payload_from_input(replay, replay_records=replay_records, marks_by_symbol=marks_by_symbol)
    decisions = history.get("decisions", []) if isinstance(history, dict) else []
    performance = summarize_ai_paper_performance(
        replay_payload,
        decision_history=decisions,
        groups=groups or ["symbol", "action", "side", "confidence", "exit_reason", "outcome"],
    )
    packet_summary = {
        "decision_count": (history.get("summary") or {}).get("decision_count", 0),
        "replay_record_count": (history.get("summary") or {}).get("replay_record_count", 0),
        "replayed_count": (performance.get("summary") or {}).get("replayed_count", 0),
        "win_count": (performance.get("summary") or {}).get("win_count", 0),
        "loss_count": (performance.get("summary") or {}).get("loss_count", 0),
        "win_rate": (performance.get("summary") or {}).get("win_rate", 0.0),
        "total_realized_pnl": (performance.get("summary") or {}).get("total_realized_pnl", 0.0),
        "symbols": (history.get("summary") or {}).get("symbols", []),
    }
    return {
        "generated_at_utc": _utc_now(),
        "filters": {
            "limit": normalized_limit,
            "symbol": normalized_symbol,
            "include_blocked": include_blocked,
            "include_non_trade": include_non_trade,
            "groups": groups or ["symbol", "action", "side", "confidence", "exit_reason", "outcome"],
        },
        "summary": packet_summary,
        "decision_history": history,
        "replay": replay_payload,
        "performance": performance,
        "decisions": decisions if include_decisions else [],
        "replay_records": replay_records if include_replay_records else [],
        "packet_type": "ai_paper_review_packet",
        "paper_only": True,
        "live_execution": False,
        "execution_submitted": False,
        "background_loop_enabled": False,
        "read_only": True,
    }
