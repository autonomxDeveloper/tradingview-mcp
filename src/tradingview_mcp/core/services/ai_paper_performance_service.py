"""Read-only performance summaries for AI paper decision replays.

This module aggregates replay outputs and optional decision-history records. It is
reporting-only: no LLM calls, no paper account mutation, no simulated order
submission, and no live broker calls.
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

SUPPORTED_GROUPS = {"symbol", "action", "side", "confidence", "exit_reason", "outcome"}


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _text(value: Any, fallback: str = "unknown") -> str:
    if value is None:
        return fallback
    text = str(value).strip()
    return text if text else fallback


def _float(value: Any, fallback: float = 0.0) -> float:
    try:
        parsed = float(value)
    except (TypeError, ValueError):
        return fallback
    return parsed


def _normalize_symbol(value: Any) -> str:
    return str(value or "").strip().upper()


def _decision(record: dict[str, Any]) -> dict[str, Any]:
    decision = record.get("decision") if isinstance(record.get("decision"), dict) else record
    return decision if isinstance(decision, dict) else {}


def _history_lookup(records: list[dict[str, Any]] | None) -> dict[tuple[str, str, str], dict[str, Any]]:
    lookup: dict[tuple[str, str, str], dict[str, Any]] = {}
    for record in records or []:
        decision = _decision(record)
        symbol = _normalize_symbol(record.get("symbol") or decision.get("symbol"))
        action = _text(record.get("action") or decision.get("action"), "unknown")
        side = _text(record.get("side") or decision.get("side"), "none").lower()
        lookup.setdefault((symbol, action, side), record)
    return lookup


def _enrich_replay(replay: dict[str, Any], history: dict[tuple[str, str, str], dict[str, Any]]) -> dict[str, Any]:
    symbol = _normalize_symbol(replay.get("symbol"))
    action = _text(replay.get("action"), "unknown")
    side = _text(replay.get("side"), "none").lower()
    record = history.get((symbol, action, side), {})
    decision = _decision(record)
    return {
        **replay,
        "symbol": symbol,
        "action": action,
        "side": side,
        "confidence": _text(record.get("confidence") or decision.get("confidence"), "unknown"),
        "risk_reward": record.get("risk_reward") or decision.get("risk_reward"),
        "guardrail_warning_count": len(record.get("guardrail_warnings") or decision.get("guardrail_warnings") or []),
        "paper_trade_candidate": bool(record.get("paper_trade_candidate") or decision.get("paper_trade_candidate")),
    }


def _empty_metrics(group: str, key: str) -> dict[str, Any]:
    return {
        "group": group,
        "key": key,
        "decision_count": 0,
        "replayed_count": 0,
        "win_count": 0,
        "loss_count": 0,
        "flat_count": 0,
        "missed_entry_count": 0,
        "not_replayed_count": 0,
        "win_rate": 0.0,
        "total_realized_pnl": 0.0,
        "average_realized_pnl": 0.0,
        "average_realized_pnl_pct": 0.0,
        "average_mfe_pct": 0.0,
        "average_mae_pct": 0.0,
        "paper_only": True,
        "live_execution": False,
    }


def _finalize(metrics: dict[str, Any]) -> dict[str, Any]:
    replayed = metrics["win_count"] + metrics["loss_count"] + metrics["flat_count"]
    metrics["replayed_count"] = replayed
    if replayed:
        metrics["win_rate"] = round(metrics["win_count"] / replayed, 6)
        metrics["average_realized_pnl"] = round(metrics["total_realized_pnl"] / replayed, 6)
        metrics["average_realized_pnl_pct"] = round(metrics.pop("_pnl_pct_sum", 0.0) / replayed, 6)
        metrics["average_mfe_pct"] = round(metrics.pop("_mfe_sum", 0.0) / replayed, 6)
        metrics["average_mae_pct"] = round(metrics.pop("_mae_sum", 0.0) / replayed, 6)
    else:
        metrics.pop("_pnl_pct_sum", None)
        metrics.pop("_mfe_sum", None)
        metrics.pop("_mae_sum", None)
    metrics["total_realized_pnl"] = round(metrics["total_realized_pnl"], 6)
    return metrics


def _group_key(replay: dict[str, Any], group: str) -> str:
    if group == "symbol":
        return _normalize_symbol(replay.get("symbol")) or "UNKNOWN"
    return _text(replay.get(group), "unknown")


def _aggregate(replays: list[dict[str, Any]], group: str) -> list[dict[str, Any]]:
    buckets: dict[str, dict[str, Any]] = {}
    for replay in replays:
        key = _group_key(replay, group)
        metrics = buckets.setdefault(key, _empty_metrics(group, key))
        metrics["decision_count"] += 1
        outcome = _text(replay.get("outcome"), "not_replayed")
        if outcome == "win":
            metrics["win_count"] += 1
        elif outcome == "loss":
            metrics["loss_count"] += 1
        elif outcome == "flat":
            metrics["flat_count"] += 1
        elif outcome == "missed_entry":
            metrics["missed_entry_count"] += 1
        else:
            metrics["not_replayed_count"] += 1
        if outcome in {"win", "loss", "flat"}:
            metrics["total_realized_pnl"] += _float(replay.get("realized_pnl"), 0.0)
            metrics["_pnl_pct_sum"] = metrics.get("_pnl_pct_sum", 0.0) + _float(replay.get("realized_pnl_pct"), 0.0)
            metrics["_mfe_sum"] = metrics.get("_mfe_sum", 0.0) + _float(replay.get("max_favorable_excursion_pct"), 0.0)
            metrics["_mae_sum"] = metrics.get("_mae_sum", 0.0) + _float(replay.get("max_adverse_excursion_pct"), 0.0)
    return sorted((_finalize(metrics) for metrics in buckets.values()), key=lambda item: (-abs(item["total_realized_pnl"]), item["key"]))


def summarize_ai_paper_performance(
    replay_payload: dict[str, Any] | list[dict[str, Any]],
    *,
    decision_history: list[dict[str, Any]] | None = None,
    groups: list[str] | None = None,
) -> dict[str, Any]:
    """Aggregate replay results into read-only AI paper performance metrics."""
    raw_replays = replay_payload.get("replays", []) if isinstance(replay_payload, dict) else replay_payload
    history = _history_lookup(decision_history)
    replays = [_enrich_replay(replay, history) for replay in (raw_replays or []) if isinstance(replay, dict)]
    requested_groups = [group for group in (groups or ["symbol", "action", "side", "confidence", "exit_reason"]) if group in SUPPORTED_GROUPS]
    if not requested_groups:
        requested_groups = ["symbol"]
    overall = _aggregate(replays, "outcome")
    outcome_lookup = {item["key"]: item for item in overall}
    replayed = sum(outcome_lookup.get(key, {}).get("decision_count", 0) for key in ("win", "loss", "flat"))
    wins = outcome_lookup.get("win", {}).get("decision_count", 0)
    total_pnl = sum(_float(item.get("realized_pnl"), 0.0) for item in replays if item.get("outcome") in {"win", "loss", "flat"})
    return {
        "generated_at_utc": _utc_now(),
        "summary": {
            "decision_count": len(replays),
            "replayed_count": replayed,
            "win_count": wins,
            "loss_count": outcome_lookup.get("loss", {}).get("decision_count", 0),
            "flat_count": outcome_lookup.get("flat", {}).get("decision_count", 0),
            "missed_entry_count": outcome_lookup.get("missed_entry", {}).get("decision_count", 0),
            "not_replayed_count": outcome_lookup.get("not_replayed", {}).get("decision_count", 0),
            "win_rate": round(wins / replayed, 6) if replayed else 0.0,
            "total_realized_pnl": round(total_pnl, 6),
            "average_realized_pnl": round(total_pnl / replayed, 6) if replayed else 0.0,
        },
        "groups": {group: _aggregate(replays, group) for group in requested_groups},
        "replays": replays,
        "paper_only": True,
        "live_execution": False,
        "execution_submitted": False,
        "background_loop_enabled": False,
        "read_only": True,
    }
