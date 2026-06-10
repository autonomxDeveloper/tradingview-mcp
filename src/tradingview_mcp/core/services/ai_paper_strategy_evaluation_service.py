"""Read-only strategy evaluation bundles for AI paper review packets.

This module compares multiple AI paper review packets across symbols,
timeframes, profiles, or caller-provided strategy labels. It is reporting-only:
no LLM calls, no paper account mutation, no simulated order submission, no
background loop, and no live broker calls.
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any


SUPPORTED_GROUPS = {"strategy", "symbol", "timeframe", "profile", "confidence"}


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _text(value: Any, fallback: str = "unknown") -> str:
    if value is None:
        return fallback
    text = str(value).strip()
    return text if text else fallback


def _float(value: Any, fallback: float = 0.0) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return fallback


def _int(value: Any, fallback: int = 0) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        return fallback


def _normalize_symbol(value: Any) -> str:
    return str(value or "").strip().upper()


def _packet_label(packet: dict[str, Any], index: int) -> str:
    metadata = packet.get("metadata") if isinstance(packet.get("metadata"), dict) else {}
    filters = packet.get("filters") if isinstance(packet.get("filters"), dict) else {}
    for value in (
        packet.get("strategy"),
        packet.get("strategy_name"),
        packet.get("name"),
        metadata.get("strategy"),
        metadata.get("strategy_name"),
        metadata.get("name"),
        filters.get("strategy"),
        filters.get("profile"),
    ):
        text = _text(value, "")
        if text:
            return text
    return f"packet_{index + 1}"


def _packet_summary(packet: dict[str, Any]) -> dict[str, Any]:
    performance = packet.get("performance") if isinstance(packet.get("performance"), dict) else {}
    perf_summary = performance.get("summary") if isinstance(performance.get("summary"), dict) else {}
    packet_summary = packet.get("summary") if isinstance(packet.get("summary"), dict) else {}
    return {**packet_summary, **perf_summary}


def _packet_replays(packet: dict[str, Any]) -> list[dict[str, Any]]:
    replay = packet.get("replay") if isinstance(packet.get("replay"), dict) else {}
    replay_rows = replay.get("replays") if isinstance(replay.get("replays"), list) else []
    if replay_rows:
        return [row for row in replay_rows if isinstance(row, dict)]
    performance = packet.get("performance") if isinstance(packet.get("performance"), dict) else {}
    perf_rows = performance.get("replays") if isinstance(performance.get("replays"), list) else []
    return [row for row in perf_rows if isinstance(row, dict)]


def _metadata_value(packet: dict[str, Any], key: str) -> str:
    metadata = packet.get("metadata") if isinstance(packet.get("metadata"), dict) else {}
    filters = packet.get("filters") if isinstance(packet.get("filters"), dict) else {}
    for value in (packet.get(key), metadata.get(key), filters.get(key)):
        text = _text(value, "")
        if text:
            return text
    return "unknown"


def _packet_metric(packet: dict[str, Any], index: int) -> dict[str, Any]:
    summary = _packet_summary(packet)
    replays = _packet_replays(packet)
    replayed_count = _int(summary.get("replayed_count"), 0)
    win_count = _int(summary.get("win_count"), 0)
    loss_count = _int(summary.get("loss_count"), 0)
    flat_count = _int(summary.get("flat_count"), 0)
    missed_entry_count = _int(summary.get("missed_entry_count"), 0)
    not_replayed_count = _int(summary.get("not_replayed_count"), 0)
    decision_count = _int(summary.get("decision_count"), len(replays))
    total_realized_pnl = round(_float(summary.get("total_realized_pnl"), 0.0), 6)
    average_realized_pnl = round(_float(summary.get("average_realized_pnl"), total_realized_pnl / replayed_count if replayed_count else 0.0), 6)
    win_rate = round(_float(summary.get("win_rate"), win_count / replayed_count if replayed_count else 0.0), 6)
    symbols = summary.get("symbols")
    if not isinstance(symbols, list):
        symbols = sorted({_normalize_symbol(row.get("symbol")) for row in replays if _normalize_symbol(row.get("symbol"))})
    return {
        "packet_index": index,
        "label": _packet_label(packet, index),
        "strategy": _packet_label(packet, index),
        "symbol": _metadata_value(packet, "symbol") if not symbols else ",".join(symbols),
        "timeframe": _metadata_value(packet, "timeframe"),
        "profile": _metadata_value(packet, "profile"),
        "confidence": _metadata_value(packet, "confidence"),
        "decision_count": decision_count,
        "replayed_count": replayed_count,
        "win_count": win_count,
        "loss_count": loss_count,
        "flat_count": flat_count,
        "missed_entry_count": missed_entry_count,
        "not_replayed_count": not_replayed_count,
        "win_rate": win_rate,
        "total_realized_pnl": total_realized_pnl,
        "average_realized_pnl": average_realized_pnl,
        "symbols": symbols,
        "packet_type": _text(packet.get("packet_type"), "ai_paper_review_packet"),
        "paper_only": True,
        "live_execution": False,
        "execution_submitted": False,
        "background_loop_enabled": False,
        "read_only": True,
    }


def _score(metric: dict[str, Any]) -> float:
    replayed = _int(metric.get("replayed_count"), 0)
    # Favor positive PnL and win rate, but penalize tiny samples so one lucky
    # replay does not outrank a larger bundle too aggressively.
    sample_factor = min(replayed, 20) / 20 if replayed else 0.0
    return round(_float(metric.get("total_realized_pnl")) + (_float(metric.get("win_rate")) * 100 * sample_factor), 6)


def _aggregate_metrics(metrics: list[dict[str, Any]], group: str) -> list[dict[str, Any]]:
    buckets: dict[str, dict[str, Any]] = {}
    for metric in metrics:
        key = _text(metric.get(group), "unknown")
        bucket = buckets.setdefault(
            key,
            {
                "group": group,
                "key": key,
                "packet_count": 0,
                "decision_count": 0,
                "replayed_count": 0,
                "win_count": 0,
                "loss_count": 0,
                "flat_count": 0,
                "missed_entry_count": 0,
                "not_replayed_count": 0,
                "total_realized_pnl": 0.0,
                "paper_only": True,
                "live_execution": False,
                "execution_submitted": False,
                "background_loop_enabled": False,
                "read_only": True,
            },
        )
        bucket["packet_count"] += 1
        for field in ("decision_count", "replayed_count", "win_count", "loss_count", "flat_count", "missed_entry_count", "not_replayed_count"):
            bucket[field] += _int(metric.get(field), 0)
        bucket["total_realized_pnl"] += _float(metric.get("total_realized_pnl"), 0.0)
    rows = []
    for bucket in buckets.values():
        replayed = _int(bucket.get("replayed_count"), 0)
        bucket["total_realized_pnl"] = round(_float(bucket.get("total_realized_pnl")), 6)
        bucket["win_rate"] = round(_int(bucket.get("win_count"), 0) / replayed, 6) if replayed else 0.0
        bucket["average_realized_pnl"] = round(_float(bucket.get("total_realized_pnl")) / replayed, 6) if replayed else 0.0
        rows.append(bucket)
    return sorted(rows, key=lambda item: (-_float(item.get("total_realized_pnl")), -_float(item.get("win_rate")), item["key"]))


def evaluate_ai_paper_strategy_packets(
    packets: list[dict[str, Any]],
    *,
    groups: list[str] | None = None,
) -> dict[str, Any]:
    """Compare multiple AI paper review packets without side effects."""
    normalized_packets = [packet for packet in packets if isinstance(packet, dict)]
    metrics = [_packet_metric(packet, index) for index, packet in enumerate(normalized_packets)]
    for metric in metrics:
        metric["score"] = _score(metric)
    ranked = sorted(metrics, key=lambda item: (-_float(item.get("score")), -_float(item.get("total_realized_pnl")), -_float(item.get("win_rate")), item["label"]))
    requested_groups = [group for group in (groups or ["strategy", "symbol", "timeframe", "profile"]) if group in SUPPORTED_GROUPS]
    if not requested_groups:
        requested_groups = ["strategy"]
    best = ranked[0] if ranked else None
    total_replayed = sum(_int(metric.get("replayed_count"), 0) for metric in metrics)
    total_wins = sum(_int(metric.get("win_count"), 0) for metric in metrics)
    total_pnl = round(sum(_float(metric.get("total_realized_pnl"), 0.0) for metric in metrics), 6)
    return {
        "generated_at_utc": _utc_now(),
        "evaluation_type": "ai_paper_strategy_evaluation_bundle",
        "summary": {
            "packet_count": len(normalized_packets),
            "decision_count": sum(_int(metric.get("decision_count"), 0) for metric in metrics),
            "replayed_count": total_replayed,
            "win_count": total_wins,
            "loss_count": sum(_int(metric.get("loss_count"), 0) for metric in metrics),
            "flat_count": sum(_int(metric.get("flat_count"), 0) for metric in metrics),
            "missed_entry_count": sum(_int(metric.get("missed_entry_count"), 0) for metric in metrics),
            "win_rate": round(total_wins / total_replayed, 6) if total_replayed else 0.0,
            "total_realized_pnl": total_pnl,
            "best_strategy": best.get("label") if isinstance(best, dict) else None,
            "best_score": best.get("score") if isinstance(best, dict) else None,
        },
        "ranked_strategies": ranked,
        "groups": {group: _aggregate_metrics(metrics, group) for group in requested_groups},
        "paper_only": True,
        "live_execution": False,
        "execution_submitted": False,
        "background_loop_enabled": False,
        "read_only": True,
    }
