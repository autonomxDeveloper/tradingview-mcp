"""Server-side chart drawing storage for the local research workstation."""
from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any


def drawing_path() -> Path:
    return Path(os.environ.get("TRADING_WORKSTATION_DRAWINGS", "data/workstation_drawings.json"))


def drawing_key(symbol: str, timeframe: str) -> str:
    return f"{str(symbol or '').strip().upper()}::{str(timeframe or '').strip()}"


def _read_payload() -> dict[str, Any]:
    path = drawing_path()
    if not path.exists():
        return {"drawings": {}}
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {"drawings": {}}
    return payload if isinstance(payload, dict) else {"drawings": {}}


def load_drawings(symbol: str, timeframe: str) -> dict[str, Any]:
    payload = _read_payload()
    return dict(payload.get("drawings", {}).get(drawing_key(symbol, timeframe), {}))


def save_drawings(symbol: str, timeframe: str, drawings: dict[str, Any]) -> dict[str, Any]:
    path = drawing_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    payload = _read_payload()
    all_drawings = payload.setdefault("drawings", {})
    key = drawing_key(symbol, timeframe)
    all_drawings[key] = drawings if isinstance(drawings, dict) else {}
    path.write_text(json.dumps(payload, sort_keys=True, indent=2) + "\n", encoding="utf-8")
    return {"symbol": str(symbol).strip().upper(), "timeframe": str(timeframe).strip(), "drawings": all_drawings[key]}


def drawing_status() -> dict[str, Any]:
    payload = _read_payload()
    return {"mode": "research_only", "drawing_path": str(drawing_path()), "count": len(payload.get("drawings", {}))}
