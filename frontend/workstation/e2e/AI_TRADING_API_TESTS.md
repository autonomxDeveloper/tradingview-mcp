# AI Trading API Tests

These tests hit the workstation backend directly. Run them before browser/UI tests because they are faster and isolate backend/session issues from rendering problems.

## Start the workstation server

```powershell
cd F:\LLM\tradingview-mcp
uv run tradingview-workstation --host 127.0.0.1 --port 8765
```

## Run deterministic API tests

```powershell
cd F:\LLM\tradingview-mcp\frontend\workstation
npm install
npm run test:e2e -- ai-trading-api.spec.ts
```

The deterministic tests verify:

- AI Trading status is paper-only.
- Live execution is disabled.
- Sessions save/load through the backend API.
- Events append/read correctly.
- AI paper order records append/read correctly.

## Run optional LLM-backed API test

Make sure LM Studio is running and the workstation AI endpoint is configured.

```powershell
cd F:\LLM\tradingview-mcp\frontend\workstation

$env:WORKSTATION_SERVER_URL="http://127.0.0.1:8765"
$env:AI_TRADING_API_LLM="1"
$env:AI_TRADING_SYMBOL="BTCUSDT"
$env:AI_TRADING_TIMEFRAME="1D"

npm run test:e2e -- ai-trading-api.spec.ts
```

Recommended local order:

```powershell
npm run build
npm run test:e2e -- ai-trading-api.spec.ts
```

Run the UI e2e tests only after these API tests pass.
