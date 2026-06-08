"""Persistent backtest record registry for the workstation.

This service stores backtest summaries and optional links to research ideas. It is
research-only and does not interact with brokers or exchanges.
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


def _record_path() -> Path:
    return Path(os.environ.get("TRADING_WORKSTATION_BACKTESTS", "data/backtest_records.jsonl"))


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


def summarize_backtest_result(result: dict[str, Any]) -> dict[str, Any]:
    """Extract a compact, stable summary from varying backtest result payloads."""
    if not isinstance(result, dict):
        return {"raw_type": type(result).__name__}

    summary_keys = [
        "symbol",
        "strategy",
        "period",
        "interval",
        "initial_capital",
        "final_value",
        "total_return_pct",
        "win_rate",
        "max_drawdown_pct",
        "sharpe_ratio",
        "trade_count",
        "error",
    ]
    summary = {key: result.get(key) for key in summary_keys if key in result}

    metrics = result.get("metrics")
    if isinstance(metrics, dict):
        for key in summary_keys:
            if key in metrics and key not in summary:
                summary[key] = metrics[key]

    if "equity_curve" in result:
        curve = result.get("equity_curve") or []
        summary["equity_curve_points"] = len(curve) if isinstance(curve, list) else None
    if "trades" in result:
        trades = result.get("trades") or []
        summary["trade_log_rows"] = len(trades) if isinstance(trades, list) else None
    if "trade_log" in result:
        trades = result.get("trade_log") or []
        summary["trade_log_rows"] = len(trades) if isinstance(trades, list) else summary.get("trade_log_rows")

    return summary


def create_backtest_record(
    *,
    request: dict[str, Any],
    result: dict[str, Any],
    idea_id: str | None = None,
    notes: str = "",
) -> dict[str, Any]:
    record = {
        "id": str(uuid4()),
        "timestamp_utc": _utc_now(),
        "idea_id": idea_id,
        "request": request,
        "summary": summarize_backtest_result(result),
        "result": result,
        "notes": notes,
    }
    event = {"event_type": "backtest_record_created", "timestamp_utc": _utc_now(), "record": record}
    _append_jsonl(_record_path(), event)
    return event


def list_backtest_records(
    *,
    symbol: str | None = None,
    strategy: str | None = None,
    idea_id: str | None = None,
    limit: int = 100,
) -> list[dict[str, Any]]:
    rows = _read_jsonl(_record_path(), limit=5000)
    records = [row.get("record", {}) for row in rows if row.get("event_type") == "backtest_record_created"]
    if symbol:
        clean_symbol = symbol.strip().upper()
        records = [record for record in records if str(record.get("request", {}).get("symbol", "")).upper() == clean_symbol]
    if strategy:
        clean_strategy = strategy.strip().lower()
        records = [record for record in records if str(record.get("request", {}).get("strategy", "")).lower() == clean_strategy]
    if idea_id:
        records = [record for record in records if record.get("idea_id") == idea_id]
    return records[-max(1, min(limit, 1000)) :]


def backtest_registry_status() -> dict[str, Any]:
    return {
        "mode": "research_only",
        "backtest_record_path": str(_record_path()),
        "supports_idea_links": True,
    }
