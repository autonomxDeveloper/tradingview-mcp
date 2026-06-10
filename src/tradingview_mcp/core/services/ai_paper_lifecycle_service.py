"""Advisory lifecycle review for simulated AI paper trades.

This module reviews local simulated paper positions/orders and produces
paper-only lifecycle recommendations. It never submits orders, fills, cancels,
or calls live broker endpoints.
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

SUPPORTED_RECOMMENDATIONS = {
    "hold",
    "review_close",
    "tighten_stop_review",
    "take_profit_review",
    "cancel_stale_order_review",
    "risk_review",
    "no_action",
}


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _positive_float(value: Any, fallback: float = 0.0) -> float:
    try:
        parsed = float(value)
    except (TypeError, ValueError):
        return fallback
    return parsed if parsed > 0 else fallback


def _normalize_symbol(value: Any) -> str:
    return str(value or "").strip().upper()


def _text(value: Any, fallback: str = "") -> str:
    if value is None:
        return fallback
    text = str(value).strip()
    return text if text else fallback


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


def _age_minutes(value: Any, *, now: datetime) -> float | None:
    parsed = _parse_timestamp(value)
    if parsed is None:
        return None
    return max(0.0, (now - parsed).total_seconds() / 60.0)


def _market_context_by_symbol(market_context: dict[str, Any] | None) -> dict[str, dict[str, Any]]:
    packet = market_context or {}
    symbols: dict[str, dict[str, Any]] = {}
    if packet.get("symbol"):
        symbols[_normalize_symbol(packet.get("symbol"))] = packet
    for item in packet.get("symbols") or []:
        if isinstance(item, dict) and item.get("symbol"):
            symbols[_normalize_symbol(item.get("symbol"))] = item
    return symbols


def _latest_close_for(symbol: str, market_context: dict[str, Any] | None) -> float:
    normalized = _normalize_symbol(symbol)
    packet = _market_context_by_symbol(market_context).get(normalized) or market_context or {}
    summary = packet.get("summary") or {}
    latest = _positive_float(summary.get("latest_close"), 0.0)
    if latest:
        return latest
    for context in packet.get("contexts") or []:
        latest_row = context.get("latest") or {}
        latest = _positive_float(latest_row.get("close"), 0.0)
        if latest:
            return latest
    if isinstance(packet.get("latest"), dict):
        return _positive_float(packet["latest"].get("close"), 0.0)
    return _positive_float(packet.get("last_price") or packet.get("price"), 0.0)


def _trend_alignment_for(symbol: str, market_context: dict[str, Any] | None) -> str:
    normalized = _normalize_symbol(symbol)
    packet = _market_context_by_symbol(market_context).get(normalized) or market_context or {}
    return _text((packet.get("summary") or {}).get("trend_alignment"), "unknown")


def _momentum_votes_for(symbol: str, market_context: dict[str, Any] | None) -> list[str]:
    normalized = _normalize_symbol(symbol)
    packet = _market_context_by_symbol(market_context).get(normalized) or market_context or {}
    votes = (packet.get("summary") or {}).get("momentum_votes") or []
    return [str(vote) for vote in votes]


def _status_order_open(order: dict[str, Any]) -> bool:
    return str(order.get("status") or "open").lower() in {"open", "partial", "pending", "submitted", "accepted"}


def _open_orders(snapshot: dict[str, Any]) -> list[dict[str, Any]]:
    if isinstance(snapshot.get("open_orders"), list):
        return [order for order in snapshot.get("open_orders", []) if _status_order_open(order)]
    return [order for order in snapshot.get("orders", []) if _status_order_open(order)]


def _positions(snapshot: dict[str, Any]) -> list[dict[str, Any]]:
    positions = snapshot.get("positions") or []
    if isinstance(positions, dict):
        return list(positions.values())
    return positions if isinstance(positions, list) else []


def _recommendation_for_position(position: dict[str, Any], market_context: dict[str, Any] | None, risk: dict[str, Any]) -> dict[str, Any]:
    symbol = _normalize_symbol(position.get("symbol"))
    quantity = _positive_float(position.get("quantity"), 0.0)
    average = _positive_float(position.get("average_price"), 0.0)
    mark = _latest_close_for(symbol, market_context) or _positive_float(position.get("mark_price"), average)
    market_value = quantity * mark if quantity and mark else _positive_float(position.get("market_value"), 0.0)
    unrealized = (mark - average) * quantity if quantity and average and mark else _positive_float(position.get("unrealized_pnl"), 0.0)
    pnl_pct = ((mark - average) / average * 100.0) if average and mark else 0.0
    trend_alignment = _trend_alignment_for(symbol, market_context)
    momentum_votes = _momentum_votes_for(symbol, market_context)
    max_loss_pct = abs(float(risk.get("max_unrealized_loss_pct", 5.0) or 5.0))
    take_profit_pct = abs(float(risk.get("take_profit_review_pct", 8.0) or 8.0))
    max_position_value = _positive_float(risk.get("max_position_value"), 0.0)

    warnings: list[str] = []
    recommendation = "hold"
    rationale = "Open paper position remains within lifecycle review thresholds."

    if quantity <= 0:
        recommendation = "no_action"
        rationale = "Position quantity is not positive."
    elif max_position_value and market_value > max_position_value:
        recommendation = "risk_review"
        rationale = "Paper position value exceeds lifecycle max_position_value."
        warnings.append("position_value_exceeds_limit")
    elif pnl_pct <= -max_loss_pct:
        recommendation = "review_close"
        rationale = "Unrealized loss exceeds lifecycle loss review threshold."
        warnings.append("loss_threshold_exceeded")
    elif pnl_pct >= take_profit_pct:
        recommendation = "take_profit_review"
        rationale = "Unrealized gain exceeds take-profit review threshold."
        warnings.append("profit_review_threshold_reached")
    elif "bearish" in trend_alignment.lower() or momentum_votes.count("bearish") > momentum_votes.count("bullish"):
        recommendation = "tighten_stop_review"
        rationale = "Multi-timeframe context has bearish alignment or weakening momentum."
        warnings.append("momentum_or_trend_weakening")

    return {
        "type": "position",
        "symbol": symbol,
        "quantity": quantity,
        "average_price": average,
        "mark_price": mark,
        "market_value": round(market_value, 6),
        "unrealized_pnl": round(unrealized, 6),
        "unrealized_pnl_pct": round(pnl_pct, 6),
        "trend_alignment": trend_alignment,
        "momentum_votes": momentum_votes,
        "recommendation": recommendation,
        "rationale": rationale,
        "warnings": warnings,
        "paper_only": True,
        "live_execution": False,
        "execution_submitted": False,
    }


def _recommendation_for_order(order: dict[str, Any], risk: dict[str, Any], *, now: datetime) -> dict[str, Any]:
    symbol = _normalize_symbol(order.get("symbol"))
    age = _age_minutes(order.get("created_at_utc") or order.get("submitted_at") or order.get("timestamp_utc"), now=now)
    stale_minutes = _positive_float(risk.get("stale_order_minutes"), 60.0)
    recommendation = "hold"
    rationale = "Open paper order is not stale."
    warnings: list[str] = []
    if age is not None and stale_minutes and age >= stale_minutes:
        recommendation = "cancel_stale_order_review"
        rationale = "Open paper order age exceeds stale-order review threshold."
        warnings.append("stale_order_review")
    return {
        "type": "order",
        "symbol": symbol,
        "order_id": order.get("id"),
        "side": order.get("side"),
        "quantity": _positive_float(order.get("quantity"), 0.0),
        "order_type": order.get("order_type"),
        "status": order.get("status", "open"),
        "age_minutes": round(age, 6) if age is not None else None,
        "recommendation": recommendation,
        "rationale": rationale,
        "warnings": warnings,
        "paper_only": True,
        "live_execution": False,
        "execution_submitted": False,
    }


def review_ai_paper_lifecycle(
    paper_snapshot: dict[str, Any],
    *,
    market_context: dict[str, Any] | None = None,
    risk: dict[str, Any] | None = None,
    now: datetime | None = None,
) -> dict[str, Any]:
    """Return advisory lifecycle recommendations for local paper positions/orders."""
    current = now or datetime.now(timezone.utc)
    if current.tzinfo is None:
        current = current.replace(tzinfo=timezone.utc)
    lifecycle_risk = {
        "max_unrealized_loss_pct": 5.0,
        "take_profit_review_pct": 8.0,
        "stale_order_minutes": 60.0,
        "max_position_value": 0.0,
        **(risk or {}),
    }
    position_reviews = [_recommendation_for_position(position, market_context, lifecycle_risk) for position in _positions(paper_snapshot)]
    order_reviews = [_recommendation_for_order(order, lifecycle_risk, now=current) for order in _open_orders(paper_snapshot)]
    warnings = sorted({warning for item in position_reviews + order_reviews for warning in item.get("warnings", [])})
    return {
        "generated_at_utc": _utc_now(),
        "position_reviews": position_reviews,
        "order_reviews": order_reviews,
        "summary": {
            "position_count": len(position_reviews),
            "open_order_count": len(order_reviews),
            "warnings": warnings,
            "requires_attention": bool(warnings),
            "recommendation_counts": {
                recommendation: sum(1 for item in position_reviews + order_reviews if item.get("recommendation") == recommendation)
                for recommendation in sorted(SUPPORTED_RECOMMENDATIONS)
            },
        },
        "paper_only": True,
        "live_execution": False,
        "execution_submitted": False,
        "background_loop_enabled": False,
    }
