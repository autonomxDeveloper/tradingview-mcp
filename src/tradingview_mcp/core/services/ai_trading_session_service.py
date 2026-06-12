"""Backend storage for paper-safe AI trading workstation sessions.

The AI trading controller is intentionally research/paper only. This service stores
controller state, decisions, events, and simulated AI order records so the UI is no
longer dependent on browser localStorage alone.
"""
from __future__ import annotations

import json
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from uuid import uuid4


DEFAULT_SESSION_ID = "default"


def _base_dir() -> Path:
    return Path(os.environ.get("TRADING_WORKSTATION_AI_TRADING_DIR", "data/ai_trading_sessions"))


def _safe_session_id(session_id: str | None = None) -> str:
    raw = (session_id or DEFAULT_SESSION_ID).strip().lower()
    cleaned = "".join(char if char.isalnum() or char in {"-", "_"} else "-" for char in raw)
    return cleaned.strip("-") or DEFAULT_SESSION_ID


def _session_path(session_id: str | None = None) -> Path:
    return _base_dir() / f"{_safe_session_id(session_id)}.json"


def _events_path(session_id: str | None = None) -> Path:
    return _base_dir() / f"{_safe_session_id(session_id)}.events.jsonl"


def _orders_path(session_id: str | None = None) -> Path:
    return _base_dir() / f"{_safe_session_id(session_id)}.orders.jsonl"


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def ai_trading_status() -> dict[str, Any]:
    base = _base_dir()
    sessions = sorted(path.stem for path in base.glob("*.json")) if base.exists() else []
    return {
        "mode": "paper_only",
        "storage_dir": str(base),
        "session_count": len(sessions),
        "sessions": sessions,
        "live_execution": False,
    }


def load_ai_trading_session(session_id: str | None = None) -> dict[str, Any]:
    sid = _safe_session_id(session_id)
    path = _session_path(sid)
    if not path.exists():
        return {
            "session_id": sid,
            "exists": False,
            "session": None,
            "events": list_ai_trading_events(sid, 100),
            "orders": list_ai_trading_orders(sid, 100),
            "paper_only": True,
            "live_execution": False,
        }
    try:
        session = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        session = {"error": "Stored AI trading session JSON is invalid."}
    return {
        "session_id": sid,
        "exists": True,
        "session": session if isinstance(session, dict) else {},
        "events": list_ai_trading_events(sid, 100),
        "orders": list_ai_trading_orders(sid, 100),
        "paper_only": True,
        "live_execution": False,
    }


def save_ai_trading_session(session: dict[str, Any], session_id: str | None = None) -> dict[str, Any]:
    sid = _safe_session_id(session_id or str(session.get("session_id") or DEFAULT_SESSION_ID))
    path = _session_path(sid)
    path.parent.mkdir(parents=True, exist_ok=True)
    record = dict(session if isinstance(session, dict) else {})
    record.update(
        {
            "session_id": sid,
            "saved_at_utc": _now(),
            "paper_only": True,
            "live_execution": False,
        }
    )
    path.write_text(json.dumps(record, indent=2, sort_keys=True), encoding="utf-8")
    append_ai_trading_event(sid, "success", "AI trading session saved to backend storage.", {"source": "backend"})
    return {"session_id": sid, "session": record, "path": str(path), "paper_only": True, "live_execution": False}


def append_ai_trading_event(session_id: str | None, level: str, message: str, payload: dict[str, Any] | None = None) -> dict[str, Any]:
    sid = _safe_session_id(session_id)
    path = _events_path(sid)
    path.parent.mkdir(parents=True, exist_ok=True)
    record = {
        "id": f"evt_{uuid4().hex[:12]}",
        "session_id": sid,
        "created_at_utc": _now(),
        "level": level if level in {"info", "success", "warning", "error"} else "info",
        "message": str(message),
        "payload": payload if isinstance(payload, dict) else {},
        "paper_only": True,
        "live_execution": False,
    }
    with path.open("a", encoding="utf-8") as handle:
        handle.write(json.dumps(record, sort_keys=True) + "\n")
    return record


def _read_jsonl(path: Path, limit: int) -> list[dict[str, Any]]:
    if not path.exists():
        return []
    rows: list[dict[str, Any]] = []
    with path.open("r", encoding="utf-8") as handle:
        for line in handle:
            try:
                row = json.loads(line)
            except json.JSONDecodeError:
                continue
            if isinstance(row, dict):
                rows.append(row)
    return rows[-max(1, int(limit)) :]


def list_ai_trading_events(session_id: str | None = None, limit: int = 100) -> list[dict[str, Any]]:
    return _read_jsonl(_events_path(session_id), limit)


def append_ai_trading_order(session_id: str | None, order: dict[str, Any]) -> dict[str, Any]:
    sid = _safe_session_id(session_id)
    path = _orders_path(sid)
    path.parent.mkdir(parents=True, exist_ok=True)
    record = {
        "id": str(order.get("id") or f"ai_order_{uuid4().hex[:12]}"),
        "session_id": sid,
        "created_at_utc": _now(),
        "order": order if isinstance(order, dict) else {},
        "paper_only": True,
        "live_execution": False,
    }
    with path.open("a", encoding="utf-8") as handle:
        handle.write(json.dumps(record, sort_keys=True) + "\n")
    append_ai_trading_event(sid, "success", "AI paper order recorded in backend storage.", {"order_id": record["id"]})
    return record


def list_ai_trading_orders(session_id: str | None = None, limit: int = 100) -> list[dict[str, Any]]:
    return _read_jsonl(_orders_path(session_id), limit)
