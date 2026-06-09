"""Dedicated research session snapshot storage for the local workstation."""
from __future__ import annotations

import json
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from uuid import uuid4


def snapshot_path() -> Path:
    return Path(os.environ.get("TRADING_WORKSTATION_SNAPSHOTS", "data/research_session_snapshots.jsonl"))


def save_snapshot(snapshot: dict[str, Any]) -> dict[str, Any]:
    path = snapshot_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    record = {
        "id": f"snap_{uuid4().hex[:12]}",
        "created_at_utc": datetime.now(timezone.utc).isoformat(),
        "snapshot": snapshot if isinstance(snapshot, dict) else {},
    }
    with path.open("a", encoding="utf-8") as handle:
        handle.write(json.dumps(record, sort_keys=True) + "\n")
    return record


def list_snapshots(limit: int = 100) -> list[dict[str, Any]]:
    path = snapshot_path()
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
    return rows[-max(1, int(limit)):]


def snapshot_status() -> dict[str, Any]:
    return {"mode": "research_only", "snapshot_path": str(snapshot_path()), "count": len(list_snapshots(10000))}
