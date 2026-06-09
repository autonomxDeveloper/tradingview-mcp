# Workstation C5 Event Inbox Status

This note tracks the research-only local event inbox foundation.

## Completed slices

- PR #29: local JSONL-backed research event service.
- PR #29: create/list/status helpers.
- PR #29: focused unit tests for local event creation, symbol filtering, and status metadata.
- PR #31: reusable FastAPI route registration helper with route smoke tests.
- PR #33: documented connector-side direct app inclusion blockers and preserved the status note with doc tests.
- PR #34: added a separate composable app factory that registers the event routes on the workstation app without editing the main app file, plus smoke tests for status, create, and list flows.
- PR #36: added a standalone static event client helper for status, create, and list calls without wiring active UI.
- PR #37: recorded the standalone static event client helper in this status note and extended the doc guard.
- PR #43: added static browser event client contract tests for payload normalization and helper exports.
- PR #46: added endpoint string coverage for the browser event client helper.

## Roadmap position

C5 is foundation-complete for the connector-landed path: the local service, route helper, composable app factory, static client helper, and status documentation guards are in place. The remaining C5 milestone is active workstation integration, which stays pending until the default app hook can land safely.

## Current validation posture

The latest connector-landed work keeps validation on documentation and focused tests. That preserves the safe path while active workstation integration remains outside the allowed connector path.

## Next connector-safe move

Keep the next connector-landed slice focused on small status, helper, or test refinements. Avoid default app wiring until the app hook can be applied through a safe local patch or an allowed minimal connector change.

## Current scope

- The event inbox stores local research events for review.
- Events are marked `research_only`.
- Events include source, symbol, timeframe, kind, message, metadata, id, and timestamp.
- The storage path can be overridden with `TRADING_WORKSTATION_EVENT_INBOX`.
- The route helper exposes create, list, and status endpoints when registered on an app.
- `create_event_enabled_app()` composes the workstation app with the route helper for smoke coverage and local validation.
- `event_client.js` provides a browser-side helper contract for `/api/events/status`, `/api/events`, and event payload normalization.

## Connector-safe boundaries

- Keep connector-landed slices research-only and avoid active action pathways.
- Active workstation page changes for this area should stay very small, because prior direct page/app inclusion attempts were blocked by connector-side safety checks.
- Prefer standalone helpers, docs, and focused tests until the app hook can be applied locally or through an allowed minimal patch.

## Deferred follow-up

- Full workstation app inclusion remains pending because connector-side safety checks blocked both the large workstation app rewrite and the smaller direct hook attempt.
- UI controls and event inbox display remain pending.
- Webhook ingestion remains pending and must stay research-only.

## Next recommended slice

Add UI-side event inbox read/create controls against the reusable route contract once the workstation app hook can be landed, or perform the app hook locally outside the connector path and submit it separately. Until then, use the composable app factory and standalone static client helper as the safest connector-landed validation path for event route behavior.
