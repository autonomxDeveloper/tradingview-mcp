# Workstation C5 Local Route Composition

This note captures the safest local path for validating the C5 event inbox route contract while direct edits to the main workstation app remain connector-sensitive.

## Current repo-side path

Use the composed app factory for local validation:

```python
from tradingview_mcp.workstation_event_app import create_event_enabled_app

app = create_event_enabled_app()
```

The composed app registers the reusable event route helper on top of the workstation app without editing `workstation_app.py`.

## Contract covered by tests

The composed app smoke tests cover:

- `GET /api/events/status`
- `POST /api/events`
- `GET /api/events`
- symbol normalization
- local JSONL storage override through `TRADING_WORKSTATION_EVENT_INBOX`

## Validation checklist

Before promoting more C5 event inbox work, verify that storage remains local, the composed app path still works, and the default workstation app is unchanged by composition-only validation.

## Deferred active app inclusion

Direct inclusion in the default workstation app is still deferred. Prior connector attempts to update the active app file were blocked, so route composition should stay local or be submitted as a very small patch outside the blocked connector path.

## Safe next steps

- Keep route/service behavior in pure helpers where possible.
- Keep UI work inert until the active route inclusion is available.
- Add browser-level tests only after a browser harness exists.
- Preserve the research-only boundary for every event path.
