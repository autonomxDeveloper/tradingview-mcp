"""Paper-only execution adapter for AI paper-trader decisions.

This module converts already-validated AI paper-trader decisions into local
simulated paper-trading service calls. It never calls live broker APIs.
"""
from __future__ import annotations

from typing import Any

from tradingview_mcp.core.services.paper_trading_service import (
    cancel_paper_order,
    fill_paper_order,
    list_paper_orders,
    paper_account_snapshot,
    submit_paper_order,
)


def _text(value: Any, fallback: str = "") -> str:
    if value is None:
        return fallback
    text = str(value).strip()
    return text if text else fallback


def _positive_float(value: Any, fallback: float = 0.0) -> float:
    try:
        parsed = float(value)
    except (TypeError, ValueError):
        return fallback
    return parsed if parsed > 0 else fallback


def _normalize_symbol(value: Any) -> str:
    return str(value or "").strip().upper()


def _open_orders_for_symbol(symbol: str) -> list[dict[str, Any]]:
    normalized = _normalize_symbol(symbol)
    orders = []
    for order in list_paper_orders(100):
        if _normalize_symbol(order.get("symbol")) != normalized:
            continue
        if str(order.get("status") or "open").lower() in {"open", "pending", "submitted", "accepted"}:
            orders.append(order)
    return orders


def _positions_for_symbol(symbol: str) -> list[dict[str, Any]]:
    normalized = _normalize_symbol(symbol)
    snapshot = paper_account_snapshot()
    return [
        position
        for position in snapshot.get("positions", [])
        if _normalize_symbol(position.get("symbol")) == normalized and _positive_float(position.get("quantity"), 0.0) > 0
    ]


def _execution_rejected(reason: str, *, decision: dict[str, Any] | None = None, action: str = "rejected") -> dict[str, Any]:
    return {
        "executed": False,
        "execution_action": action,
        "reason": reason,
        "decision": decision or {},
        "paper_only": True,
        "live_execution": False,
        "execution_submitted": False,
        "account": paper_account_snapshot(),
    }


def execute_ai_paper_trader_decision(
    decision: dict[str, Any],
    *,
    symbol: str,
    asset_type: str = "stock",
    idea_id: str | None = None,
    notes: str = "AI paper-trader execution adapter",
    fill_market_orders: bool = False,
    fill_price: float | None = None,
    cancel_open_orders_on_no_trade: bool = False,
) -> dict[str, Any]:
    """Execute a validated AI decision against the local paper account only.

    Only open_trade and close_trade decisions can submit simulated paper orders.
    hold/no_trade can optionally cancel existing open paper orders for the symbol.
    This function never calls Alpaca, brokerage, or live execution endpoints.
    """
    guarded_warnings = decision.get("guardrail_warnings") or []
    if guarded_warnings:
        return _execution_rejected("decision still has guardrail warnings and cannot execute", decision=decision)
    if decision.get("paper_only") is not True or decision.get("live_execution") is not False:
        return _execution_rejected("decision is missing required paper-only/live_execution=false flags", decision=decision)
    if decision.get("execution_submitted") is True:
        return _execution_rejected("decision already appears to have been submitted", decision=decision)

    action = str(decision.get("action") or "no_trade").strip().lower()
    normalized_symbol = _normalize_symbol(symbol)
    order_type = str(decision.get("order_type") or "market").strip().lower()
    side = str(decision.get("side") or "none").strip().lower()
    quantity = _positive_float(decision.get("quantity"), 0.0)

    if action == "open_trade":
        if not decision.get("paper_trade_candidate"):
            return _execution_rejected("open_trade requires paper_trade_candidate=true", decision=decision)
        if side not in {"buy", "sell"}:
            return _execution_rejected("open_trade requires side buy or sell", decision=decision)
        if quantity <= 0:
            return _execution_rejected("open_trade requires quantity greater than zero", decision=decision)
        if _open_orders_for_symbol(normalized_symbol):
            return _execution_rejected("symbol already has open paper orders", decision=decision)
        try:
            order = submit_paper_order(
                normalized_symbol,
                side,
                quantity,
                order_type,
                asset_type,
                decision.get("limit_price"),
                decision.get("stop_price"),
                idea_id,
                notes,
            )
        except ValueError as exc:
            return _execution_rejected(str(exc), decision=decision)
        fill_result = None
        if fill_market_orders and order.get("order_type") == "market":
            price = _positive_float(fill_price, 0.0)
            if price <= 0:
                return {
                    "executed": True,
                    "execution_action": "submitted_open_order",
                    "order": order,
                    "fill_result": None,
                    "fill_skipped_reason": "fill_market_orders requested but fill_price was not positive",
                    "decision": {**decision, "execution_submitted": True},
                    "paper_only": True,
                    "live_execution": False,
                    "execution_submitted": True,
                    "account": paper_account_snapshot(),
                }
            try:
                fill_result = fill_paper_order(order["id"], price, source="ai_paper_trader_execution")
            except ValueError as exc:
                return _execution_rejected(str(exc), decision=decision, action="fill_rejected")
        return {
            "executed": True,
            "execution_action": "submitted_open_order",
            "order": order,
            "fill_result": fill_result,
            "decision": {**decision, "execution_submitted": True},
            "paper_only": True,
            "live_execution": False,
            "execution_submitted": True,
            "account": paper_account_snapshot(),
        }

    if action == "close_trade":
        positions = _positions_for_symbol(normalized_symbol)
        if not positions:
            return _execution_rejected("close_trade requires an existing paper position for the symbol", decision=decision)
        close_quantity = quantity or _positive_float(positions[0].get("quantity"), 0.0)
        if close_quantity <= 0:
            return _execution_rejected("close_trade requires positive quantity", decision=decision)
        try:
            order = submit_paper_order(
                normalized_symbol,
                "sell",
                close_quantity,
                "market",
                asset_type,
                None,
                None,
                idea_id,
                notes,
            )
        except ValueError as exc:
            return _execution_rejected(str(exc), decision=decision)
        fill_result = None
        if fill_market_orders:
            price = _positive_float(fill_price, 0.0)
            if price <= 0:
                return {
                    "executed": True,
                    "execution_action": "submitted_close_order",
                    "order": order,
                    "fill_result": None,
                    "fill_skipped_reason": "fill_market_orders requested but fill_price was not positive",
                    "decision": {**decision, "execution_submitted": True},
                    "paper_only": True,
                    "live_execution": False,
                    "execution_submitted": True,
                    "account": paper_account_snapshot(),
                }
            try:
                fill_result = fill_paper_order(order["id"], price, source="ai_paper_trader_execution")
            except ValueError as exc:
                return _execution_rejected(str(exc), decision=decision, action="fill_rejected")
        return {
            "executed": True,
            "execution_action": "submitted_close_order",
            "order": order,
            "fill_result": fill_result,
            "decision": {**decision, "execution_submitted": True},
            "paper_only": True,
            "live_execution": False,
            "execution_submitted": True,
            "account": paper_account_snapshot(),
        }

    if cancel_open_orders_on_no_trade and action in {"hold", "no_trade"}:
        cancelled = []
        for order in _open_orders_for_symbol(normalized_symbol):
            try:
                cancelled.append(cancel_paper_order(order["id"]))
            except ValueError:
                continue
        return {
            "executed": bool(cancelled),
            "execution_action": "cancelled_open_orders" if cancelled else "no_action",
            "cancelled_orders": cancelled,
            "decision": decision,
            "paper_only": True,
            "live_execution": False,
            "execution_submitted": False,
            "account": paper_account_snapshot(),
        }

    return {
        "executed": False,
        "execution_action": "no_action",
        "reason": f"decision action {action} does not submit paper orders",
        "decision": decision,
        "paper_only": True,
        "live_execution": False,
        "execution_submitted": False,
        "account": paper_account_snapshot(),
    }
