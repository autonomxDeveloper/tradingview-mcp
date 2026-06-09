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
- PR #63: tightened the static event client export guard so the private fetch wrapper stays out of the public browser API.
- PR #66: added static browser event client coverage for normalized optional symbol queries and stable limit parameters.
- PR #68: added static browser event client coverage for create-event POST requests, JSON headers, and normalized payload submission.
- PR #70: added static browser event client coverage for the read-only status helper and its `/api/events/status` endpoint.
- PR #72: added static browser event client coverage for request wrapper response handling before JSON parsing.
- PR #74: added static browser event client coverage for metadata fallback to an object during payload normalization.
- PR #76: added static browser event client coverage for message defaulting and trimming during payload normalization.
- PR #78: added static browser event client coverage for kind defaulting to `note` during payload normalization.
- PR #82: added static browser event client coverage for payload symbol normalization.
- PR #84: added static browser event client coverage for timeframe defaulting and trimming during payload normalization.
- PR #86: added static browser event client coverage for URLSearchParams list-query construction.
- PR #88: added static browser event client coverage for request wrapper default options.
- PR #90: added static browser event client coverage for symbol normalizer blank-string fallback.
- PR #92: added static browser event client coverage for IIFE wrapping and window-scoped API exposure.
- PR #94: added status-document guard coverage for recent static client checkpoints.
- PR #96: added status-document guard coverage for the PR #94 checkpoint.
- PR #98: added static browser event client coverage for a single public API export block.

## Roadmap position

C5 is foundation-complete for the connector-landed path: the local service, route helper, composable app factory, static client helper, and status documentation guards are in place. The remaining C5 milestone is active workstation integration, which stays pending until the default app hook can land safely.

## Current validation posture

The latest connector-landed work keeps validation on documentation and focused tests. That preserves the safe path while active workstation integration remains outside the allowed connector path.

## Static client export guard

The browser helper exposes only the reviewed event API shape: create, payload normalization, list, symbol normalization, and status helpers. The internal JSON request wrapper remains private to the helper module and is covered by static tests before any UI wiring is attempted.

## Static client list-query guard

The browser helper keeps event listing bounded and deterministic before UI wiring: the optional symbol filter is normalized before it is sent, omitted when blank, and paired with a stable stringified limit parameter.

## Static client create-event guard

The browser helper keeps event creation research-only and contract-shaped before UI wiring: create calls post only to `/api/events`, send JSON headers, and serialize the normalized `eventPayload(input)` body.

## Safe local app-hook handoff

Default app wiring is still pending. The local implementation path should keep the hook minimal, preserve the research-only boundary, and validate route behavior with `create_event_enabled_app()` plus the existing route and static-client tests before wiring UI controls.

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
