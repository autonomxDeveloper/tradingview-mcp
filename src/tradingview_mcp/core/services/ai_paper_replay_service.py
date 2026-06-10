"""Deterministic replay for AI paper-trader decisions.

Replay evaluates saved AI paper decisions against provided historical marks. It is
research-only: no paper account mutation, no simulated order submission, and no
live broker calls.
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

SUPPORTED_REPLAY_OUTCOMES = {
    "win",
    "loss",
    "flat",
    "missed_entry",
    "not_replayed",
}


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _text(value: Any, fallback: str = "") -> str:
    if value is None:
        return fallback
    text = str(value).strip()
    return text if text else fallback


def _normalize_symbol(value: Any) -> str:
    return str(value or "").strip().upper()


def _positive_float(value: Any, fallback: float = 0.0) -> float:
    try:
        parsed = float(value)
    except (TypeError, ValueError):
        return fallback
    return parsed if parsed > 0 else fallback


def _optional_float(value: Any) -> float | None:
    try:
        parsed = float(value)
    except (TypeError, ValueError):
        return None
    return parsed


def _parse_timestamp(value: Any) -> datetime | None:
    if not value:
        return None
    if isinstance(value, datetime):
        return value.astimezone(timezone.utc) if value.tzinfo else value.replace(tzinfo=timezone.utc)
    try:
        parsed = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except ValueError:
        return None
    return parsed.astimezone(timezone.utc) if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)


def _mark_timestamp(mark: dict[str, Any]) -> datetime | None:
    return _parse_timestamp(mark.get("timestamp") or mark.get("time") or mark.get("timestamp_utc") or mark.get("date"))


def _mark_price(mark: dict[str, Any]) -> float:
    for key in ("close", "price", "mark", "last", "value"):
        price = _positive_float(mark.get(key), 0.0)
        if price:
            return price
    return 0.0


def normalize_marks(marks: list[dict[str, Any]] | None) -> list[dict[str, Any]]:
    """Normalize replay marks into timestamp/close rows sorted by time."""
    rows: list[dict[str, Any]] = []
    for mark in marks or []:
        if not isinstance(mark, dict):
            continue
        close = _mark_price(mark)
        if close <= 0:
            continue
        timestamp = _mark_timestamp(mark)
        rows.append({
            "timestamp": timestamp.isoformat() if timestamp else _text(mark.get("timestamp") or mark.get("time") or mark.get("date"), ""),
            "_sort_timestamp": timestamp,
            "close": close,
            "high": _positive_float(mark.get("high"), close),
            "low": _positive_float(mark.get("low"), close),
            "open": _positive_float(mark.get("open"), close),
            "volume": _positive_float(mark.get("volume"), 0.0),
        })
    rows.sort(key=lambda row: row.get("_sort_timestamp") or datetime.min.replace(tzinfo=timezone.utc))
    for row in rows:
        row.pop("_sort_timestamp", None)
    return rows


def _entry_price(decision: dict[str, Any], marks: list[dict[str, Any]]) -> float:
    for key in ("entry_price", "limit_price", "stop_price"):
        price = _positive_float(decision.get(key), 0.0)
        if price:
            return price
    return marks[0]["close"] if marks else 0.0


def _side_multiplier(side: str) -> int:
    return -1 if side == "sell" else 1


def _hit_target(side: str, high: float, low: float, target: float) -> bool:
    if target <= 0:
        return False
    return high >= target if side == "buy" else low <= target


def _hit_stop(side: str, high: float, low: float, stop: float) -> bool:
    if stop <= 0:
        return False
    return low <= stop if side == "buy" else high >= stop


def replay_ai_paper_decision(decision_record: dict[str, Any], marks: list[dict[str, Any]]) -> dict[str, Any]:
    """Replay one AI paper decision against normalized historical marks."""
    decision = decision_record.get("decision") if isinstance(decision_record.get("decision"), dict) else decision_record
    normalized_marks = normalize_marks(marks)
    symbol = _normalize_symbol(decision_record.get("symbol") or decision.get("symbol") or decision_record.get("context", {}).get("symbol"))
    action = _text(decision.get("action"), "no_trade")
    side = _text(decision.get("side"), "none").lower()
    quantity = _positive_float(decision.get("quantity"), 0.0)
    result = {
        "symbol": symbol,
        "action": action,
        "side": side,
        "quantity": quantity,
        "entry_price": 0.0,
        "exit_price": 0.0,
        "exit_reason": "not_replayed",
        "outcome": "not_replayed",
        "realized_pnl": 0.0,
        "realized_pnl_pct": 0.0,
        "max_favorable_excursion_pct": 0.0,
        "max_adverse_excursion_pct": 0.0,
        "bars_replayed": len(normalized_marks),
        "paper_only": True,
        "live_execution": False,
        "execution_submitted": False,
    }
    if action != "open_trade" or side not in {"buy", "sell"} or quantity <= 0 or not normalized_marks:
        result["exit_reason"] = "decision_not_open_trade"
        result["outcome"] = "not_replayed" if not normalized_marks else "flat"
        return result

    entry = _entry_price(decision, normalized_marks)
    if entry <= 0:
        result["exit_reason"] = "missing_entry_price"
        return result

    stop = _positive_float(decision.get("stop_price") or decision.get("stop_loss"), 0.0)
    target = _positive_float(decision.get("take_profit") or decision.get("target_price"), 0.0)
    multiplier = _side_multiplier(side)
    entry_filled = True
    order_type = _text(decision.get("order_type"), "market").lower()
    if order_type == "limit":
        entry_filled = any((_positive_float(mark.get("low"), mark["close"]) <= entry <= _positive_float(mark.get("high"), mark["close"])) for mark in normalized_marks)
    if not entry_filled:
        result.update({"entry_price": entry, "exit_reason": "entry_not_reached", "outcome": "missed_entry"})
        return result

    exit_price = normalized_marks[-1]["close"]
    exit_reason = "final_mark"
    mfe = 0.0
    mae = 0.0
    for mark in normalized_marks:
        high = _positive_float(mark.get("high"), mark["close"])
        low = _positive_float(mark.get("low"), mark["close"])
        favorable_price = high if side == "buy" else low
        adverse_price = low if side == "buy" else high
        mfe = max(mfe, ((favorable_price - entry) * multiplier / entry) * 100.0)
        mae = min(mae, ((adverse_price - entry) * multiplier / entry) * 100.0)
        stop_hit = _hit_stop(side, high, low, stop)
        target_hit = _hit_target(side, high, low, target)
        if stop_hit and target_hit:
            # Conservative deterministic tie-breaker: stop first for same-bar ambiguity.
            exit_price = stop
            exit_reason = "stop_before_target_same_bar"
            break
        if stop_hit:
            exit_price = stop
            exit_reason = "stop_hit"
            break
        if target_hit:
            exit_price = target
            exit_reason = "target_hit"
            break

    pnl = (exit_price - entry) * multiplier * quantity
    pnl_pct = ((exit_price - entry) * multiplier / entry) * 100.0 if entry else 0.0
    if pnl > 0:
        outcome = "win"
    elif pnl < 0:
        outcome = "loss"
    else:
        outcome = "flat"
    result.update({
        "entry_price": round(entry, 6),
        "exit_price": round(exit_price, 6),
        "exit_reason": exit_reason,
        "outcome": outcome,
        "realized_pnl": round(pnl, 6),
        "realized_pnl_pct": round(pnl_pct, 6),
        "max_favorable_excursion_pct": round(mfe, 6),
        "max_adverse_excursion_pct": round(mae, 6),
    })
    return result


def replay_ai_paper_decisions(records: list[dict[str, Any]], marks_by_symbol: dict[str, list[dict[str, Any]]] | None = None) -> dict[str, Any]:
    """Replay multiple AI paper decisions and summarize outcomes."""
    marks_lookup = {_normalize_symbol(symbol): normalize_marks(marks) for symbol, marks in (marks_by_symbol or {}).items()}
    replays: list[dict[str, Any]] = []
    for record in records or []:
        decision = record.get("decision") if isinstance(record.get("decision"), dict) else record
        symbol = _normalize_symbol(record.get("symbol") or decision.get("symbol") or record.get("context", {}).get("symbol"))
        replays.append(replay_ai_paper_decision(record, marks_lookup.get(symbol, [])))
    wins = sum(1 for replay in replays if replay.get("outcome") == "win")
    losses = sum(1 for replay in replays if replay.get("outcome") == "loss")
    flats = sum(1 for replay in replays if replay.get("outcome") == "flat")
    missed = sum(1 for replay in replays if replay.get("outcome") == "missed_entry")
    replayed = wins + losses + flats
    total_pnl = sum(float(replay.get("realized_pnl") or 0.0) for replay in replays)
    return {
        "generated_at_utc": _utc_now(),
        "replays": replays,
        "summary": {
            "decision_count": len(records or []),
            "replayed_count": replayed,
            "win_count": wins,
            "loss_count": losses,
            "flat_count": flats,
            "missed_entry_count": missed,
            "win_rate": round(wins / replayed, 6) if replayed else 0.0,
            "total_realized_pnl": round(total_pnl, 6),
            "average_realized_pnl": round(total_pnl / replayed, 6) if replayed else 0.0,
        },
        "paper_only": True,
        "live_execution": False,
        "execution_submitted": False,
        "background_loop_enabled": False,
    }
