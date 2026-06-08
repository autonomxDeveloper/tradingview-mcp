# Workstation C4 Layout Status

This note records the current state of the local chart layout work after the C4 layout-management slices.

## Completed slices

- PR #13: saved chart layouts.
- PR #14: saved layout catalog.
- PR #15: 1 chart, 2 split, and 4 grid layout modes.
- PR #16: explicit symbol and timeframe sync toggles.
- PR #17: chart slot state controls for slots 2 through 4.
- PR #19: compact slot 2 chart rendering.
- PR #21: shared compact slot chart helper foundation.
- PR #23: runtime chart shells for slots 3 and 4.
- PR #25: visible secondary slot summary.
- PR #27: C4 manual QA checklist with doc tests.

## Current capabilities

- Named layouts can be saved, loaded, listed, deleted, and reset in local browser storage.
- Layout state includes symbol, asset type, exchange, timeframe, overlay toggles, pane visibility, layout mode, sync toggles, and slot assignments.
- The main chart remains the primary chart.
- Slot 2 can render a compact chart using the stored slot 2 symbol and timeframe.
- The compact slot helper supports slots 2 through 4 internally.
- Slots 3 and 4 get status labels and compact chart containers at runtime.
- The layout toolbar now shows a secondary slot summary for slots 2 through 4.
- Static asset tests cover the visible controls, helper files, runtime shell injection, summary helpers, and shim functions.
- The C4 checklist documents manual browser verification for layout modes, secondary slot assignment, saved layout restore, and compact slot rendering.

## Remaining C4 work

- Validate all secondary slots with browser-level interaction tests when a browser test harness is available.
- Decide whether crosshair sync belongs in C4 or should wait until all slots render their own data.

## Next recommended slice

Start C5 with a research-only local event inbox foundation, avoiding any trade placement or simulation behavior.
