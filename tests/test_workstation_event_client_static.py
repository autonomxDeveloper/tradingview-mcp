from __future__ import annotations

from tradingview_mcp.workstation_app import STATIC_DIR


def test_event_client_payload_contract_is_static_and_normalized():
    text = (STATIC_DIR / "event_client.js").read_text(encoding="utf-8")

    assert "function normalizeSymbol" in text
    assert ".trim().toUpperCase()" in text
    assert "function eventPayload" in text
    assert "timeframe: String(timeframe || '').trim()" in text
    assert "kind: String(kind || 'note').trim() || 'note'" in text
    assert "metadata && typeof metadata === 'object'" in text


def test_event_client_keeps_fetch_wrapper_private():
    text = (STATIC_DIR / "event_client.js").read_text(encoding="utf-8")

    assert "async function requestJson" in text
    assert "window.eventApi = eventApi" in text
    assert "return { createEvent, eventPayload, listEvents, normalizeSymbol, readEventStatus };" in text
    assert "requestJson" not in "{ createEvent, eventPayload, listEvents, normalizeSymbol, readEventStatus }"
