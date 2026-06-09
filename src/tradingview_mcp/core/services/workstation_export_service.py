"""Local research packet export files for the workstation."""
from __future__ import annotations

import json
import os
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


def export_dir() -> Path:
    return Path(os.environ.get("TRADING_WORKSTATION_EXPORTS", "data/research_exports"))


def _safe_name(value: str) -> str:
    clean = re.sub(r"[^A-Za-z0-9_.-]+", "-", str(value or "packet")).strip("-._")
    return clean[:80] or "packet"


def save_export_packet(name: str, packet: dict[str, Any], markdown: str) -> dict[str, Any]:
    root = export_dir()
    root.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    base = f"{stamp}-{_safe_name(name)}"
    json_path = root / f"{base}.json"
    md_path = root / f"{base}.md"
    json_path.write_text(json.dumps(packet, sort_keys=True, indent=2) + "\n", encoding="utf-8")
    md_path.write_text(str(markdown or "") + "\n", encoding="utf-8")
    return {"name": base, "json_file": json_path.name, "markdown_file": md_path.name}


def list_export_files() -> list[dict[str, Any]]:
    root = export_dir()
    if not root.exists():
        return []
    return [{"file": path.name, "size_bytes": path.stat().st_size} for path in sorted(root.glob("*")) if path.is_file()]


def resolve_export_file(filename: str) -> Path:
    root = export_dir().resolve()
    candidate = (root / Path(filename).name).resolve()
    if not str(candidate).startswith(str(root)) or not candidate.exists() or not candidate.is_file():
        raise FileNotFoundError(filename)
    return candidate


def export_status() -> dict[str, Any]:
    return {"mode": "research_only", "export_dir": str(export_dir()), "count": len(list_export_files())}
