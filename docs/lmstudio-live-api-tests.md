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

## Model auto-detection

`LMSTUDIO_MODEL` is optional. When it is not set, the live test suite first probes the default loaded LM Studio chat model by calling `/chat/completions` without a `model` field. If that default probe returns empty content, the suite calls `/models` and probes each returned model id until one produces non-empty chat content.

Set `LMSTUDIO_MODEL` only when you want to force a specific model id. Forced models are still probed before the workstation endpoints run, so an unloaded, non-chat, or empty-response model fails early with a targeted message.

## Run the live tests

PowerShell:

```powershell
$env:RUN_LMSTUDIO_API_TESTS="1"
$env:LMSTUDIO_BASE_URL="http://localhost:1234/v1"
$env:LMSTUDIO_TIMEOUT_SECONDS="120"
uv run pytest tests/test_workstation_lmstudio_live_api.py -q
```

Optional forced model:

```powershell
$env:LMSTUDIO_MODEL="your-loaded-model-name"
```

Bash:

```bash
RUN_LMSTUDIO_API_TESTS=1 \
LMSTUDIO_BASE_URL=http://localhost:1234/v1 \
LMSTUDIO_TIMEOUT_SECONDS=120 \
uv run pytest tests/test_workstation_lmstudio_live_api.py -q
```

Optional forced model:

```bash
export LMSTUDIO_MODEL=your-loaded-model-name
```

## Expected behavior

The tests are skipped unless `RUN_LMSTUDIO_API_TESTS=1` is set. When enabled, they verify:

- `/api/ai/analyze` returns non-empty LM Studio content and reports a detected model id.
- `/api/ai/trade-idea` returns non-empty LM Studio content, reports a detected model id, and preserves the research-only journal boundary.
- `/api/ai/paper-trader/decision` returns non-empty LM Studio content, reports a detected model id, and preserves paper-only safety flags.

The tests may fail if LM Studio is not running, no chat model is loaded, every probed model returns empty content, the configured model name is wrong, or the model cannot answer the readiness probe within `LMSTUDIO_TIMEOUT_SECONDS`.
