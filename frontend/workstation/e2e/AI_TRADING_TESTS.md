# AI Trading E2E Tests

These tests exercise the workstation AI Trading surfaces through Playwright. They are intended for local runs against the React workstation UI.

## What is covered

- AI Trading bottom-tab controls and paper-only guardrails.
- Emergency stop behavior.
- Shared Paper Trading account visibility from AI Trading.
- External execution guard remains locked and paper-only.
- Backend AI Trading session storage status/save/load behavior.
- Optional real LLM-driven AI Trading cycle.

## Deterministic UI and backend-storage tests

From `frontend/workstation`:

```powershell
npm install
npm run test:e2e -- ai-trading.spec.ts
```

The Playwright config starts the Vite dev server on `127.0.0.1:5173` and reuses it if it is already running.

The backend-storage API test expects the Python workstation server to be running separately on `127.0.0.1:8765` because the storage endpoints live on the workstation backend:

```powershell
cd F:\LLM\tradingview-mcp
uv run tradingview-workstation --host 127.0.0.1 --port 8765
```

If you run the backend on a different URL, set:

```powershell
$env:WORKSTATION_SERVER_URL="http://127.0.0.1:8765"
npm run test:e2e -- ai-trading.spec.ts
```

## Optional LLM-driven AI cycle

The real LLM cycle is skipped by default. To enable it, start the workstation backend and your LM Studio/OpenAI-compatible provider, then run:

```powershell
$env:AI_TRADING_LLM="1"
$env:AI_TRADING_SYMBOL="BTCUSDT"
$env:AI_TRADING_TIMEFRAME="1D"
$env:WORKSTATION_SERVER_URL="http://127.0.0.1:8765"
npm run test:e2e -- ai-trading.spec.ts --headed
```

The LLM test runs one AI Trading cycle in `suggest` mode, waits for a decision card, and checks that the decision is one of `BUY`, `SELL`, or `HOLD`. It does not enable live execution.

## Useful focused runs

```powershell
npm run test:e2e -- ai-trading.spec.ts -g "renders paper-only"
npm run test:e2e -- ai-trading.spec.ts -g "emergency stop"
npm run test:e2e -- ai-trading.spec.ts -g "backend API is paper-only"
$env:AI_TRADING_LLM="1"; npm run test:e2e -- ai-trading.spec.ts -g "real AI trading analysis cycle" --headed
```
