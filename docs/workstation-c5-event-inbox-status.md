# Workstation C5 Event Inbox Status

This note tracks the research-only local event inbox foundation.

## Completed slices

- PR #29: local JSONL-backed research event service.
- PR #29: create/list/status helpers.
- PR #29: focused unit tests for local event creation, symbol filtering, and status metadata.
- PR #31: reusable FastAPI route registration helper with route smoke tests.

## Current scope

- The event inbox stores local research events for review.
- Events are marked `research_only`.
- Events include source, symbol, timeframe, kind, message, metadata, id, and timestamp.
- The storage path can be overridden with `TRADING_WORKSTATION_EVENT_INBOX`.
- The route helper exposes create, list, and status endpoints when registered on an app.

## Deferred follow-up

- Full workstation app inclusion remains pending because the connector blocked the large workstation app rewrite in the foundation slice.
- UI controls and event inbox display remain pending.
- Webhook ingestion remains pending and must stay research-only.

## Next recommended slice

Attempt a very small workstation app integration patch that imports and registers the route helper without rewriting the full app file.
