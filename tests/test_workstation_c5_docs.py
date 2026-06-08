from __future__ import annotations

from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
STATUS = ROOT / "docs" / "workstation-c5-event-inbox-status.md"


def test_c5_status_note_tracks_event_inbox_scope():
    text = STATUS.read_text(encoding="utf-8")

    assert "PR #29" in text
    assert "PR #31" in text
    assert "research_only" in text
    assert "route helper exposes create, list, and status endpoints" in text


def test_c5_status_note_tracks_app_hook_blocker():
    text = STATUS.read_text(encoding="utf-8")

    assert "direct hook attempt" in text
    assert "outside the connector path" in text
