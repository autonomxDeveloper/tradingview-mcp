# Optional LM Studio live API tests

The default workstation API test suite is deterministic and does not call LM Studio, Yahoo, Binance, Alpaca, or other external services. Use this live test suite when you want to verify the local workstation AI endpoints against a real LM Studio OpenAI-compatible server.

## Safety boundary

These tests are still research and paper-trading only:

- They do not submit live broker orders.
- They do not execute simulated paper orders.
- They monkeypatch market-data and paper-account adapters to deterministic in-process values.
- They call LM Studio only for AI text generation through the workstation's OpenAI-compatible `/chat/completions` call.
- They assert `paper_only=true`, `live_execution=false`, and `execution_submitted=false` on the AI paper decision endpoint.

## Prerequisites

1. Start LM Studio.
2. Load a local chat model.
3. Start the LM Studio local server, usually at:

   ```text
   http://localhost:1234/v1
   ```

4. From the repository root, install dependencies:

   ```powershell
   uv sync
   ```

## Run the live tests

PowerShell:

```powershell
$env:RUN_LMSTUDIO_API_TESTS="1"
$env:LMSTUDIO_BASE_URL="http://localhost:1234/v1"
$env:LMSTUDIO_MODEL="your-loaded-model-name"  # optional when LM Studio has a default loaded model
$env:LMSTUDIO_TIMEOUT_SECONDS="120"
uv run pytest tests/test_workstation_lmstudio_live_api.py -q
```

Bash:

```bash
RUN_LMSTUDIO_API_TESTS=1 \
LMSTUDIO_BASE_URL=http://localhost:1234/v1 \
LMSTUDIO_MODEL=your-loaded-model-name \
LMSTUDIO_TIMEOUT_SECONDS=120 \
uv run pytest tests/test_workstation_lmstudio_live_api.py -q
```

## Expected behavior

The tests are skipped unless `RUN_LMSTUDIO_API_TESTS=1` is set. When enabled, they verify:

- `/api/ai/analyze` returns non-empty LM Studio content.
- `/api/ai/trade-idea` returns non-empty LM Studio content and preserves the research-only journal boundary.
- `/api/ai/paper-trader/decision` returns non-empty LM Studio content while preserving paper-only safety flags.

The tests may fail if LM Studio is not running, no model is loaded, the configured model name is wrong, or the model returns an empty response.
