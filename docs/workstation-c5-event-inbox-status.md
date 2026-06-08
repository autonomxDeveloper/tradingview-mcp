# Workstation C5 Event Inbox Status

This note tracks the research-only local event inbox foundation.

## Completed slices

- PR #29: local JSONL-backed research event service.
- PR #29: create/list/status helpers.
- PR #29: focused unit tests for local event creation, symbol filtering, and status metadata.

## Current scope

- The event inbox stores local research events for review.
- Events are marked `research_only`.
- Events include source, symbol, timeframe, kind, message, metadata, id, and timestamp.
- The storage path can be overridden with `TRADING_WORKSTATION_EVENT_INBOX`.

## Deferred follow-up

- FastAPI route wiring remains pending because the connector blocked the large workstation app rewrite in the foundation slice.
- UI controls and event inbox display remain pending.
- Webhook ingestion remains pending and must stay research-only.

## Next recommended slice

Add a narrow API router or smaller workstation app patch for create/list event endpoints, with route smoke tests.
