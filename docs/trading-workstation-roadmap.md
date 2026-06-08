# Trading Workstation Roadmap

This roadmap tracks the intended evolution of the local trading workstation. The current PR establishes the research-only foundation. Paper trading and real execution remain future work and should be implemented through a path that can support explicit operator review, auditability, and risk controls.

## Product goal

Build a local AI-assisted trading workstation for stocks and crypto where:

- LM Studio provides the local model runtime.
- The web app owns chart state, watchlists, workflows, prompts, audit records, and safety boundaries.
- Market data, backtests, technical analysis, and journal entries are available in one browser UI.
- Paper trading is available before any real broker or exchange action is considered.
- Real execution, if ever added, is opt-in, manually confirmed, size-limited, allowlisted, and auditable.

## Current baseline — PR #1 research workstation

Status: implemented in `trading-workstation-complete`.

Included:

- FastAPI browser workstation entrypoint: `uv run tradingview-workstation`
- TradingView Lightweight Charts UI
- Watchlist panel
- Yahoo chart fallback for stock candles
- Public crypto market-data service for Binance, Coinbase, and Kraken
- Read-only Alpaca account, positions, quote, and bars helpers
- Existing TradingView-style technical analysis integration
- Existing backtest and strategy comparison integration
- LM Studio OpenAI-compatible analysis endpoint
- Local research journal
- Basic chart/journal tests

Explicitly excluded from the current implementation:

- Broker order submission
- Exchange order submission
- Paper-order submission to a broker
- Local paper-trade simulation
- Real execution

## Phase 1 — Research workstation hardening

Goal: make the current research-only app reliable and easy to run.

Tasks:

- Run and fix `uv sync` and `uv run pytest` locally.
- Smoke-test `uv run tradingview-workstation`.
- Confirm stock chart loading for `AAPL`, `NVDA`, `SPY`, and `QQQ` without Alpaca credentials.
- Confirm crypto chart loading for `BTCUSDT`, `ETHUSDT`, and `SOLUSDT`.
- Confirm LM Studio analysis with the configured local model.
- Confirm backtest and strategy comparison endpoints.
- Confirm research journal write/read behavior.
- Move the large inline HTML/CSS/JS into static assets or templates.
- Add API tests for `/api/health`, `/api/watchlist`, `/api/ai/analyze`, `/api/backtest/run`, and `/api/journal`.

Acceptance criteria:

- The app runs from a clean clone with documented setup steps.
- No broker credentials are required for the basic charting workflow.
- Failed market-data or LM Studio calls display clear UI errors instead of breaking the page.

## Phase 2 — Market-data reliability

Goal: improve live-market support for stocks and crypto.

Tasks:

- Add a stock data fallback chain:
  - Yahoo chart
  - Alpaca bars when credentials are configured
  - cached last successful response
- Add a crypto data fallback chain:
  - Binance
  - Coinbase
  - Kraken
  - cached last successful response
- Normalize candle schemas across all providers.
- Add freshness metadata to every quote/candle payload.
- Add rate-limit and upstream-error handling in the UI.
- Add local cache files for recent market-data responses.
- Add watchlist-level refresh controls.

Acceptance criteria:

- The chart panel can switch providers without changing UI code.
- Every market payload includes source, timestamp/freshness, and normalized candles.
- Provider outages degrade gracefully.

## Phase 3 — Trade idea lab

Goal: turn AI output into structured, testable trading hypotheses.

Tasks:

- Add a structured trade idea schema:
  - symbol
  - asset type
  - direction bias
  - setup type
  - entry hypothesis
  - invalidation level
  - target/risk notes
  - timeframe
  - required confirmation
  - backtest idea
- Add an AI prompt that outputs only structured JSON plus human-readable rationale.
- Save trade ideas to the research journal.
- Add an idea list/detail panel.
- Add idea status states:
  - draft
  - watching
  - invalidated
  - backtested
  - paper-testing
  - archived
- Link ideas to backtest runs.

Acceptance criteria:

- An AI analysis can be saved as a structured idea.
- Ideas can be filtered by symbol/status/timeframe.
- Every idea has an invalidation condition before it can move to paper testing.

## Phase 4 — Backtest lab

Goal: make backtesting a first-class visual workflow.

Tasks:

- Add a backtest results panel with:
  - equity curve
  - drawdown
  - win rate
  - average win/loss
  - max drawdown
  - trade count
  - exposure
  - benchmark comparison
- Add per-trade table.
- Add parameter controls for each strategy.
- Add walk-forward result view.
- Add strategy comparison view.
- Save backtest runs to the journal.
- Link backtests to trade ideas.

Acceptance criteria:

- A user can turn an idea into at least one backtest run from the UI.
- Results are saved and can be revisited.
- Backtest output clearly states limitations, data source, timeframe, fees, and slippage assumptions.

## Phase 5 — Paper trading module

Status: planned; not implemented in the current PR.

Goal: add paper trading before any real execution path. This phase can be implemented outside the connector if needed.

Recommended implementation approach:

1. Start with a local paper ledger, not broker submission.
2. Add broker paper-order integration only after the local ledger and audit model are stable.
3. Keep paper trading separate from real execution in code, UI, environment variables, and logs.

### Phase 5A — Local paper ledger

Tasks:

- Add local paper account state:
  - starting cash
  - available cash
  - positions
  - average cost
  - realized P&L
  - unrealized P&L
  - trade history
- Add local simulated fills using the latest normalized quote/candle close.
- Add order intent model:
  - market intent
  - limit intent
  - stop intent
  - cancel intent
- Add paper-only UI panel:
  - preview
  - simulated submit
  - positions
  - fills
  - P&L
- Save every paper action to the journal/audit log.
- Add safeguards:
  - max paper position size
  - max paper order notional
  - symbol allowlist/denylist
  - confirmation checkbox
  - no real broker endpoint calls

Acceptance criteria:

- Paper trading works with no broker credentials.
- Paper fills are clearly labeled simulated.
- Every paper action has a journal/audit event.
- No code path can reach a real broker or exchange endpoint.

### Phase 5B — Broker paper account integration

Tasks:

- Add Alpaca paper account integration for stocks only.
- Keep API keys in environment variables only.
- Add account-read and positions-read panels.
- Add paper order preview.
- Add paper order submission behind a paper-only service.
- Refuse to run unless the service proves it is connected to a paper endpoint.
- Record broker response IDs in the audit log.
- Add integration tests with mocked Alpaca responses.

Acceptance criteria:

- The app can submit to a paper account only.
- The service refuses live endpoints.
- UI copy and API responses clearly say paper-only.
- Paper order calls are isolated from real execution code.

## Phase 6 — Alert ingestion

Goal: connect TradingView workflow through alerts rather than private account scraping.

Tasks:

- Add webhook receiver for TradingView alerts.
- Use a shared secret or signed header.
- Store alert events in the journal.
- Link alert events to symbols, charts, ideas, and paper testing.
- Add alert inbox panel.
- Add alert-to-idea conversion.

Acceptance criteria:

- TradingView alerts can be received and reviewed in the workstation.
- Alerts do not automatically place or simulate trades.
- Alerts can seed an idea or paper-trade review workflow.

## Phase 7 — Real execution safety design

Status: design only until paper trading is stable.

Goal: define real execution constraints before implementation.

Required gates:

- Disabled by default.
- Separate module from research and paper trading.
- Separate UI section from paper trading.
- Separate environment flag.
- Manual confirmation phrase per action.
- Max order notional.
- Symbol allowlist.
- Daily order limit.
- Daily loss lockout.
- Market-hours and asset-class checks.
- Audit log with immutable event entries.
- Dry-run preview step before submission.
- No unattended autonomous execution.

Acceptance criteria before implementation:

- Paper trading has been used and reviewed successfully.
- Risk limits are implemented and tested.
- Audit log is implemented and tested.
- Operator has reviewed the execution design.

## Phase 8 — Real execution implementation

Goal: implement real execution only after Phase 7 is accepted.

Tasks:

- Add execution provider interface.
- Add Alpaca stock execution adapter.
- Add optional crypto exchange execution adapter later.
- Add real-order preview endpoint.
- Add real-order submit endpoint guarded by every Phase 7 gate.
- Add full mock test suite.
- Add manual smoke-test checklist.
- Add emergency disable flag.

Acceptance criteria:

- Real execution cannot run without every configured gate passing.
- Every real execution request is auditable.
- Manual operator confirmation is required.
- Tests cover blocked cases more heavily than success cases.

## Phase 9 — Evaluation and journaling

Goal: make the workstation useful for iterative strategy improvement.

Tasks:

- Add daily/weekly review pages.
- Add paper performance metrics by idea, symbol, timeframe, and strategy.
- Add mistake/lesson tagging.
- Add export to CSV/JSON.
- Add AI summary of the trading journal.
- Add retrospective prompts:
  - what worked
  - what failed
  - which assumptions were wrong
  - what to backtest next

Acceptance criteria:

- User can review all ideas, backtests, paper actions, and journal notes in one place.
- AI summaries cite local journal events rather than inventing history.

## Near-term recommended order

1. Merge the research-only workstation once local tests pass.
2. Harden chart/data reliability.
3. Add structured trade ideas.
4. Add visual backtest lab.
5. Implement local paper ledger outside the connector if needed.
6. Add broker paper integration after local paper ledger is stable.
7. Only design real execution after paper trading has proven useful.
