from __future__ import annotations

from tradingview_mcp.core.services import workstation_journal_service


def test_journal_round_trip(monkeypatch, tmp_path):
    monkeypatch.setenv("TRADING_WORKSTATION_JOURNAL", str(tmp_path / "journal.jsonl"))

    event = workstation_journal_service.append_journal_event("note", {"value": 1})
    events = workstation_journal_service.read_journal_events()

    assert event["event_type"] == "note"
    assert events[-1]["payload"] == {"value": 1}


def test_workstation_status_is_research_with_paper_simulation(monkeypatch, tmp_path):
    monkeypatch.setenv("TRADING_WORKSTATION_JOURNAL", str(tmp_path / "journal.jsonl"))

    status = workstation_journal_service.workstation_status()

    assert status["mode"] in {"research_with_paper_simulation_foundation", "research_and_paper_simulation"}
    assert status["execution_enabled"] is False
    assert status["paper_simulation_enabled"] is True
    assert "backtesting" in status["supported_workflows"]
    assert "paper_trading_simulation" in status["supported_workflows"]
