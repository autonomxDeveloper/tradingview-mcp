"""AI paper-trader decision helpers.

This module only builds, parses, and validates research-only simulated paper-trading
intent. It never submits live or simulated orders. Execution remains in the paper
trading service/API after explicit guardrails in later phases.
"""
from __future__ import annotations

import json
from datetime import date, datetime, timezone
from typing import Any

SUPPORTED_ACTIONS = {"open_trade", "close_trade", "hold", "no_trade"}
SUPPORTED_SIDES = {"buy", "sell", "none"}
SUPPORTED_ORDER_TYPES = {"market", "limit", "stop"}
SUPPORTED_CONFIDENCE = {"low", "medium", "high"}
CONFIDENCE_RANK = {"low": 1, "medium": 2, "high": 3}


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


def _bool(value: Any, default: bool = False) -> bool:
    if isinstance(value, bool):
        return value
    if value is None:
        return default
    clean = str(value).strip().lower()
    if clean in {"1", "true", "yes", "y", "on"}:
        return True
    if clean in {"0", "false", "no", "n", "off"}:
        return False
    return default


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


def _normalize_symbol(value: Any) -> str:
    return str(value or "").strip().upper()


def _symbol_set(value: Any) -> set[str]:
    return {_normalize_symbol(item) for item in _string_list(value) if _normalize_symbol(item)}


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


def _date_from_value(value: Any) -> date | None:
    if not value:
        return None
    if isinstance(value, date) and not isinstance(value, datetime):
        return value
    if isinstance(value, datetime):
        return value.date()
    text = str(value).strip()
    if not text:
        return None
    normalized = text.replace("Z", "+00:00")
    try:
        return datetime.fromisoformat(normalized).date()
    except ValueError:
        return None


def _today_utc() -> date:
    return datetime.now(timezone.utc).date()


def _positions(context: dict[str, Any]) -> list[dict[str, Any]]:
    account = context.get("paper_account") or {}
    if isinstance(account.get("positions"), list):
        return account.get("positions") or []
    if isinstance(account.get("account"), dict) and isinstance(account["account"].get("positions"), list):
        return account["account"].get("positions") or []
    return []


def _matching_positions(context: dict[str, Any], symbol: str) -> list[dict[str, Any]]:
    normalized = _normalize_symbol(symbol)
    return [position for position in _positions(context) if _normalize_symbol(position.get("symbol")) == normalized and _positive_float(position.get("quantity"), 0.0) > 0]


def _open_order_count(context: dict[str, Any], symbol: str | None = None) -> int:
    normalized = _normalize_symbol(symbol)
    count = 0
    for order in context.get("open_orders") or []:
        if normalized and _normalize_symbol(order.get("symbol")) != normalized:
            continue
        status = str(order.get("status") or "open").lower()
        if status in {"open", "pending", "submitted", "accepted"}:
            count += 1
    return count


def _trade_count_today(context: dict[str, Any]) -> int:
    today = _today_utc()
    count = 0
    for fill in context.get("recent_fills") or []:
        filled_at = _date_from_value(fill.get("filled_at") or fill.get("timestamp") or fill.get("created_at"))
        if filled_at == today:
            count += 1
    return count


def _account_cash(context: dict[str, Any]) -> float:
    account = context.get("paper_account") or {}
    if isinstance(account.get("account"), dict):
        return _positive_float(account["account"].get("cash"), 0.0)
    return _positive_float(account.get("cash"), 0.0)


def _latest_price(decision: dict[str, Any], context: dict[str, Any]) -> float:
    chart = context.get("chart_context") or {}
    latest_bar = chart.get("latest_bar") or {}
    candidates = [
        decision.get("limit_price"),
        decision.get("stop_price") if decision.get("order_type") == "stop" else None,
        latest_bar.get("close"),
        chart.get("last_price"),
        context.get("market", {}).get("price"),
        context.get("market", {}).get("last_price"),
    ]
    for candidate in candidates:
        parsed = _positive_float(candidate, 0.0)
        if parsed > 0:
            return parsed
    return 0.0


def _risk_reward_number(value: Any) -> float | None:
    if value is None:
        return None
    if isinstance(value, (int, float)):
        return float(value) if value > 0 else None
    text = str(value).lower().strip()
    if not text or text == "unknown":
        return None
    for token in ["risk_reward", "rr", "r/r", "ratio", "~", "≈"]:
        text = text.replace(token, " ")
    text = text.replace("to", ":")
    if ":" in text:
        left, right = text.split(":", 1)
        left_value = _positive_float(left.strip(), 0.0)
        right_value = _positive_float(right.strip(), 0.0)
        if left_value and right_value:
            return left_value / right_value
    parts = [part for part in text.replace(",", " ").split() if part]
    for part in parts:
        parsed = _positive_float(part, 0.0)
        if parsed:
            return parsed
    return None


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
            "max_risk_per_trade_value": 100.0,
            "max_trades_per_day": 3,
            "max_open_positions": 3,
            "max_open_orders": 5,
            "allow_short": False,
            "allowed_symbols": [],
            "blocked_symbols": [],
            "require_invalidation": True,
            "require_confirmation": True,
            "require_stop_price": False,
            "require_market_open": False,
            "market_session": "unknown",
            "min_confidence_for_open": "low",
            "min_risk_reward": 0.0,
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
                "Return strict JSON only. Use no_trade when evidence is unclear, risk is not bounded, or confirmation is missing. "
                "Respect all guardrail settings in the risk object: allowed/blocked symbols, market session, trade limits, confidence, sizing, and risk/reward."
            ),
        },
        {
            "role": "user",
            "content": (
                "Analyze this multi-timeframe/chart/paper-account context and return one strict JSON decision. "
                "Do not force trades. open_trade requires quantity > 0, side buy/sell, clear invalidation, and paper_trade_candidate=true. "
                "close_trade is only for existing paper positions. hold/no_trade should use side none and quantity 0. "
                "If any deterministic guardrail would reject the idea, prefer no_trade and explain which evidence is missing. "
                f"Required schema example:\n{json.dumps(schema, indent=2)}\n\n"
                f"Decision context:\n{json.dumps(context, indent=2, sort_keys=True, default=str)}"
            ),
        },
    ]


def validate_ai_paper_trader_decision(decision: dict[str, Any], context: dict[str, Any]) -> dict[str, Any]:
    """Apply deterministic guardrails to a parsed AI paper-trader decision."""
    guarded = dict(decision)
    warnings = list(guarded.get("guardrail_warnings") or [])
    risk = context.get("risk") or {}
    symbol = _normalize_symbol(context.get("symbol"))
    action = _normalize_action(guarded.get("action"))
    side = _normalize_side(guarded.get("side"), action)
    quantity = _positive_float(guarded.get("quantity"), 0.0)
    confidence = _normalize_confidence(guarded.get("confidence"))

    guarded["action"] = action
    guarded["side"] = side
    guarded["quantity"] = quantity
    guarded["confidence"] = confidence
    guarded["paper_only"] = True
    guarded["live_execution"] = False
    guarded["not_financial_advice"] = True
    guarded["execution_submitted"] = False

    allowed_symbols = _symbol_set(risk.get("allowed_symbols"))
    blocked_symbols = _symbol_set(risk.get("blocked_symbols"))
    position_count = len(_positions(context))
    symbol_positions = _matching_positions(context, symbol)
    open_order_count = _open_order_count(context)
    symbol_open_order_count = _open_order_count(context, symbol)
    trades_today = _trade_count_today(context)
    price = _latest_price(guarded, context)
    estimated_value = quantity * price
    cash = _account_cash(context)
    rr = _risk_reward_number(guarded.get("risk_reward"))

    if allowed_symbols and symbol not in allowed_symbols:
        warnings.append(f"symbol {symbol or 'unknown'} is not in allowed_symbols.")
    if symbol in blocked_symbols:
        warnings.append(f"symbol {symbol} is blocked by risk settings.")

    if action == "open_trade":
        if _bool(risk.get("require_market_open")):
            session = str(risk.get("market_session") or "unknown").lower().strip()
            if session not in {"open", "regular", "extended", "crypto_24_7"}:
                warnings.append(f"market_session is {session or 'unknown'} while require_market_open is true.")
        if trades_today >= int(_positive_float(risk.get("max_trades_per_day"), 0.0) or 0):
            warnings.append("max_trades_per_day has already been reached.")
        max_open_positions = int(_positive_float(risk.get("max_open_positions"), 0.0) or 0)
        if max_open_positions and position_count >= max_open_positions and not symbol_positions:
            warnings.append("max_open_positions would be exceeded.")
        max_open_orders = int(_positive_float(risk.get("max_open_orders"), 0.0) or 0)
        if max_open_orders and open_order_count >= max_open_orders:
            warnings.append("max_open_orders has already been reached.")
        if symbol_open_order_count:
            warnings.append(f"symbol {symbol} already has {symbol_open_order_count} open paper order(s).")
        if side not in {"buy", "sell"}:
            warnings.append("open_trade requires side buy or sell.")
        if side == "sell" and not _bool(risk.get("allow_short")):
            warnings.append("short/sell open_trade is disabled by allow_short=false.")
        if quantity <= 0:
            warnings.append("open_trade requires quantity greater than zero.")
        if not _text(guarded.get("invalidation")):
            warnings.append("open_trade requires a clear invalidation condition.")
        if _bool(risk.get("require_stop_price")) and not _optional_positive_float(guarded.get("stop_price")):
            warnings.append("open_trade requires stop_price when require_stop_price is true.")
        if risk.get("require_confirmation") and not guarded.get("required_confirmations"):
            warnings.append("open_trade requires at least one confirmation condition.")
        if not guarded.get("paper_trade_candidate"):
            warnings.append("open_trade requires paper_trade_candidate=true.")
        min_confidence = _normalize_confidence(risk.get("min_confidence_for_open"))
        if CONFIDENCE_RANK[confidence] < CONFIDENCE_RANK[min_confidence]:
            warnings.append(f"confidence {confidence} is below min_confidence_for_open {min_confidence}.")
        max_value = _positive_float(risk.get("max_position_value"), 0.0)
        if max_value and estimated_value and estimated_value > max_value:
            warnings.append(f"estimated paper position value {estimated_value:.2f} exceeds max_position_value {max_value:.2f}.")
        if side == "buy" and cash and estimated_value and estimated_value > cash:
            warnings.append(f"estimated paper position value {estimated_value:.2f} exceeds available paper cash {cash:.2f}.")
        max_risk_value = _positive_float(risk.get("max_risk_per_trade_value"), 0.0)
        stop_price = _optional_positive_float(guarded.get("stop_price"))
        if max_risk_value and price and stop_price and quantity:
            estimated_risk = abs(price - stop_price) * quantity
            guarded["estimated_risk_value"] = round(estimated_risk, 6)
            if estimated_risk > max_risk_value:
                warnings.append(f"estimated paper risk {estimated_risk:.2f} exceeds max_risk_per_trade_value {max_risk_value:.2f}.")
        min_rr = _positive_float(risk.get("min_risk_reward"), 0.0)
        if min_rr and (rr is None or rr < min_rr):
            warnings.append(f"risk_reward {guarded.get('risk_reward') or 'unknown'} is below min_risk_reward {min_rr:.2f}.")
        if warnings:
            guarded["action"] = "no_trade"
            guarded["side"] = "none"
            guarded["quantity"] = 0.0
            guarded["paper_trade_candidate"] = False
    elif action == "close_trade":
        if not symbol_positions:
            warnings.append("close_trade requires an existing paper position for the requested symbol.")
            guarded["action"] = "no_trade"
            guarded["side"] = "none"
            guarded["quantity"] = 0.0
            guarded["paper_trade_candidate"] = False
        elif quantity <= 0:
            # Close decisions may omit quantity; use a safe explicit default for later adapters.
            guarded["quantity"] = _positive_float(symbol_positions[0].get("quantity"), 0.0)
            guarded["side"] = "sell"
            guarded["paper_trade_candidate"] = False
    else:
        guarded["side"] = "none"
        guarded["quantity"] = 0.0
        guarded["paper_trade_candidate"] = False

    guarded["estimated_position_value"] = round(estimated_value, 6) if estimated_value else 0.0
    guarded["trade_count_today"] = trades_today
    guarded["open_order_count"] = open_order_count
    guarded["position_count"] = position_count
    guarded["guardrail_warnings"] = warnings
    if warnings and guarded["action"] == "no_trade":
        guarded["reasoning_summary"] = _text(guarded.get("reasoning_summary"), "Decision blocked by guardrails.")
        guarded["risks"] = sorted(set(_string_list(guarded.get("risks")) + warnings))
    return guarded
