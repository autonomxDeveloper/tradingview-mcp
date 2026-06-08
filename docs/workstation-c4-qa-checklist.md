# Workstation C4 QA Checklist

Use this checklist for local browser verification of the C4 layout work.

## Setup

1. Start the workstation with `uv run tradingview-workstation`.
2. Open `http://127.0.0.1:8088`.
3. Load a primary symbol such as `AAPL` on `1D`.

## Layout modes

- Select `1 chart` and confirm only the primary chart is visible.
- Select `2 split` and confirm slot 2 is visible beside the primary chart.
- Select `4 grid` and confirm slots 2, 3, and 4 are visible.
- Resize the browser and confirm the chart area remains usable.

## Secondary slot assignment

- In slot 2, enter a symbol and timeframe, then set the slot.
- In slot 3, enter a symbol and timeframe, then set the slot.
- In slot 4, enter a symbol and timeframe, then set the slot.
- Confirm each assigned slot shows a status label.
- Confirm the toolbar slot summary updates after each assignment.

## Saved layout restore

- Save a named layout with layout mode, sync toggles, and secondary slot assignments.
- Reload the page.
- Load the saved layout.
- Confirm the layout mode, sync toggles, and secondary slot labels return.
- Confirm the toolbar slot summary reflects the restored slot state.

## Compact slot rendering

- Set slot 2 to a stock symbol and confirm the compact chart loads.
- Set slot 2 to a crypto symbol and confirm the compact chart loads.
- Set slots 3 and 4 and confirm each can create its runtime chart container.
- Confirm the primary chart remains unchanged while secondary slots update.

## Notes

- C4 remains research-only and local.
- Browser-level automation should be added later if a browser test harness is introduced.
