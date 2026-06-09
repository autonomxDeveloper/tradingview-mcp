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


def test_event_client_payload_metadata_falls_back_to_object():
    text = (STATIC_DIR / "event_client.js").read_text(encoding="utf-8")

    assert "metadata = {}" in text
    assert "metadata: metadata && typeof metadata === 'object' ? metadata : {}" in text


def test_event_client_payload_message_is_trimmed():
    text = (STATIC_DIR / "event_client.js").read_text(encoding="utf-8")

    assert "message = ''" in text
    assert "message: String(message || '').trim()" in text


def test_event_client_payload_kind_defaults_to_note_when_blank():
    text = (STATIC_DIR / "event_client.js").read_text(encoding="utf-8")

    assert "kind = 'note'" in text
    assert "kind: String(kind || 'note').trim() || 'note'" in text


def test_event_client_payload_source_defaults_to_manual():
    text = (STATIC_DIR / "event_client.js").read_text(encoding="utf-8")

    assert "source = 'manual'" in text
    assert "source," in text


def test_event_client_payload_symbol_uses_normalizer():
    text = (STATIC_DIR / "event_client.js").read_text(encoding="utf-8")

    assert "symbol = ''" in text
    assert "symbol: normalizeSymbol(symbol)" in text


def test_event_client_payload_timeframe_defaults_to_blank_and_is_trimmed():
    text = (STATIC_DIR / "event_client.js").read_text(encoding="utf-8")

    assert "timeframe = ''" in text
    assert "timeframe: String(timeframe || '').trim()" in text


def test_event_client_keeps_fetch_wrapper_private():
    text = (STATIC_DIR / "event_client.js").read_text(encoding="utf-8")
    export_lines = [
        line.strip()
        for line in text.splitlines()
        if line.strip().startswith("return { createEvent")
    ]

    assert "async function requestJson" in text
    assert "window.eventApi = eventApi" in text
    assert export_lines == [EXPECTED_EVENT_API_EXPORT]
    assert "requestJson" not in export_lines[0]


def test_event_client_request_wrapper_fails_closed_on_http_error():
    text = (STATIC_DIR / "event_client.js").read_text(encoding="utf-8")

    assert "const response = await fetch(url, options);" in text
    assert "if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);" in text
    assert "return response.json();" in text


def test_event_client_endpoint_strings_are_stable():
    text = (STATIC_DIR / "event_client.js").read_text(encoding="utf-8")

    assert "'/api/events/status'" in text
    assert "'/api/events'" in text
    assert "`/api/events?${params.toString()}`" in text
    assert "params.set('limit', String(limit))" in text


def test_event_client_list_events_symbol_query_is_normalized_and_optional():
    text = (STATIC_DIR / "event_client.js").read_text(encoding="utf-8")

    assert "async function listEvents({ symbol = '', limit = 100 } = {})" in text
    assert "if (normalizeSymbol(symbol)) params.set('symbol', normalizeSymbol(symbol));" in text
    assert "params.set('limit', String(limit))" in text
    assert "return requestJson(`/api/events?${params.toString()}`);" in text


def test_event_client_create_event_posts_normalized_payload():
    text = (STATIC_DIR / "event_client.js").read_text(encoding="utf-8")

    assert "async function createEvent(input = {})" in text
    assert "return requestJson('/api/events', {" in text
    assert "method: 'POST'" in text
    assert "headers: { 'Content-Type': 'application/json' }" in text
    assert "body: JSON.stringify(eventPayload(input))" in text


def test_event_client_status_reader_uses_status_endpoint_without_mutation():
    text = (STATIC_DIR / "event_client.js").read_text(encoding="utf-8")

    assert "async function readEventStatus()" in text
    assert "return requestJson('/api/events/status');" in text
    assert "readEventStatus" in EXPECTED_EVENT_API_EXPORT
