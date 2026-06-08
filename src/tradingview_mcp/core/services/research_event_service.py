"""Local research event inbox helpers for the workstation.

The inbox is research-only. Records are local notes/events for review and do not trigger
or simulate market activity.
"""
from __future__ import annotations

import json
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from uuid import uuid4


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _event_path() -> Path:
    return Path(os.environ.get("TRADING_WORKSTATION_EVENT_INBOX", "data/trading_research_events.jsonl"))


def create_research_event(payload: dict[str, Any]) -> dict[str, Any]:
    path = _event_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    event = {
        "id": str(uuid4()),
        "timestamp_utc": _utc_now(),
        "source": str(payload.get("source") or "manual"),
        "symbol": str(payload.get("symbol") or "").upper(),
        "timeframe": str(payload.get("timeframe") or ""),
        "kind": str(payload.get("kind") or "research_event"),
        "message": str(payload.get("message") or ""),
        "metadata": payload.get("metadata") if isinstance(payload.get("metadata"), dict) else {},
        "research_only": True,
    }
    with path.open("a", encoding="utf-8") as handle:
        handle.write(json.dumps(event, sort_keys=True) + "\n")
    return event


def list_research_events(symbol: str | None = None, limit: int = 100) -> list[dict[str, Any]]:
    path = _event_path()
    if not path.exists():
        return []
    normalized_symbol = symbol.upper() if symbol else None
    rows: list[dict[str, Any]] = []
    with path.open("r", encoding="utf-8") as handle:
        for line in handle:
            line = line.strip()
            if not line:
                continue
            try:
                event = json.loads(line)
            except json.JSONDecodeError:
                event = {"kind": "decode_error", "raw": line, "research_only": True}
            if normalized_symbol and event.get("symbol") != normalized_symbol:
                continue
            rows.append(event)
    return rows[-max(1, min(limit, 1000)) :]


def research_event_status() -> dict[str, Any]:
    return {
        "mode": "research_only",
        "path": str(_event_path()),
        "supported_sources": ["manual", "webhook", "scanner", "layout"],
    }
