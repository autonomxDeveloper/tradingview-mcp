from __future__ import annotations

from tradingview_mcp.workstation_app import STATIC_DIR


EXPECTED_EVENT_API_EXPORT = (
    "return { createEvent, eventPayload, listEvents, normalizeSymbol, readEventStatus };"
)


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
    export_lines = [line.strip() for line in text.splitlines() if line.strip().startswith("return {")]

    assert "async function requestJson" in text
    assert "window.eventApi = eventApi" in text
    assert export_lines == [EXPECTED_EVENT_API_EXPORT]
    assert "requestJson" not in export_lines[0]


def test_event_client_endpoint_strings_are_stable():
    text = (STATIC_DIR / "event_client.js").read_text(encoding="utf-8")

    assert "'/api/events/status'" in text
    assert "'/api/events'" in text
    assert "`/api/events?${params.toString()}`" in text
    assert "params.set('limit', String(limit))" in text
