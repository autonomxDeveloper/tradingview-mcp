"""Local layout storage for the workstation."""
from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any


def layout_path() -> Path:
    return Path(os.environ.get("TRADING_WORKSTATION_LAYOUTS", "data/workstation_layouts.jsonl"))


def save_layout(name: str, state: dict[str, Any]) -> dict[str, Any]:
    path = layout_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    row = {"name": name.strip() or "default", "state": state}
    with path.open("a", encoding="utf-8") as handle:
        handle.write(json.dumps(row, sort_keys=True) + "\n")
    return row


def list_layouts() -> list[dict[str, Any]]:
    path = layout_path()
    if not path.exists():
        return []
    rows: list[dict[str, Any]] = []
    with path.open("r", encoding="utf-8") as handle:
        for line in handle:
            try:
                rows.append(json.loads(line))
            except json.JSONDecodeError:
                continue
    latest = {row.get("name", "default"): row for row in rows}
    return [latest[name] for name in sorted(latest)]


def layout_status() -> dict[str, Any]:
    return {"mode": "research_only", "layout_path": str(layout_path()), "count": len(list_layouts())}
