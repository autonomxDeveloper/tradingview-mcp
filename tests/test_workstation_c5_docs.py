from __future__ import annotations

from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
STATUS = ROOT / "docs" / "workstation-c5-event-inbox-status.md"
LOCAL_ROUTE = ROOT / "docs" / "workstation-c5-local-route-composition.md"


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


def test_c5_status_note_tracks_composable_app_factory():
    text = STATUS.read_text(encoding="utf-8")

    assert "PR #34" in text
    assert "create_event_enabled_app()" in text
    assert "composable app factory" in text


def test_c5_status_note_tracks_static_event_client():
    text = STATUS.read_text(encoding="utf-8")

    assert "PR #36" in text
    assert "event_client.js" in text
    assert "browser-side helper contract" in text


def test_c5_status_note_tracks_connector_safe_boundaries():
    text = STATUS.read_text(encoding="utf-8")

    assert "PR #37" in text
    assert "Connector-safe boundaries" in text
    assert "standalone helpers, docs, and focused tests" in text


def test_c5_local_route_composition_note_tracks_safe_path():
    text = LOCAL_ROUTE.read_text(encoding="utf-8")

    assert "create_event_enabled_app" in text
    assert "composed app factory" in text
    assert "TRADING_WORKSTATION_EVENT_INBOX" in text
    assert "research-only boundary" in text
