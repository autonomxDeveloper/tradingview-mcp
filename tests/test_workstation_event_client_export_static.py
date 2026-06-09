from __future__ import annotations

from tradingview_mcp.workstation_app import STATIC_DIR


EXPECTED_EVENT_API_EXPORT = (
    "return { createEvent, eventPayload, listEvents, normalizeSymbol, readEventStatus };"
)


def test_event_client_public_api_export_block_appears_once():
    text = (STATIC_DIR / "event_client.js").read_text(encoding="utf-8")

    assert text.count(EXPECTED_EVENT_API_EXPORT) == 1
