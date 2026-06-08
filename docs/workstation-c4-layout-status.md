# Workstation C4 Layout Status

This note records the current state of the local chart layout work after the C4 layout-management slices.

## Completed slices

- PR #13: saved chart layouts.
- PR #14: saved layout catalog.
- PR #15: 1 chart, 2 split, and 4 grid layout modes.
- PR #16: explicit symbol and timeframe sync toggles.
- PR #17: chart slot state controls for slots 2 through 4.
- PR #19: compact slot 2 chart rendering.

## Current capabilities

- Named layouts can be saved, loaded, listed, deleted, and reset in local browser storage.
- Layout state includes symbol, asset type, exchange, timeframe, overlay toggles, pane visibility, layout mode, sync toggles, and slot assignments.
- The main chart remains the primary chart.
- Slot 2 can render a compact chart using the stored slot 2 symbol and timeframe.
- Slots 3 and 4 currently store symbol and timeframe labels only.
- Static asset tests cover the visible controls, helper files, and shim functions.

## Remaining C4 work

- Extend compact chart rendering to slots 3 and 4 after slot 2 is stable.
- Add a shared helper for repeated slot rendering to avoid duplicating slot-specific scripts.
- Decide whether crosshair sync belongs in C4 or should wait until all slots render their own data.

## Next recommended slice

Generalize slot chart rendering so slots 3 and 4 can use the same compact chart path as slot 2. Keep the slice read-only/local and preserve the primary chart behavior.
