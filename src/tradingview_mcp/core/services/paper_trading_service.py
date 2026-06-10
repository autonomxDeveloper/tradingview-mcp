"""Simulated paper-trading account storage and accounting helpers.

This module is intentionally paper-only. It does not place live broker orders,
does not call broker trading endpoints, and persists only local simulation state.
"""
from __future__ import annotations

import json
import os
from copy import deepcopy
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from uuid import uuid4


DEFAULT_INITIAL_CASH = 10000.0
SUPPORTED_ORDER_TYPES = {"market", "limit", "stop"}
SUPPORTED_SIDES = {"buy", "sell"}


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def paper_state_path() -> Path:
    return Path(os.environ.get("TRADING_WORKSTATION_PAPER_TRADING", "data/workstation_paper_trading.json"))


def _round_money(value: float) -> float:
    return round(float(value), 6)


def _default_state(initial_cash: float = DEFAULT_INITIAL_CASH, currency: str = "USD") -> dict[str, Any]:
    timestamp = _utc_now()
    return {
        "mode": "simulated_paper_trading",
        "execution_enabled": False,
        "paper_simulation_enabled": True,
        "account": {
            "id": "paper-default",
            "currency": currency.upper() or "USD",
            "initial_cash": _round_money(initial_cash),
            "cash": _round_money(initial_cash),
            "realized_pnl": 0.0,
            "created_at_utc": timestamp,
            "updated_at_utc": timestamp,
        },
        "positions": {},
        "orders": [],
        "fills": [],
    }


def _load_state() -> dict[str, Any]:
    path = paper_state_path()
    if not path.exists():
        return _default_state()
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return _default_state()
    if not isinstance(payload, dict):
        return _default_state()
    state = _default_state()
    state.update(payload)
    state["account"] = {**_default_state()["account"], **dict(payload.get("account") or {})}
    state["positions"] = dict(payload.get("positions") or {})
    state["orders"] = list(payload.get("orders") or [])
    state["fills"] = list(payload.get("fills") or [])
    state["execution_enabled"] = False
    state["paper_simulation_enabled"] = True
    return state


def _save_state(state: dict[str, Any]) -> dict[str, Any]:
    path = paper_state_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    state["execution_enabled"] = False
    state["paper_simulation_enabled"] = True
    state.setdefault("account", {})["updated_at_utc"] = _utc_now()
    path.write_text(json.dumps(state, indent=2, sort_keys=True), encoding="utf-8")
    return deepcopy(state)


def reset_paper_account(initial_cash: float = DEFAULT_INITIAL_CASH, currency: str = "USD") -> dict[str, Any]:
    """Reset the local simulation account and remove positions/orders/fills."""
    safe_cash = max(0.0, float(initial_cash))
    return _save_state(_default_state(safe_cash, currency))


def read_paper_state() -> dict[str, Any]:
    """Return the raw local paper-trading state."""
    return deepcopy(_load_state())


def _normalize_symbol(symbol: str) -> str:
    return symbol.strip().upper()


def _normalize_quantity(quantity: float) -> float:
    value = float(quantity)
    if value <= 0:
        raise ValueError("quantity must be greater than zero")
    return value


def _normalize_price(price: float | None, field_name: str = "price") -> float:
    if price is None:
        raise ValueError(f"{field_name} is required")
    value = float(price)
    if value <= 0:
        raise ValueError(f"{field_name} must be greater than zero")
    return value


def _position_template(symbol: str, asset_type: str = "stock") -> dict[str, Any]:
    return {
        "symbol": symbol,
        "asset_type": asset_type or "stock",
        "quantity": 0.0,
        "average_price": 0.0,
        "realized_pnl": 0.0,
        "updated_at_utc": _utc_now(),
    }


def _apply_buy(position: dict[str, Any], quantity: float, price: float) -> None:
    old_quantity = float(position.get("quantity") or 0.0)
    old_average = float(position.get("average_price") or 0.0)
    new_quantity = old_quantity + quantity
    total_cost = old_quantity * old_average + quantity * price
    position["quantity"] = _round_money(new_quantity)
    position["average_price"] = _round_money(total_cost / new_quantity if new_quantity else 0.0)
    position["updated_at_utc"] = _utc_now()


def _apply_sell(position: dict[str, Any], quantity: float, price: float) -> float:
    old_quantity = float(position.get("quantity") or 0.0)
    if quantity > old_quantity:
        raise ValueError("sell quantity exceeds open paper position")
    average = float(position.get("average_price") or 0.0)
    realized = (price - average) * quantity
    remaining = old_quantity - quantity
    position["quantity"] = _round_money(remaining)
    if remaining == 0:
        position["average_price"] = 0.0
    position["realized_pnl"] = _round_money(float(position.get("realized_pnl") or 0.0) + realized)
    position["updated_at_utc"] = _utc_now()
    return realized


def create_paper_order(
    symbol: str,
    side: str,
    quantity: float,
    order_type: str = "market",
    asset_type: str = "stock",
    limit_price: float | None = None,
    stop_price: float | None = None,
    idea_id: str | None = None,
    notes: str = "",
) -> dict[str, Any]:
    """Create a local simulated order without filling it."""
    clean_symbol = _normalize_symbol(symbol)
    clean_side = side.lower().strip()
    clean_type = order_type.lower().strip()
    if clean_side not in SUPPORTED_SIDES:
        raise ValueError(f"unsupported paper order side: {side}")
    if clean_type not in SUPPORTED_ORDER_TYPES:
        raise ValueError(f"unsupported paper order type: {order_type}")
    clean_quantity = _normalize_quantity(quantity)
    if clean_type == "limit":
        _normalize_price(limit_price, "limit_price")
    if clean_type == "stop":
        _normalize_price(stop_price, "stop_price")
    timestamp = _utc_now()
    return {
        "id": str(uuid4()),
        "symbol": clean_symbol,
        "asset_type": asset_type or "stock",
        "side": clean_side,
        "quantity": _round_money(clean_quantity),
        "order_type": clean_type,
        "limit_price": _round_money(limit_price) if limit_price is not None else None,
        "stop_price": _round_money(stop_price) if stop_price is not None else None,
        "status": "open",
        "idea_id": idea_id,
        "notes": notes,
        "created_at_utc": timestamp,
        "updated_at_utc": timestamp,
        "simulated": True,
        "live_execution": False,
    }


def add_paper_order(order: dict[str, Any]) -> dict[str, Any]:
    state = _load_state()
    record = deepcopy(order)
    state.setdefault("orders", []).append(record)
    _save_state(state)
    return record


def submit_paper_order(
    symbol: str,
    side: str,
    quantity: float,
    order_type: str = "market",
    asset_type: str = "stock",
    limit_price: float | None = None,
    stop_price: float | None = None,
    idea_id: str | None = None,
    notes: str = "",
) -> dict[str, Any]:
    """Create and persist a simulated order. Filling is handled separately."""
    order = create_paper_order(symbol, side, quantity, order_type, asset_type, limit_price, stop_price, idea_id, notes)
    return add_paper_order(order)


def fill_paper_order(order_id: str, fill_price: float, fill_quantity: float | None = None, source: str = "manual") -> dict[str, Any]:
    """Fill an open paper order at a caller-provided simulated price."""
    price = _normalize_price(fill_price, "fill_price")
    state = _load_state()
    orders = state.setdefault("orders", [])
    order = next((item for item in orders if item.get("id") == order_id), None)
    if order is None:
        raise ValueError("paper order not found")
    if order.get("status") not in {"open", "partial"}:
        raise ValueError("paper order is not open")
    order_quantity = float(order.get("quantity") or 0.0)
    existing_filled = sum(float(fill.get("quantity") or 0.0) for fill in state.get("fills", []) if fill.get("order_id") == order_id)
    remaining = max(0.0, order_quantity - existing_filled)
    quantity = remaining if fill_quantity is None else min(_normalize_quantity(fill_quantity), remaining)
    if quantity <= 0:
        raise ValueError("paper order has no remaining quantity")

    account = state.setdefault("account", _default_state()["account"])
    cash = float(account.get("cash") or 0.0)
    notional = price * quantity
    symbol = str(order.get("symbol") or "").upper()
    position = state.setdefault("positions", {}).setdefault(symbol, _position_template(symbol, str(order.get("asset_type") or "stock")))
    side = str(order.get("side") or "").lower()

    realized = 0.0
    if side == "buy":
        if notional > cash:
            raise ValueError("insufficient paper cash")
        account["cash"] = _round_money(cash - notional)
        _apply_buy(position, quantity, price)
    elif side == "sell":
        realized = _apply_sell(position, quantity, price)
        account["cash"] = _round_money(cash + notional)
        account["realized_pnl"] = _round_money(float(account.get("realized_pnl") or 0.0) + realized)
    else:
        raise ValueError("unsupported paper order side")

    if float(position.get("quantity") or 0.0) == 0:
        state["positions"].pop(symbol, None)

    fill = {
        "id": str(uuid4()),
        "order_id": order_id,
        "symbol": symbol,
        "side": side,
        "quantity": _round_money(quantity),
        "price": _round_money(price),
        "notional": _round_money(notional),
        "realized_pnl": _round_money(realized),
        "source": source,
        "timestamp_utc": _utc_now(),
        "simulated": True,
        "live_execution": False,
    }
    state.setdefault("fills", []).append(fill)

    total_filled = existing_filled + quantity
    order["status"] = "filled" if total_filled >= order_quantity else "partial"
    order["filled_quantity"] = _round_money(total_filled)
    order["average_fill_price"] = _round_money(
        sum(float(item.get("price") or 0.0) * float(item.get("quantity") or 0.0) for item in state["fills"] if item.get("order_id") == order_id)
        / total_filled
    )
    order["updated_at_utc"] = _utc_now()
    _save_state(state)
    return {"order": deepcopy(order), "fill": fill, "account": paper_account_snapshot()}


def cancel_paper_order(order_id: str) -> dict[str, Any]:
    state = _load_state()
    order = next((item for item in state.setdefault("orders", []) if item.get("id") == order_id), None)
    if order is None:
        raise ValueError("paper order not found")
    if order.get("status") not in {"open", "partial"}:
        raise ValueError("only open or partial paper orders can be cancelled")
    order["status"] = "cancelled"
    order["updated_at_utc"] = _utc_now()
    _save_state(state)
    return deepcopy(order)


def paper_account_snapshot(mark_prices: dict[str, float] | None = None) -> dict[str, Any]:
    """Return account, open positions, and mark-to-market equity."""
    state = _load_state()
    marks = {key.upper(): float(value) for key, value in (mark_prices or {}).items() if value is not None}
    positions = []
    market_value = 0.0
    unrealized = 0.0
    for symbol, position in sorted(state.get("positions", {}).items()):
        quantity = float(position.get("quantity") or 0.0)
        average = float(position.get("average_price") or 0.0)
        mark = marks.get(symbol, average)
        value = quantity * mark
        pnl = (mark - average) * quantity
        market_value += value
        unrealized += pnl
        row = deepcopy(position)
        row["mark_price"] = _round_money(mark)
        row["market_value"] = _round_money(value)
        row["unrealized_pnl"] = _round_money(pnl)
        positions.append(row)
    account = deepcopy(state.get("account") or {})
    cash = float(account.get("cash") or 0.0)
    return {
        "mode": "simulated_paper_trading",
        "execution_enabled": False,
        "paper_simulation_enabled": True,
        "account": {
            **account,
            "cash": _round_money(cash),
            "market_value": _round_money(market_value),
            "equity": _round_money(cash + market_value),
            "unrealized_pnl": _round_money(unrealized),
            "realized_pnl": _round_money(float(account.get("realized_pnl") or 0.0)),
        },
        "positions": positions,
        "open_orders": [deepcopy(order) for order in state.get("orders", []) if order.get("status") in {"open", "partial"}],
        "recent_fills": list(reversed(state.get("fills", [])[-50:])),
        "state_path": str(paper_state_path()),
    }


def list_paper_orders(limit: int = 100) -> list[dict[str, Any]]:
    state = _load_state()
    safe_limit = max(1, min(int(limit), 1000))
    return list(reversed([deepcopy(order) for order in state.get("orders", [])][-safe_limit:]))


def list_paper_fills(limit: int = 100) -> list[dict[str, Any]]:
    state = _load_state()
    safe_limit = max(1, min(int(limit), 1000))
    return list(reversed([deepcopy(fill) for fill in state.get("fills", [])][-safe_limit:]))


def paper_trading_status() -> dict[str, Any]:
    snapshot = paper_account_snapshot()
    return {
        "mode": "simulated_paper_trading",
        "execution_enabled": False,
        "paper_simulation_enabled": True,
        "state_path": str(paper_state_path()),
        "cash": snapshot["account"].get("cash"),
        "equity": snapshot["account"].get("equity"),
        "positions": len(snapshot.get("positions", [])),
        "open_orders": len(snapshot.get("open_orders", [])),
        "recent_fills": len(snapshot.get("recent_fills", [])),
        "supported_order_types": sorted(SUPPORTED_ORDER_TYPES),
        "supported_sides": sorted(SUPPORTED_SIDES),
    }
