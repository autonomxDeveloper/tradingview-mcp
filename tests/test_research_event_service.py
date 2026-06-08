from __future__ import annotations

from tradingview_mcp.core.services.research_event_service import (
    create_research_event,
    list_research_events,
    research_event_status,
)


def test_research_event_service_creates_and_lists_local_events(monkeypatch, tmp_path):
    event_path = tmp_path / "events.jsonl"
    monkeypatch.setenv("TRADING_WORKSTATION_EVENT_INBOX", str(event_path))

    event = create_research_event(
        {
            "source": "manual",
            "symbol": "aapl",
            "timeframe": "1D",
            "kind": "note",
            "message": "watch prior high",
            "metadata": {"level": 123.45},
        }
    )

    assert event["research_only"] is True
    assert event["symbol"] == "AAPL"
    assert event["source"] == "manual"
    assert event["metadata"] == {"level": 123.45}
    assert event_path.exists()

    events = list_research_events(symbol="AAPL")
    assert [row["id"] for row in events] == [event["id"]]


def test_research_event_service_filters_and_reports_status(monkeypatch, tmp_path):
    event_path = tmp_path / "events.jsonl"
    monkeypatch.setenv("TRADING_WORKSTATION_EVENT_INBOX", str(event_path))

    create_research_event({"symbol": "AAPL", "message": "one"})
    create_research_event({"symbol": "MSFT", "message": "two"})

    assert len(list_research_events(symbol="AAPL")) == 1
    assert len(list_research_events()) == 2

    status = research_event_status()
    assert status["mode"] == "research_only"
    assert status["path"] == str(event_path)
    assert "manual" in status["supported_sources"]
