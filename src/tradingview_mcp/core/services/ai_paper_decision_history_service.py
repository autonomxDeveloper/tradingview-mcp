"""Read-only AI paper decision history helpers.

This module derives replay-friendly decision records from the local workstation
journal. It never calls an LLM, mutates the paper account, submits simulated
orders, or calls live broker endpoints.
"""
from __future__ import annotations

from typing import Any

from tradingview_mcp.core.services.workstation_journal_service import read_journal_events

DECISION_EVENT_TYPE = "ai_paper_trader_decision"
EXECUTION_EVENT_TYPE = "ai_paper_trader_execution"


def _text(value: Any, fallback: str = "") -> str:
    if value is None:
        return fallback
    text = str(value).strip()
    return text if text else fallback


def _normalize_symbol(value: Any) -> str:
    return _text(value).upper()


def _positive_int(value: Any, fallback: int = 100) -> int:
    try:
        parsed = int(value)
    except (TypeError, ValueError):
        return fallback
    return parsed if parsed > 0 else fallback


def _decision_from_event(event: dict[str, Any]) -> dict[str, Any] | None:
    payload = event.get("payload") or {}
    decision = payload.get("decision") or {}
    context = payload.get("context") or {}
    request = payload.get("request") or {}
    if not isinstance(decision, dict) or not decision:
        return None
    symbol = _normalize_symbol(context.get("symbol") or request.get("symbol") or decision.get("symbol"))
    if not symbol:
        return None
    return {
        "id": event.get("id"),
        "journal_event_id": event.get("id"),
        "timestamp_utc": event.get("timestamp_utc"),
        "event_type": DECISION_EVENT_TYPE,
        "symbol": symbol,
        "asset_type": context.get("asset_type") or request.get("asset_type") or "stock",
        "exchange": context.get("exchange") or request.get("exchange") or "",
        "timeframe": context.get("active_timeframe") or request.get("timeframe") or "",
        "profile": context.get("profile") or request.get("profile") or "",
        "mode": context.get("mode") or request.get("mode") or "",
        "action": decision.get("action", "no_trade"),
        "side": decision.get("side", "none"),
        "quantity": decision.get("quantity", 0),
        "order_type": decision.get("order_type", "market"),
        "confidence": decision.get("confidence", "low"),
        "risk_reward": decision.get("risk_reward", "unknown"),
        "paper_trade_candidate": bool(decision.get("paper_trade_candidate")),
        "guardrail_warnings": list(decision.get("guardrail_warnings") or []),
        "paper_only": decision.get("paper_only") is not False,
        "live_execution": decision.get("live_execution") is True,
        "execution_submitted": decision.get("execution_submitted") is True,
        "decision": decision,
        "replay_record": {"symbol": symbol, "decision": decision},
    }


def _execution_index(events: list[dict[str, Any]]) -> set[str]:
    executed_symbols: set[str] = set()
    for event in events:
        if event.get("event_type") != EXECUTION_EVENT_TYPE:
            continue
        payload = event.get("payload") or {}
        request = payload.get("request") or {}
        symbol = _normalize_symbol(request.get("symbol"))
        if symbol:
            executed_symbols.add(symbol)
    return executed_symbols


def list_ai_paper_decision_history(
    *,
    limit: int = 100,
    symbol: str | None = None,
    include_blocked: bool = True,
    include_non_trade: bool = True,
) -> dict[str, Any]:
    """Return replay-friendly decision records from the local research journal."""
    requested_limit = max(1, min(_positive_int(limit, 100), 1000))
    normalized_symbol = _normalize_symbol(symbol)
    events = read_journal_events(limit=1000)
    executed_symbols = _execution_index(events)
    records: list[dict[str, Any]] = []
    for event in events:
        if event.get("event_type") != DECISION_EVENT_TYPE:
            continue
        record = _decision_from_event(event)
        if not record:
            continue
        if normalized_symbol and record["symbol"] != normalized_symbol:
            continue
        if not include_blocked and record["guardrail_warnings"]:
            continue
        if not include_non_trade and record["action"] not in {"open_trade", "close_trade"}:
            continue
        record["has_execution_event_for_symbol"] = record["symbol"] in executed_symbols
        records.append(record)
    records = records[-requested_limit:]
    replay_records = [record["replay_record"] for record in records]
    return {
        "decisions": records,
        "replay_records": replay_records,
        "summary": {
            "decision_count": len(records),
            "replay_record_count": len(replay_records),
            "symbols": sorted({record["symbol"] for record in records}),
            "blocked_count": sum(1 for record in records if record["guardrail_warnings"]),
            "trade_candidate_count": sum(1 for record in records if record.get("paper_trade_candidate")),
            "execution_event_symbol_count": len({record["symbol"] for record in records if record.get("has_execution_event_for_symbol")}),
        },
        "paper_only": True,
        "live_execution": False,
        "execution_submitted": False,
        "background_loop_enabled": False,
        "read_only": True,
    }
