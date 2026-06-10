"""Local workstation audit and research journal helpers."""
from __future__ import annotations

import json
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from uuid import uuid4


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _journal_path() -> Path:
    return Path(os.environ.get("TRADING_WORKSTATION_JOURNAL", "data/trading_research_journal.jsonl"))


def append_journal_event(event_type: str, payload: dict[str, Any]) -> dict[str, Any]:
    path = _journal_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    event = {
        "id": str(uuid4()),
        "timestamp_utc": _utc_now(),
        "event_type": event_type,
        "payload": payload,
    }
    with path.open("a", encoding="utf-8") as handle:
        handle.write(json.dumps(event, sort_keys=True) + "\n")
    return event


def read_journal_events(limit: int = 100) -> list[dict[str, Any]]:
    path = _journal_path()
    if not path.exists():
        return []
    rows: list[dict[str, Any]] = []
    with path.open("r", encoding="utf-8") as handle:
        for line in handle:
            line = line.strip()
            if not line:
                continue
            try:
                rows.append(json.loads(line))
            except json.JSONDecodeError:
                rows.append({"event_type": "decode_error", "raw": line})
    return rows[-max(1, min(limit, 1000)) :]


def workstation_status() -> dict[str, Any]:
    return {
        "mode": "research_with_paper_simulation_foundation",
        "journal_path": str(_journal_path()),
        "execution_enabled": False,
        "paper_simulation_enabled": True,
        "supported_workflows": [
            "watchlist",
            "charting",
            "market_data",
            "technical_analysis",
            "lmstudio_analysis",
            "backtesting",
            "research_journal",
            "paper_trading_simulation",
        ],
        "safety_note": "Paper trading is local simulation only; no live broker orders are submitted.",
    }
