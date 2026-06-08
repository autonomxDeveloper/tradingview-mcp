# Workstation C4 Layout Status

This note records the current state of the local chart layout work after the C4 layout-management slices.

## Completed slices

- PR #13: saved chart layouts.
- PR #14: saved layout catalog.
- PR #15: 1 chart, 2 split, and 4 grid layout modes.
- PR #16: explicit symbol and timeframe sync toggles.
- PR #17: chart slot state controls for slots 2 through 4.

## Current capabilities

- Named layouts can be saved, loaded, listed, deleted, and reset in local browser storage.
- Layout state includes symbol, asset type, exchange, timeframe, overlay toggles, pane visibility, layout mode, sync toggles, and placeholder slot assignments.
- The main chart remains the active chart.
- Slots 2 through 4 currently store symbol and timeframe labels only. They are ready for a later slice that adds independent chart rendering per slot.
- Static asset tests cover the visible controls and shim functions.

## Remaining C4 work

- Add independent chart rendering for slot 2 first.
- Extend slot rendering to slots 3 and 4 after slot 2 is stable.
- Decide whether crosshair sync belongs in C4 or should wait until all slots render their own data.

## Next recommended slice

Start with slot 2 rendering using the existing chart API paths and keep it read-only/local. The first version should not alter the primary chart behavior. It should render a compact slot chart and use the stored slot 2 symbol/timeframe state.
