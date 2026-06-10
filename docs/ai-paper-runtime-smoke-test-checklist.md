# AI paper runtime smoke test checklist

This checklist is for a local browser smoke pass of the TradingView workstation AI paper-trading workflow. It is intentionally manual and research-only: the AI paper tools may create research, replay, review, and export artifacts, but they must not submit live broker orders or start autonomous execution.

## Safety boundary

Before running the checklist, keep these invariants visible in every AI paper decision, replay, performance, review, export, and reporting flow:

- `paper_only=true`
- `live_execution=false`
- `execution_submitted=false`
- `background_loop_enabled=false` where a schedule or loop state is shown
- `read_only=true` for history, performance, review packet, audit export, and reporting endpoints

Do not enable live broker execution. Do not introduce background autonomous order submission. The only execution handoff in this workflow is the explicit simulated paper execution acknowledgment in the browser.

## Local setup

1. Install the project dependencies from the repository root.

   ```bash
   uv sync
   ```

2. Optional: start LM Studio locally and load a local chat model.

   The workstation defaults to the OpenAI-compatible LM Studio endpoint at `http://localhost:1234/v1`. Override it only when needed:

   ```bash
   export LMSTUDIO_BASE_URL=http://localhost:1234/v1
   export LMSTUDIO_MODEL=local-model-name
   ```

3. Start the browser workstation.

   ```bash
   uv run tradingview-workstation --host 127.0.0.1 --port 8765
   ```

4. Open the workstation in a browser.

   ```text
   http://127.0.0.1:8765/
   ```

5. Confirm `/api/health` responds and shows paper trading/workstation status.

   ```bash
   curl http://127.0.0.1:8765/api/health
   ```

## Browser smoke pass

Use liquid, familiar symbols for this pass, for example `AAPL`, `NVDA`, `SPY`, `BTCUSDT`, or `ETHUSDT`. Market data availability may vary, so record provider errors separately from UI boot failures.

### 1. Workstation boot and dashboard

- The page loads without a browser console boot error.
- The AI paper dashboard/status strip appears near the simulated paper trading area.
- Dashboard cards are visible for decision, schedules, lifecycle, replay, history, performance, review packet, and audit export.
- The dashboard refresh action updates status text only.
- Clicking dashboard cards scrolls/focuses the matching panel only; it does not call `/api/`, mutate paper state, or submit orders.

Expected safety text includes: `paper_only: true`, `live_execution: false`, `execution_submitted: false`, and `read_only: true`.

### 2. AI paper decision

- Enter a symbol, asset type, exchange, timeframe, question, and risk profile.
- Click **Get AI paper decision**.
- Confirm the request uses `POST /api/ai/paper-trader/decision`.
- Confirm the decision panel renders the model response or a clear LM Studio/provider error.
- Confirm the response preserves `paper_only=true` and `live_execution=false`.
- Confirm no order is submitted automatically after the decision returns.

### 3. Explicit simulated execution handoff

- Use a decision that is executable under the current guardrails.
- Confirm the simulated execution button remains blocked until the acknowledgment checkbox is checked.
- Check the acknowledgment only after reviewing the decision.
- Click **Execute simulated paper decision**.
- Confirm the request uses `POST /api/ai/paper-trader/execute`.
- Confirm the result is a simulated paper-trading record only.
- Confirm `live_execution=false` and no live broker endpoint is contacted.

### 4. Manual schedules

- Create a manual AI paper schedule with `auto_execute=false`.
- Confirm schedule list/create/delete calls use `/api/ai/paper-trader/schedules`.
- Refresh the schedule list.
- Request a due/manual run.
- Run the AI decision from the schedule request.
- Record the last decision manually.
- Confirm the panel states background loops are disabled and manual decision requests only are used.
- Confirm no schedule starts an autonomous background loop.

### 5. Lifecycle advisory review

- Enter sample marks, profit/loss thresholds, stale-order minutes, and optional market context JSON.
- Click **Run lifecycle review**.
- Confirm the request uses `POST /api/ai/paper-trader/lifecycle`.
- Confirm recommendations are advisory only, such as `hold`, `review_close`, `tighten_stop_review`, `take_profit_review`, `cancel_stale_order_review`, `risk_review`, or `no_action`.
- Confirm no fill, cancel, close, or live order action is submitted automatically.

### 6. Replay

- Load the replay example or paste a decision JSON payload and `marks_by_symbol` JSON.
- Click **Run deterministic replay**.
- Confirm the request uses `POST /api/ai/paper-trader/replay`.
- Confirm outcomes render realized PnL, win/loss/flat/missed-entry state, MFE, and MAE where applicable.
- Confirm replay does not mutate the paper account.

### 7. Decision history

- Click **Load decision history**.
- Confirm the request uses `GET /api/ai/paper-trader/decision-history`.
- Confirm filters for limit, symbol, blocked decisions, and non-trade/hold decisions behave as expected.
- Use **Load all replay records** or **Load this decision into replay**.
- Confirm loading history only fills browser textareas and does not run replay automatically.

### 8. Performance summary

- Load replay output and optional history metadata into the performance panel.
- Click **Summarize performance**.
- Confirm the request uses `POST /api/ai/paper-trader/performance`.
- Confirm overall and grouped metrics render, including decision count, replayed count, win rate, total/average realized PnL, MFE, and MAE.
- Confirm this panel is read-only reporting and does not mutate paper state.

### 9. Review packet

- Build a packet from history/replay inputs or pasted JSON.
- Confirm the request uses `POST /api/ai/paper-trader/review-packet`.
- Confirm the packet includes decisions, replay records, replay results, performance summaries, filters, and metadata when requested.
- Confirm copy-to-clipboard copies the packet JSON only.
- Confirm the review packet flow is read-only and does not run replay unless explicit replay inputs are supplied for packet construction.

### 10. Audit export

- Sync or paste a review packet.
- Select `json`, build an export, copy it, and download it from the browser.
- Select `markdown`, build an export, copy it, and download it from the browser.
- Confirm the request uses `POST /api/ai/paper-trader/audit-export`.
- Confirm the response includes `export_type`, `format`, `filename`, `content_type`, `content`, `size_bytes`, `packet_summary`, and safety flags.
- Confirm downloads are browser-created handoffs; the backend response should not write export files to the server.

## Failure triage

- If the page does not boot, check the browser console and confirm `module_registry.js` loaded the AI paper modules.
- If AI decision generation fails, confirm LM Studio is running, the configured model is loaded, and `LMSTUDIO_BASE_URL` points to the local OpenAI-compatible endpoint.
- If stock or crypto data fails, retry with another liquid symbol and separate market-data/provider failures from UI contract failures.
- If a route returns 404, confirm `src/tradingview_mcp/core/utils/validators.py` preserved all title-scoped AI paper route hook installers.
- If Docker fails in setup/buildx while Python CI and Unit tests are green, treat it as possible infrastructure until logs show a code/build failure.

## Completion record

For each local smoke pass, record:

- Date and commit SHA tested
- Browser and OS
- LM Studio base URL and model name, if used
- Symbols/timeframes tested
- Any provider errors observed
- Pass/fail for each browser smoke section above
- Confirmation that `paper_only=true`, `live_execution=false`, `execution_submitted=false`, and read-only/reporting boundaries remained intact
