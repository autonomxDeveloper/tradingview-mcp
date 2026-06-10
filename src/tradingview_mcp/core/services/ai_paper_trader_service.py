"""AI paper-trader decision helpers.

This module only builds, parses, and validates research-only simulated paper-trading
intent. It never submits live or simulated orders. Execution remains in the paper
trading service/API after explicit guardrails in later phases.
"""
from __future__ import annotations

import json
from typing import Any

SUPPORTED_ACTIONS = {"open_trade", "close_trade", "hold", "no_trade"}
SUPPORTED_SIDES = {"buy", "sell", "none"}
SUPPORTED_ORDER_TYPES = {"market", "limit", "stop"}
SUPPORTED_CONFIDENCE = {"low", "medium", "high"}


def _string_list(value: Any) -> list[str]:
    if value is None or value == "":
        return []
    if isinstance(value, list):
        return [str(item) for item in value if item is not None and str(item).strip()]
    return [str(value)]


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


def _optional_positive_float(value: Any) -> float | None:
    try:
        parsed = float(value)
    except (TypeError, ValueError):
        return None
    return parsed if parsed > 0 else None


def _normalize_action(value: Any) -> str:
    clean = str(value or "").lower().strip().replace(" ", "_").replace("-", "_")
    aliases = {
        "buy": "open_trade",
        "sell": "open_trade",
        "enter": "open_trade",
        "entry": "open_trade",
        "open": "open_trade",
        "exit": "close_trade",
        "close": "close_trade",
        "flat": "no_trade",
        "wait": "no_trade",
    }
    clean = aliases.get(clean, clean)
    return clean if clean in SUPPORTED_ACTIONS else "no_trade"


def _normalize_side(value: Any, action: str = "no_trade") -> str:
    clean = str(value or "").lower().strip()
    if clean in {"long", "buy", "bullish"}:
        return "buy"
    if clean in {"short", "sell", "bearish"}:
        return "sell"
    return "none" if action in {"hold", "no_trade"} else "none"


def _normalize_order_type(value: Any) -> str:
    clean = str(value or "market").lower().strip()
    return clean if clean in SUPPORTED_ORDER_TYPES else "market"


def _normalize_confidence(value: Any) -> str:
    clean = str(value or "low").lower().strip()
    return clean if clean in SUPPORTED_CONFIDENCE else "low"


def _load_json_object(content: str) -> dict[str, Any] | None:
    cleaned = str(content or "").strip()
    if not cleaned:
        return None
    if cleaned.startswith("```"):
        cleaned = cleaned.strip("`").strip()
        if cleaned.lower().startswith("json"):
            cleaned = cleaned[4:].strip()
    try:
        payload = json.loads(cleaned)
    except json.JSONDecodeError:
        return None
    return payload if isinstance(payload, dict) else None


def no_trade_decision(reason: str, *, raw: Any = None) -> dict[str, Any]:
    """Return a safe no-trade decision object."""
    decision = {
        "parsed": raw is None,
        "action": "no_trade",
        "side": "none",
        "order_type": "market",
        "quantity": 0.0,
        "limit_price": None,
        "stop_price": None,
        "take_profit": None,
        "confidence": "low",
        "risk_reward": "unknown",
        "reasoning_summary": reason,
        "invalidation": "not applicable",
        "risks": [reason],
        "required_confirmations": [],
        "paper_trade_candidate": False,
        "not_financial_advice": True,
        "paper_only": True,
        "live_execution": False,
        "guardrail_warnings": [reason],
    }
    if raw is not None:
        decision["raw"] = raw
    return decision


def parse_ai_paper_trader_decision(content: str) -> dict[str, Any]:
    """Parse and normalize an AI paper-trader decision from strict JSON content."""
    payload = _load_json_object(content)
    if payload is None:
        return no_trade_decision("AI paper trader did not return valid JSON.", raw=content)

    action = _normalize_action(payload.get("action"))
    side = _normalize_side(payload.get("side") or payload.get("direction"), action)
    decision = {
        "parsed": True,
        "action": action,
        "side": side,
        "order_type": _normalize_order_type(payload.get("order_type") or payload.get("entry_type")),
        "quantity": _positive_float(payload.get("quantity"), 0.0),
        "limit_price": _optional_positive_float(payload.get("limit_price") or payload.get("entry_price")),
        "stop_price": _optional_positive_float(payload.get("stop_price") or payload.get("stop_loss")),
        "take_profit": _optional_positive_float(payload.get("take_profit") or payload.get("target_price")),
        "confidence": _normalize_confidence(payload.get("confidence")),
        "risk_reward": _text(payload.get("risk_reward"), "unknown"),
        "reasoning_summary": _text(payload.get("reasoning_summary") or payload.get("summary"), "No reasoning returned."),
        "invalidation": _text(payload.get("invalidation"), ""),
        "risks": _string_list(payload.get("risks")),
        "required_confirmations": _string_list(payload.get("required_confirmations") or payload.get("confirmations")),
        "paper_trade_candidate": bool(payload.get("paper_trade_candidate", action == "open_trade")),
        "not_financial_advice": payload.get("not_financial_advice") is not False,
        "paper_only": True,
        "live_execution": False,
        "guardrail_warnings": [],
        "raw": payload,
    }
    if decision["action"] in {"hold", "no_trade"}:
        decision["side"] = "none"
        decision["quantity"] = 0.0
        decision["paper_trade_candidate"] = False
    return decision


def build_ai_paper_trader_context(
    *,
    symbol: str,
    asset_type: str,
    exchange: str,
    active_timeframe: str,
    timeframes: list[str],
    profile: str,
    mode: str,
    market: dict[str, Any],
    chart_context: dict[str, Any] | None = None,
    paper_account: dict[str, Any] | None = None,
    open_orders: list[dict[str, Any]] | None = None,
    recent_fills: list[dict[str, Any]] | None = None,
    risk: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Build a compact decision context for the AI paper-trader prompt."""
    return {
        "symbol": symbol.strip().upper(),
        "asset_type": asset_type,
        "exchange": exchange,
        "active_timeframe": active_timeframe,
        "timeframes": timeframes or [active_timeframe],
        "profile": profile,
        "mode": mode,
        "market": market,
        "chart_context": chart_context or {},
        "paper_account": paper_account or {},
        "open_orders": open_orders or [],
        "recent_fills": recent_fills or [],
        "risk": {
            "max_position_value": 1000.0,
            "max_trades_per_day": 3,
            "require_invalidation": True,
            "require_confirmation": True,
            **(risk or {}),
        },
        "safety": {
            "paper_only": True,
            "live_execution": False,
            "decision_only": True,
            "execution_adapter_enabled": False,
        },
    }


def ai_paper_trader_prompt(context: dict[str, Any]) -> list[dict[str, str]]:
    """Return LM Studio chat messages for a strict paper-trader decision request."""
    schema = {
        "action": "open_trade | close_trade | hold | no_trade",
        "side": "buy | sell | none",
        "order_type": "market | limit | stop",
        "quantity": 0,
        "limit_price": None,
        "stop_price": None,
        "take_profit": None,
        "confidence": "low | medium | high",
        "risk_reward": "unknown or ratio/description",
        "reasoning_summary": "brief evidence-based explanation",
        "invalidation": "clear condition that invalidates the idea",
        "risks": [],
        "required_confirmations": [],
        "paper_trade_candidate": False,
        "not_financial_advice": True,
        "paper_only": True,
        "live_execution": False,
    }
    return [
        {
            "role": "system",
            "content": (
                "You are an AI paper-trading decision engine inside a local research workstation. "
                "You may only produce decisions for simulated paper trading. You never recommend or place live broker orders. "
                "Return strict JSON only. Use no_trade when evidence is unclear, risk is not bounded, or confirmation is missing."
            ),
        },
        {
            "role": "user",
            "content": (
                "Analyze this multi-timeframe/chart/paper-account context and return one strict JSON decision. "
                "Do not force trades. open_trade requires quantity > 0, side buy/sell, clear invalidation, and paper_trade_candidate=true. "
                "close_trade is only for existing paper positions. hold/no_trade should use side none and quantity 0. "
                f"Required schema example:\n{json.dumps(schema, indent=2)}\n\n"
                f"Decision context:\n{json.dumps(context, indent=2, sort_keys=True, default=str)}"
            ),
        },
    ]


def validate_ai_paper_trader_decision(decision: dict[str, Any], context: dict[str, Any]) -> dict[str, Any]:
    """Apply deterministic guardrails to a parsed AI paper-trader decision."""
    guarded = dict(decision)
    warnings = list(guarded.get("guardrail_warnings") or [])
    action = _normalize_action(guarded.get("action"))
    side = _normalize_side(guarded.get("side"), action)
    quantity = _positive_float(guarded.get("quantity"), 0.0)

    guarded["action"] = action
    guarded["side"] = side
    guarded["quantity"] = quantity
    guarded["paper_only"] = True
    guarded["live_execution"] = False
    guarded["not_financial_advice"] = True

    if action == "open_trade":
        if side not in {"buy", "sell"}:
            warnings.append("open_trade requires side buy or sell.")
        if quantity <= 0:
            warnings.append("open_trade requires quantity greater than zero.")
        if not _text(guarded.get("invalidation")):
            warnings.append("open_trade requires a clear invalidation condition.")
        if context.get("risk", {}).get("require_confirmation") and not guarded.get("required_confirmations"):
            warnings.append("open_trade requires at least one confirmation condition.")
        max_value = _positive_float(context.get("risk", {}).get("max_position_value"), 0.0)
        price = guarded.get("limit_price") or guarded.get("stop_price") or context.get("chart_context", {}).get("latest_bar", {}).get("close")
        estimated_value = quantity * _positive_float(price, 0.0)
        if max_value and estimated_value and estimated_value > max_value:
            warnings.append(f"estimated paper position value {estimated_value:.2f} exceeds max_position_value {max_value:.2f}.")
        if warnings:
            guarded["action"] = "no_trade"
            guarded["side"] = "none"
            guarded["quantity"] = 0.0
            guarded["paper_trade_candidate"] = False
    elif action == "close_trade":
        positions = context.get("paper_account", {}).get("positions") or []
        if not positions:
            warnings.append("close_trade requires an existing paper position.")
            guarded["action"] = "no_trade"
            guarded["side"] = "none"
            guarded["quantity"] = 0.0
            guarded["paper_trade_candidate"] = False
    else:
        guarded["side"] = "none"
        guarded["quantity"] = 0.0
        guarded["paper_trade_candidate"] = False

    guarded["guardrail_warnings"] = warnings
    if warnings and guarded["action"] == "no_trade":
        guarded["reasoning_summary"] = _text(guarded.get("reasoning_summary"), "Decision blocked by guardrails.")
        guarded["risks"] = sorted(set(_string_list(guarded.get("risks")) + warnings))
    return guarded
