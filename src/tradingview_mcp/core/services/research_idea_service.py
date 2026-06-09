"""Structured research idea registry for the local workstation.

The registry stores analysis hypotheses and follow-up backtest plans. It is
research-only and has no broker or exchange action path.
"""
from __future__ import annotations

import json
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from uuid import uuid4


VALID_IDEA_STATUSES = {"draft", "watching", "invalidated", "backtested", "archived"}
VALID_ASSET_TYPES = {"stock", "crypto", "other"}
VALID_BIASES = {"bullish", "bearish", "neutral", "range", "unknown"}


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _idea_path() -> Path:
    return Path(os.environ.get("TRADING_WORKSTATION_IDEAS", "data/research_ideas.jsonl"))


def _append_jsonl(path: Path, payload: dict[str, Any]) -> dict[str, Any]:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a", encoding="utf-8") as handle:
        handle.write(json.dumps(payload, sort_keys=True) + "\n")
    return payload


def _read_jsonl(path: Path, limit: int = 5000) -> list[dict[str, Any]]:
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
    return rows[-max(1, min(limit, 5000)) :]


def normalize_research_idea(payload: dict[str, Any]) -> dict[str, Any]:
    symbol = str(payload.get("symbol", "")).strip().upper()
    asset_type = str(payload.get("asset_type", "other")).strip().lower()
    status = str(payload.get("status", "draft")).strip().lower()
    bias = str(payload.get("bias", "unknown")).strip().lower()

    if asset_type not in VALID_ASSET_TYPES:
        asset_type = "other"
    if status not in VALID_IDEA_STATUSES:
        status = "draft"
    if bias not in VALID_BIASES:
        bias = "unknown"

    return {
        "id": str(payload.get("id") or uuid4()),
        "created_at_utc": str(payload.get("created_at_utc") or _utc_now()),
        "updated_at_utc": _utc_now(),
        "symbol": symbol,
        "asset_type": asset_type,
        "timeframe": str(payload.get("timeframe", "")).strip(),
        "status": status,
        "bias": bias,
        "setup_type": str(payload.get("setup_type", "")).strip(),
        "hypothesis": str(payload.get("hypothesis", "")).strip(),
        "invalidation": str(payload.get("invalidation", "")).strip(),
        "risk_notes": str(payload.get("risk_notes", "")).strip(),
        "backtest_plan": str(payload.get("backtest_plan", "")).strip(),
        "source": str(payload.get("source", "manual")).strip() or "manual",
        "links": payload.get("links", []),
        "metadata": payload.get("metadata", {}),
    }


def validate_research_idea(idea: dict[str, Any]) -> list[str]:
    errors: list[str] = []
    if not idea.get("symbol"):
        errors.append("symbol is required")
    if not idea.get("timeframe"):
        errors.append("timeframe is required")
    if not idea.get("hypothesis"):
        errors.append("hypothesis is required")
    if not idea.get("invalidation"):
        errors.append("invalidation is required")
    if not idea.get("backtest_plan"):
        errors.append("backtest_plan is required")
    return errors


def create_research_idea(payload: dict[str, Any]) -> dict[str, Any]:
    idea = normalize_research_idea(payload)
    errors = validate_research_idea(idea)
    event = {
        "event_type": "research_idea_created",
        "timestamp_utc": _utc_now(),
        "idea": idea,
        "errors": errors,
        "accepted": not errors,
    }
    _append_jsonl(_idea_path(), event)
    return event


def _latest_ideas() -> dict[str, dict[str, Any]]:
    latest: dict[str, dict[str, Any]] = {}
    for row in _read_jsonl(_idea_path(), limit=5000):
        if row.get("event_type") == "research_idea_created" and isinstance(row.get("idea"), dict):
            idea = row["idea"]
            latest[str(idea.get("id"))] = idea
        if row.get("event_type") == "research_idea_status_updated" and isinstance(row.get("idea"), dict):
            idea = row["idea"]
            latest[str(idea.get("id"))] = idea
    return latest


def update_research_idea_status(idea_id: str, status: str, note: str = "") -> dict[str, Any]:
    clean_status = str(status or "").strip().lower()
    latest = _latest_ideas()
    idea = latest.get(str(idea_id))
    errors: list[str] = []
    if not idea:
        errors.append("idea_id not found")
    if clean_status not in VALID_IDEA_STATUSES:
        errors.append("invalid status")
    updated = dict(idea or {})
    previous_status = updated.get("status")
    if not errors:
        updated["status"] = clean_status
        updated["updated_at_utc"] = _utc_now()
    event = {
        "event_type": "research_idea_status_updated",
        "timestamp_utc": _utc_now(),
        "idea_id": str(idea_id),
        "previous_status": previous_status,
        "status": clean_status,
        "note": str(note or ""),
        "idea": updated,
        "errors": errors,
        "accepted": not errors,
    }
    _append_jsonl(_idea_path(), event)
    return event


def list_research_ideas(
    *,
    symbol: str | None = None,
    status: str | None = None,
    asset_type: str | None = None,
    limit: int = 100,
) -> list[dict[str, Any]]:
    ideas = list(_latest_ideas().values())
    if symbol:
        clean_symbol = symbol.strip().upper()
        ideas = [idea for idea in ideas if idea.get("symbol") == clean_symbol]
    if status:
        clean_status = status.strip().lower()
        ideas = [idea for idea in ideas if idea.get("status") == clean_status]
    if asset_type:
        clean_type = asset_type.strip().lower()
        ideas = [idea for idea in ideas if idea.get("asset_type") == clean_type]
    return ideas[-max(1, min(limit, 1000)) :]


def idea_registry_status() -> dict[str, Any]:
    return {
        "mode": "research_only",
        "idea_path": str(_idea_path()),
        "valid_statuses": sorted(VALID_IDEA_STATUSES),
        "valid_asset_types": sorted(VALID_ASSET_TYPES),
        "valid_biases": sorted(VALID_BIASES),
    }
