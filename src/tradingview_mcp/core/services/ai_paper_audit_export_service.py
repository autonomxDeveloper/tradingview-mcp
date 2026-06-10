"""Read-only export formatting for AI paper review packets.

This module formats existing AI paper review packets into portable JSON or
Markdown payloads. It never calls an LLM, mutates the paper account, writes
files, submits simulated orders, or calls live broker endpoints.
"""
from __future__ import annotations

import json
import re
from datetime import datetime, timezone
from typing import Any


SUPPORTED_AUDIT_EXPORT_FORMATS = {"json", "markdown", "md"}


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _slug(value: Any, fallback: str = "ai-paper-audit") -> str:
    text = re.sub(r"[^A-Za-z0-9._-]+", "-", str(value or "").strip()).strip("-._")
    return text.lower()[:80] or fallback


def _format_number(value: Any) -> str:
    if isinstance(value, float):
        return f"{value:.6f}".rstrip("0").rstrip(".")
    return str(value if value is not None else "")


def _json_export(packet: dict[str, Any]) -> str:
    return json.dumps(packet, indent=2, sort_keys=True, default=str) + "\n"


def _markdown_list(values: list[Any]) -> str:
    if not values:
        return "none"
    return ", ".join(str(value) for value in values)


def _markdown_export(packet: dict[str, Any]) -> str:
    summary = packet.get("summary") or {}
    performance = packet.get("performance") or {}
    perf_summary = performance.get("summary") or {}
    groups = performance.get("groups") or {}
    lines = [
        "# AI Paper Audit Review Packet",
        "",
        f"Generated: {packet.get('generated_at_utc') or 'unknown'}",
        f"Packet type: {packet.get('packet_type') or 'ai_paper_review_packet'}",
        "",
        "## Safety boundary",
        "",
        f"- paper_only: {packet.get('paper_only', True)}",
        f"- live_execution: {packet.get('live_execution', False)}",
        f"- execution_submitted: {packet.get('execution_submitted', False)}",
        f"- background_loop_enabled: {packet.get('background_loop_enabled', False)}",
        f"- read_only: {packet.get('read_only', True)}",
        "- No LLM calls, paper account mutation, simulated order submission, or live broker calls are performed by this export.",
        "",
        "## Summary",
        "",
        f"- decisions: {_format_number(summary.get('decision_count', 0))}",
        f"- replay records: {_format_number(summary.get('replay_record_count', 0))}",
        f"- replayed: {_format_number(summary.get('replayed_count', perf_summary.get('replayed_count', 0)))}",
        f"- wins: {_format_number(summary.get('win_count', perf_summary.get('win_count', 0)))}",
        f"- losses: {_format_number(summary.get('loss_count', perf_summary.get('loss_count', 0)))}",
        f"- win rate: {_format_number(summary.get('win_rate', perf_summary.get('win_rate', 0.0)))}",
        f"- total realized PnL: {_format_number(summary.get('total_realized_pnl', perf_summary.get('total_realized_pnl', 0.0)))}",
        f"- symbols: {_markdown_list(summary.get('symbols') or [])}",
        "",
        "## Grouped performance preview",
        "",
    ]
    group_count = 0
    for group_name, rows in groups.items():
        lines.append(f"### {group_name}")
        lines.append("")
        if not rows:
            lines.append("No rows.")
            lines.append("")
            continue
        lines.append("| Key | Count | Win rate | Avg PnL | Avg PnL % | Avg MFE % | Avg MAE % |")
        lines.append("| --- | ---: | ---: | ---: | ---: | ---: | ---: |")
        for row in rows[:20]:
            group_count += 1
            lines.append(
                "| "
                + " | ".join(
                    [
                        str(row.get("key", "")),
                        _format_number(row.get("count", 0)),
                        _format_number(row.get("win_rate", 0.0)),
                        _format_number(row.get("average_realized_pnl", 0.0)),
                        _format_number(row.get("average_realized_pnl_pct", 0.0)),
                        _format_number(row.get("average_mfe_pct", 0.0)),
                        _format_number(row.get("average_mae_pct", 0.0)),
                    ]
                )
                + " |"
            )
        lines.append("")
    if group_count == 0:
        lines.append("No grouped performance rows available.")
        lines.append("")
    return "\n".join(lines).rstrip() + "\n"


def build_ai_paper_audit_export(
    packet: dict[str, Any],
    *,
    export_format: str = "json",
    name: str | None = None,
) -> dict[str, Any]:
    """Return a portable audit export payload for a review packet."""
    normalized_format = str(export_format or "json").strip().lower()
    if normalized_format not in SUPPORTED_AUDIT_EXPORT_FORMATS:
        normalized_format = "json"
    if normalized_format == "md":
        normalized_format = "markdown"
    safe_packet = dict(packet or {})
    safe_packet.setdefault("paper_only", True)
    safe_packet.setdefault("live_execution", False)
    safe_packet.setdefault("execution_submitted", False)
    safe_packet.setdefault("background_loop_enabled", False)
    safe_packet.setdefault("read_only", True)
    base_name = _slug(name or safe_packet.get("packet_type") or "ai-paper-audit")
    extension = "md" if normalized_format == "markdown" else "json"
    content_type = "text/markdown" if normalized_format == "markdown" else "application/json"
    content = _markdown_export(safe_packet) if normalized_format == "markdown" else _json_export(safe_packet)
    return {
        "generated_at_utc": _utc_now(),
        "export_type": "ai_paper_audit_export",
        "format": normalized_format,
        "filename": f"{base_name}.{extension}",
        "content_type": content_type,
        "content": content,
        "size_bytes": len(content.encode("utf-8")),
        "packet_summary": safe_packet.get("summary", {}),
        "paper_only": True,
        "live_execution": False,
        "execution_submitted": False,
        "background_loop_enabled": False,
        "read_only": True,
    }
