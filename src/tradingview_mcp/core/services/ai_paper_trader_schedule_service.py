"""Local schedule storage for AI paper-trader jobs.

Schedules are local workstation metadata only. This module does not run a
background loop, does not call the AI decision endpoint, and does not submit
paper or live orders. It only persists schedules and builds explicit run
requests for callers that choose to run them.
"""
from __future__ import annotations

import json
import os
from datetime import datetime, time, timedelta, timezone
from pathlib import Path
from typing import Any
from uuid import uuid4

SUPPORTED_TRIGGER_TYPES = {"manual", "interval", "daily_time", "market_open"}
SUPPORTED_ASSET_TYPES = {"stock", "crypto", "other"}
SUPPORTED_MODES = {"paper_trader_scheduled_decision", "paper_trader_scheduled_review"}
WEEKDAY_MARKET_DAYS = {0, 1, 2, 3, 4}


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _iso(dt: datetime | None) -> str | None:
    if dt is None:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc).isoformat()


def _parse_dt(value: Any) -> datetime | None:
    if not value:
        return None
    if isinstance(value, datetime):
        return value.astimezone(timezone.utc) if value.tzinfo else value.replace(tzinfo=timezone.utc)
    text = str(value).strip()
    if not text:
        return None
    try:
        parsed = datetime.fromisoformat(text.replace("Z", "+00:00"))
    except ValueError:
        return None
    return parsed.astimezone(timezone.utc) if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)


def _schedule_path() -> Path:
    return Path(os.environ.get("TRADING_WORKSTATION_AI_PAPER_SCHEDULES", "data/workstation_ai_paper_schedules.json"))


def _empty_store() -> dict[str, Any]:
    return {"version": 1, "schedules": []}


def _read_store() -> dict[str, Any]:
    path = _schedule_path()
    if not path.exists():
        return _empty_store()
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return _empty_store()
    if not isinstance(payload, dict):
        return _empty_store()
    schedules = payload.get("schedules")
    if not isinstance(schedules, list):
        payload["schedules"] = []
    payload.setdefault("version", 1)
    return payload


def _write_store(store: dict[str, Any]) -> dict[str, Any]:
    path = _schedule_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(store, indent=2, sort_keys=True), encoding="utf-8")
    return store


def _text(value: Any, fallback: str = "") -> str:
    if value is None:
        return fallback
    text = str(value).strip()
    return text if text else fallback


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


def _positive_int(value: Any, fallback: int) -> int:
    try:
        parsed = int(float(value))
    except (TypeError, ValueError):
        return fallback
    return parsed if parsed > 0 else fallback


def _symbols(value: Any) -> list[str]:
    if isinstance(value, str):
        raw = value.split(",")
    elif isinstance(value, list):
        raw = value
    else:
        raw = []
    seen: set[str] = set()
    symbols: list[str] = []
    for item in raw:
        symbol = str(item or "").strip().upper()
        if not symbol or symbol in seen:
            continue
        seen.add(symbol)
        symbols.append(symbol)
    return symbols


def _string_list(value: Any, fallback: list[str]) -> list[str]:
    if isinstance(value, str):
        raw = [item.strip() for item in value.split(",")]
    elif isinstance(value, list):
        raw = [str(item).strip() for item in value if item is not None]
    else:
        raw = []
    cleaned = [item for item in raw if item]
    return cleaned or fallback


def _parse_utc_time(value: Any, fallback: str = "14:30") -> time:
    text = _text(value, fallback)
    try:
        hour_text, minute_text = text.split(":", 1)
        hour = max(0, min(23, int(hour_text)))
        minute = max(0, min(59, int(minute_text[:2])))
    except (ValueError, AttributeError):
        hour, minute = [int(part) for part in fallback.split(":")]
    return time(hour=hour, minute=minute, tzinfo=timezone.utc)


def _next_daily_time(now: datetime, utc_time: time) -> datetime:
    candidate = datetime.combine(now.date(), utc_time, tzinfo=timezone.utc)
    if candidate <= now:
        candidate += timedelta(days=1)
    return candidate


def _next_weekday_time(now: datetime, utc_time: time) -> datetime:
    candidate = datetime.combine(now.date(), utc_time, tzinfo=timezone.utc)
    if candidate <= now:
        candidate += timedelta(days=1)
    while candidate.weekday() not in WEEKDAY_MARKET_DAYS:
        candidate += timedelta(days=1)
    return candidate


def normalize_trigger(trigger: dict[str, Any] | None) -> dict[str, Any]:
    raw = trigger or {}
    trigger_type = _text(raw.get("type"), "manual").lower().replace("-", "_").replace(" ", "_")
    if trigger_type not in SUPPORTED_TRIGGER_TYPES:
        trigger_type = "manual"
    normalized = {
        "type": trigger_type,
        "interval_minutes": _positive_int(raw.get("interval_minutes"), 15),
        "time_utc": _text(raw.get("time_utc"), "14:30"),
        "market": _text(raw.get("market"), "US"),
        "offset_minutes": int(float(raw.get("offset_minutes", 0) or 0)),
        "description": _text(raw.get("description"), ""),
    }
    return normalized


def next_run_at_for_trigger(trigger: dict[str, Any], *, now: datetime | None = None) -> str | None:
    current = now or _utc_now()
    if current.tzinfo is None:
        current = current.replace(tzinfo=timezone.utc)
    trigger_type = trigger.get("type")
    if trigger_type == "manual":
        return None
    if trigger_type == "interval":
        return _iso(current + timedelta(minutes=_positive_int(trigger.get("interval_minutes"), 15)))
    if trigger_type == "daily_time":
        return _iso(_next_daily_time(current, _parse_utc_time(trigger.get("time_utc"))))
    if trigger_type == "market_open":
        base = _next_weekday_time(current, _parse_utc_time(trigger.get("time_utc"), "14:30"))
        return _iso(base + timedelta(minutes=int(trigger.get("offset_minutes") or 0)))
    return None


def normalize_schedule(payload: dict[str, Any], *, existing: dict[str, Any] | None = None, now: datetime | None = None) -> dict[str, Any]:
    current = now or _utc_now()
    existing = existing or {}
    trigger = normalize_trigger(payload.get("trigger") if isinstance(payload.get("trigger"), dict) else existing.get("trigger"))
    symbols = _symbols(payload.get("symbols", existing.get("symbols", [])))
    asset_type = _text(payload.get("asset_type", existing.get("asset_type", "stock")), "stock").lower()
    if asset_type not in SUPPORTED_ASSET_TYPES:
        asset_type = "stock"
    mode = _text(payload.get("mode", existing.get("mode", "paper_trader_scheduled_decision")), "paper_trader_scheduled_decision")
    if mode not in SUPPORTED_MODES:
        mode = "paper_trader_scheduled_decision"
    schedule = {
        "id": _text(existing.get("id"), str(uuid4())),
        "name": _text(payload.get("name", existing.get("name", "AI paper schedule")), "AI paper schedule"),
        "enabled": _bool(payload.get("enabled", existing.get("enabled", True)), True),
        "symbols": symbols,
        "asset_type": asset_type,
        "exchange": _text(payload.get("exchange", existing.get("exchange", "NASDAQ")), "NASDAQ"),
        "timeframe": _text(payload.get("timeframe", existing.get("timeframe", "5m")), "5m"),
        "timeframes": _string_list(payload.get("timeframes", existing.get("timeframes", ["5m", "15m", "1h", "1D"])), ["5m", "15m", "1h", "1D"]),
        "profile": _text(payload.get("profile", existing.get("profile", "intraday_paper")), "intraday_paper"),
        "mode": mode,
        "trigger": trigger,
        "risk": payload.get("risk", existing.get("risk", {})) if isinstance(payload.get("risk", existing.get("risk", {})), dict) else {},
        "execution": {
            "auto_execute": False,
            "fill_market_orders": _bool((payload.get("execution") or existing.get("execution") or {}).get("fill_market_orders"), False),
            "cancel_open_orders_on_no_trade": _bool((payload.get("execution") or existing.get("execution") or {}).get("cancel_open_orders_on_no_trade"), False),
        },
        "paper_only": True,
        "live_execution": False,
        "created_at": existing.get("created_at") or _iso(current),
        "updated_at": _iso(current),
        "last_run_at": existing.get("last_run_at"),
        "last_result": existing.get("last_result"),
        "run_count": int(existing.get("run_count") or 0),
    }
    schedule["next_run_at"] = payload.get("next_run_at") or existing.get("next_run_at") or next_run_at_for_trigger(trigger, now=current)
    return schedule


def ai_paper_schedule_status() -> dict[str, Any]:
    store = _read_store()
    return {
        "path": str(_schedule_path()),
        "count": len(store.get("schedules", [])),
        "paper_only": True,
        "live_execution": False,
        "background_loop_enabled": False,
    }


def list_ai_paper_schedules() -> list[dict[str, Any]]:
    return list(_read_store().get("schedules", []))


def get_ai_paper_schedule(schedule_id: str) -> dict[str, Any] | None:
    for schedule in list_ai_paper_schedules():
        if schedule.get("id") == schedule_id:
            return schedule
    return None


def create_ai_paper_schedule(payload: dict[str, Any], *, now: datetime | None = None) -> dict[str, Any]:
    schedule = normalize_schedule(payload, now=now)
    store = _read_store()
    store["schedules"].append(schedule)
    _write_store(store)
    return schedule


def update_ai_paper_schedule(schedule_id: str, payload: dict[str, Any], *, now: datetime | None = None) -> dict[str, Any]:
    store = _read_store()
    schedules = store.get("schedules", [])
    for index, existing in enumerate(schedules):
        if existing.get("id") == schedule_id:
            updated = normalize_schedule(payload, existing=existing, now=now)
            schedules[index] = updated
            _write_store(store)
            return updated
    raise ValueError("AI paper schedule not found")


def delete_ai_paper_schedule(schedule_id: str) -> dict[str, Any]:
    store = _read_store()
    schedules = store.get("schedules", [])
    remaining = [schedule for schedule in schedules if schedule.get("id") != schedule_id]
    if len(remaining) == len(schedules):
        raise ValueError("AI paper schedule not found")
    store["schedules"] = remaining
    _write_store(store)
    return {"deleted": True, "schedule_id": schedule_id, "paper_only": True, "live_execution": False}


def due_ai_paper_schedules(*, now: datetime | None = None) -> list[dict[str, Any]]:
    current = now or _utc_now()
    if current.tzinfo is None:
        current = current.replace(tzinfo=timezone.utc)
    due: list[dict[str, Any]] = []
    for schedule in list_ai_paper_schedules():
        if not schedule.get("enabled"):
            continue
        next_run = _parse_dt(schedule.get("next_run_at"))
        if next_run and next_run <= current:
            due.append(schedule)
    return due


def build_ai_paper_schedule_run_request(schedule: dict[str, Any], *, symbol: str | None = None) -> dict[str, Any]:
    symbols = _symbols(schedule.get("symbols"))
    selected_symbol = _text(symbol, symbols[0] if symbols else "")
    return {
        "symbol": selected_symbol.upper(),
        "asset_type": schedule.get("asset_type", "stock"),
        "exchange": schedule.get("exchange", "NASDAQ"),
        "timeframe": schedule.get("timeframe", "5m"),
        "question": "Create a strict paper-only decision for this scheduled AI paper-trader job. Use no_trade unless guardrails and evidence support simulation.",
        "chart_context": {
            "source": "ai_paper_schedule",
            "schedule_id": schedule.get("id"),
            "schedule_name": schedule.get("name"),
        },
        "timeframes": schedule.get("timeframes") or [schedule.get("timeframe", "5m")],
        "profile": schedule.get("profile", "intraday_paper"),
        "mode": schedule.get("mode", "paper_trader_scheduled_decision"),
        "risk": schedule.get("risk", {}),
        "paper_only": True,
        "live_execution": False,
        "execution": schedule.get("execution", {"auto_execute": False}),
    }


def record_ai_paper_schedule_run(schedule_id: str, result: dict[str, Any], *, now: datetime | None = None) -> dict[str, Any]:
    current = now or _utc_now()
    store = _read_store()
    schedules = store.get("schedules", [])
    for index, existing in enumerate(schedules):
        if existing.get("id") == schedule_id:
            updated = dict(existing)
            updated["last_run_at"] = _iso(current)
            updated["last_result"] = result
            updated["run_count"] = int(updated.get("run_count") or 0) + 1
            updated["next_run_at"] = next_run_at_for_trigger(updated.get("trigger", {"type": "manual"}), now=current)
            updated["updated_at"] = _iso(current)
            schedules[index] = updated
            _write_store(store)
            return updated
    raise ValueError("AI paper schedule not found")
