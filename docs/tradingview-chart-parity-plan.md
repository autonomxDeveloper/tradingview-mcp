# TradingView-Style Chart Workstation Parity Plan

This plan tracks the staged buildout of a TradingView-style local research workstation on top of TradingView Lightweight Charts and the existing FastAPI workstation.

## Principles

- Research-first: no broker actions, paper trading, or real execution in these charting slices.
- One branch and PR per slice.
- Merge only after exact-head GitHub Actions pass.
- Prefer durable, testable increments over a large UI rewrite.
- Use Lightweight Charts as the renderer and implement workstation tools ourselves.
- Avoid cloning proprietary TradingView Advanced Charts internals; build equivalent workflows with our own UI and local state.

## Already implemented

- Local FastAPI workstation.
- Static HTML/CSS/JS assets.
- Watchlist.
- Yahoo stock chart fallback.
- Binance/Coinbase/Kraken crypto market data.
- Market-data cache and freshness metadata.
- LM Studio analysis panel.
- Research journal.
- Structured research ideas.
- Persistent backtest records.
- SMA 20, SMA 50, EMA 21 overlays.
- OHLC legend.
- Chart source/cache metadata display.
- Volume visibility toggle.
- Auto-fit control.
- CI workflow and route/static smoke tests.

## Phase C1 — Drawing tools foundation

Goal: add first chart drawing controls with local persistence.

Features:

- Horizontal price level drawing.
- Level label/note.
- Level color/type preset.
- Clear all levels.
- Persist drawings in browser localStorage by symbol/timeframe.
- Restore drawings when loading a symbol/timeframe.
- Static tests for controls and JS functions.

Acceptance criteria:

- User can add a horizontal level at a chosen price.
- User can add a level from the latest close.
- Levels persist locally per symbol/timeframe.
- User can clear levels.
- No server-side execution or broker interaction.

## Phase C2 — Drawing tools expansion

Goal: broaden drawing support beyond price levels.

Features:

- Trendline tool using chart coordinate overlay.
- Ray/extended line.
- Rectangle zone.
- Text note.
- Hide/show drawings.
- Lock drawings.
- Export/import drawings as JSON.

Acceptance criteria:

- Drawings survive page refresh.
- Drawings are scoped by symbol/timeframe.
- Drawings can be exported and imported.

## Phase C3 — Indicator panes

Goal: add lower panes and oscillator indicators.

Features:

- RSI pane.
- MACD pane.
- ATR pane.
- Volume pane controls.
- Indicator settings panel.
- Indicator persistence by layout.

Acceptance criteria:

- User can enable/disable each pane independently.
- Pane values update with chart data.
- Indicator settings persist locally.

## Phase C4 — Layouts and multi-chart grid

Goal: add TradingView-like layout management.

Features:

- Save layout.
- Load layout.
- Reset layout.
- 1-chart view.
- 2-chart split.
- 4-chart grid.
- Symbol/timeframe sync toggles.
- Crosshair sync later.

Acceptance criteria:

- Layouts are locally persistent.
- Multi-chart view does not break existing API workflows.
- Sync toggles are explicit.

## Phase C5 — Alerts and alert inbox

Goal: support local alert rules and incoming TradingView webhooks as research events.

Features:

- Local price alert rule.
- Indicator alert rule.
- Alert inbox.
- TradingView webhook receiver.
- Shared secret for webhook validation.
- Alert-to-idea conversion.
- Alert journal entries.

Acceptance criteria:

- Alerts do not place or simulate trades.
- Webhook events are stored as research events only.
- User can convert an alert into a research idea.

## Phase C6 — Replay mode

Goal: add bar replay for historical review.

Features:

- Select replay start candle.
- Step forward.
- Step backward.
- Play/pause.
- Speed control.
- Replay-aware indicators.
- Replay notes in journal.

Acceptance criteria:

- Replay never fetches new data mid-session unless the user reloads.
- Replay state is visible and easy to exit.

## Phase C7 — Backtest visualization

Goal: make backtests visible on the chart.

Features:

- Entry/exit markers.
- Trade log table.
- Equity curve view.
- Drawdown view.
- Metrics cards.
- Link backtest records to research ideas and chart markers.

Acceptance criteria:

- Saved backtests can be reviewed visually.
- Backtest assumptions are displayed clearly.

## Phase C8 — Screeners and watchlist intelligence

Goal: add broader market scanning.

Features:

- Watchlist columns: last, change, volume, source/freshness.
- Technical scan results.
- Crypto scanner.
- Stock scanner.
- Saved scanner presets.

Acceptance criteria:

- Watchlist refreshes without blocking chart analysis.
- Scanner outputs can seed research ideas.

## Phase C9 — Paper trading outside connector path

Goal: paper trading remains planned but separate from connector-written implementation if needed.

Features:

- Local paper ledger.
- Simulated fills.
- Paper positions and P&L.
- Paper chart markers.
- Broker paper integration after local ledger is stable.

Acceptance criteria:

- No real broker/exchange endpoints are reachable.
- Every paper action is auditable.

## Phase C10 — Real execution design only

Goal: define safeguards before implementation.

Required gates:

- Disabled by default.
- Separate module and UI.
- Manual confirmation per action.
- Max notional.
- Symbol allowlist.
- Daily order limit.
- Daily loss lockout.
- Audit log.
- No autonomous execution.

Acceptance criteria:

- Real execution is not implemented until paper trading is stable and reviewed.
