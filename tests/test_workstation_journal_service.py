from __future__ import annotations

from tradingview_mcp.core.services import workstation_journal_service


def test_journal_round_trip(monkeypatch, tmp_path):
    monkeypatch.setenv("TRADING_WORKSTATION_JOURNAL", str(tmp_path / "journal.jsonl"))

    event = workstation_journal_service.append_journal_event("note", {"value": 1})
    events = workstation_journal_service.read_journal_events()

    assert event["event_type"] == "note"
    assert events[-1]["payload"] == {"value": 1}


def test_workstation_status_is_research_only(monkeypatch, tmp_path):
    monkeypatch.setenv("TRADING_WORKSTATION_JOURNAL", str(tmp_path / "journal.jsonl"))

    status = workstation_journal_service.workstation_status()

    assert status["mode"] == "research_only"
    assert status["execution_enabled"] is False
    assert "backtesting" in status["supported_workflows"]
