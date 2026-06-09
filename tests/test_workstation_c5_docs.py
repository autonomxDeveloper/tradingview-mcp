from __future__ import annotations

from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
STATUS = ROOT / "docs" / "workstation-c5-event-inbox-status.md"
LOCAL_ROUTE = ROOT / "docs" / "workstation-c5-local-route-composition.md"
VALIDATION_HISTORY = ROOT / "docs" / "workstation-c5-validation-history.md"


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


def test_c5_status_note_tracks_static_client_test_checkpoints():
    text = STATUS.read_text(encoding="utf-8")

    assert "PR #43" in text
    assert "payload normalization" in text
    assert "PR #46" in text
    assert "endpoint string coverage" in text


def test_c5_status_note_tracks_static_client_export_guard():
    text = STATUS.read_text(encoding="utf-8")

    assert "PR #63" in text
    assert "Static client export guard" in text
    assert "private fetch wrapper" in text
    assert "public browser API" in text


def test_c5_status_note_tracks_roadmap_position():
    text = STATUS.read_text(encoding="utf-8")

    assert "Roadmap position" in text
    assert "foundation-complete" in text
    assert "active workstation integration" in text


def test_c5_status_note_tracks_validation_posture():
    text = STATUS.read_text(encoding="utf-8")

    assert "Current validation posture" in text
    assert "documentation and focused tests" in text


def test_c5_status_note_tracks_next_connector_safe_move():
    text = STATUS.read_text(encoding="utf-8")

    assert "Next connector-safe move" in text
    assert "small status, helper, or test refinements" in text
    assert "allowed minimal connector change" in text


def test_c5_local_route_composition_note_tracks_safe_path():
    text = LOCAL_ROUTE.read_text(encoding="utf-8")

    assert "create_event_enabled_app" in text
    assert "composed app factory" in text
    assert "TRADING_WORKSTATION_EVENT_INBOX" in text
    assert "research-only boundary" in text


def test_c5_local_route_composition_note_tracks_validation_checklist():
    text = LOCAL_ROUTE.read_text(encoding="utf-8")

    assert "Validation checklist" in text
    assert "storage remains local" in text
    assert "default workstation app is unchanged" in text


def test_c5_validation_history_tracks_pr40_checkpoint():
    text = VALIDATION_HISTORY.read_text(encoding="utf-8")

    assert "PR #40" in text
    assert "validation checklist" in text
    assert "test_workstation_c5_docs.py" in text


def test_c5_validation_history_tracks_status_checkpoint_update():
    text = VALIDATION_HISTORY.read_text(encoding="utf-8")

    assert "PR #52" in text
    assert "static client test checkpoints" in text
    assert "status note" in text


def test_c5_validation_history_tracks_roadmap_position_checkpoint():
    text = VALIDATION_HISTORY.read_text(encoding="utf-8")

    assert "PR #54" in text
    assert "roadmap-position summary" in text
    assert "status note" in text


def test_c5_validation_history_tracks_pr55_checkpoint():
    text = VALIDATION_HISTORY.read_text(encoding="utf-8")

    assert "PR #55" in text
    assert "PR #54 checkpoint" in text
    assert "history note" in text


def test_c5_validation_history_tracks_pr56_checkpoint():
    text = VALIDATION_HISTORY.read_text(encoding="utf-8")

    assert "PR #56" in text
    assert "PR #55 checkpoint" in text
    assert "history note" in text


def test_c5_validation_history_tracks_pr57_checkpoint():
    text = VALIDATION_HISTORY.read_text(encoding="utf-8")

    assert "PR #57" in text
    assert "PR #56 checkpoint" in text
    assert "history note" in text
