(function() {
  const state = {
    schedules: [],
    lastRunRequest: null,
    lastDecision: null,
  };

  function $(id) {
    return document.getElementById(id);
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function textOf(value, fallback = '-') {
    if (value === null || value === undefined || value === '') return fallback;
    if (Array.isArray(value)) return value.length ? value.join(', ') : fallback;
    if (typeof value === 'object') return JSON.stringify(value, null, 2);
    return String(value);
  }

  function setStatus(message) {
    const target = $('aiPaperScheduleStatus');
    if (target) target.textContent = message;
  }

  function printPaper(value) {
    if (typeof window.setResultPane === 'function') window.setResultPane('paper', value);
    else if (typeof window.print === 'function') window.print(value);
  }

  function postJson(url, body) {
    return fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).then(async (response) => {
      const payload = await response.json();
      if (!response.ok || payload.error) {
        const message = payload?.error?.message || `${response.status} ${response.statusText}`;
        throw new Error(message);
      }
      return payload;
    });
  }

  function deleteJson(url) {
    return fetch(url, { method: 'DELETE' }).then(async (response) => {
      const payload = await response.json();
      if (!response.ok || payload.error) {
        const message = payload?.error?.message || `${response.status} ${response.statusText}`;
        throw new Error(message);
      }
      return payload;
    });
  }

  function activeSymbol() {
    return String($('symbol')?.value || '').trim().toUpperCase();
  }

  function activeAssetType() {
    const asset = String($('asset')?.value || 'auto').toLowerCase();
    const symbol = activeSymbol();
    if (asset === 'crypto' || symbol.endsWith('USDT') || symbol.endsWith('-USD')) return 'crypto';
    if (asset === 'stock' || asset === 'auto') return 'stock';
    return 'other';
  }

  function listFromInput(id, fallback = []) {
    const raw = String($(id)?.value || '').trim();
    const values = raw ? raw.split(',').map((item) => item.trim()).filter(Boolean) : [];
    return values.length ? values : fallback;
  }

  function numberFromInput(id, fallback = null) {
    const value = parseFloat(String($(id)?.value || '').trim());
    return Number.isFinite(value) && value > 0 ? value : fallback;
  }

  function buildRiskConfig() {
    return {
      max_position_value: numberFromInput('aiScheduleMaxPositionValue', 1000),
      max_risk_per_trade_value: numberFromInput('aiScheduleMaxRiskValue', 100),
      max_trades_per_day: numberFromInput('aiScheduleMaxTradesPerDay', 3),
      max_open_positions: numberFromInput('aiScheduleMaxOpenPositions', 3),
      max_open_orders: numberFromInput('aiScheduleMaxOpenOrders', 5),
      min_risk_reward: numberFromInput('aiScheduleMinRiskReward', 0),
      min_confidence_for_open: $('aiScheduleMinConfidence')?.value || 'low',
      require_confirmation: !!$('aiScheduleRequireConfirmation')?.checked,
      require_stop_price: !!$('aiScheduleRequireStop')?.checked,
      require_market_open: !!$('aiScheduleRequireMarketOpen')?.checked,
      market_session: $('aiScheduleMarketSession')?.value || 'unknown',
      allow_short: !!$('aiScheduleAllowShort')?.checked,
      allowed_symbols: listFromInput('aiScheduleAllowedSymbols'),
      blocked_symbols: [],
    };
  }

  function buildSchedulePayload() {
    const symbols = listFromInput('aiScheduleSymbols', activeSymbol() ? [activeSymbol()] : []);
    if (!symbols.length) throw new Error('Add at least one symbol for the AI paper schedule.');
    const triggerType = $('aiScheduleTriggerType')?.value || 'manual';
    return {
      name: $('aiScheduleName')?.value || `AI paper schedule ${symbols[0]}`,
      enabled: !!$('aiScheduleEnabled')?.checked,
      symbols,
      asset_type: $('aiScheduleAssetType')?.value || activeAssetType(),
      exchange: $('aiScheduleExchange')?.value || $('exchange')?.value || 'NASDAQ',
      timeframe: $('aiScheduleTimeframe')?.value || $('tf')?.value || '5m',
      timeframes: listFromInput('aiScheduleTimeframes', ['5m', '15m', '1h', '1D']),
      profile: $('aiScheduleProfile')?.value || 'intraday_paper',
      mode: 'paper_trader_scheduled_decision',
      trigger: {
        type: triggerType,
        interval_minutes: numberFromInput('aiScheduleIntervalMinutes', 15),
        time_utc: $('aiScheduleTimeUtc')?.value || '14:30',
        market: $('aiScheduleMarket')?.value || 'US',
        offset_minutes: Number($('aiScheduleOffsetMinutes')?.value || 0),
      },
      risk: buildRiskConfig(),
      execution: {
        auto_execute: false,
        fill_market_orders: !!$('aiScheduleFillMarketOrders')?.checked,
        cancel_open_orders_on_no_trade: !!$('aiScheduleCancelOnNoTrade')?.checked,
      },
    };
  }

  function renderScheduleList() {
    const target = $('aiPaperScheduleList');
    if (!target) return;
    if (!state.schedules.length) {
      target.innerHTML = '<p class="muted">No AI paper schedules saved yet.</p>';
      return;
    }
    target.innerHTML = state.schedules.map((schedule) => {
      const id = escapeHtml(schedule.id);
      return `
        <div class="ai-paper-schedule-card">
          <div class="ai-trade-card-header">
            <div>
              <strong>${escapeHtml(schedule.name || 'AI paper schedule')}</strong>
              <div class="muted">${escapeHtml((schedule.symbols || []).join(', '))} · ${escapeHtml(schedule.trigger?.type || 'manual')} · next ${escapeHtml(textOf(schedule.next_run_at, 'manual'))}</div>
            </div>
            <span class="ai-trade-badge">${schedule.enabled ? 'enabled' : 'disabled'}</span>
          </div>
          <div class="ai-trade-grid">
            <div><span>Profile</span><b>${escapeHtml(schedule.profile || '-')}</b></div>
            <div><span>Timeframes</span><b>${escapeHtml(textOf(schedule.timeframes))}</b></div>
            <div><span>Runs</span><b>${escapeHtml(textOf(schedule.run_count, '0'))}</b></div>
            <div><span>Paper only</span><b>${schedule.paper_only ? 'true' : 'false'}</b></div>
          </div>
          <div class="ai-trade-actions">
            <button type="button" class="secondary" data-action="aiPaperSchedule.run" data-action-arg="${id}">Run scheduled decision</button>
            <button type="button" class="secondary" data-action="aiPaperSchedule.record" data-action-arg="${id}">Record last decision</button>
            <button type="button" class="secondary" data-action="aiPaperSchedule.delete" data-action-arg="${id}">Delete</button>
          </div>
        </div>`;
    }).join('');
    if (typeof window.bindWorkstationActions === 'function') window.bindWorkstationActions(target);
  }

  function renderRunRequest(payload) {
    const target = $('aiPaperScheduleRunPreview');
    if (!target) return;
    const request = payload?.decision_request || payload;
    target.innerHTML = `
      <div class="ai-paper-trader-card executable">
        <div class="ai-trade-card-header">
          <div>
            <div class="label">Scheduled decision request</div>
            <strong>${escapeHtml(request?.symbol || '-')} · ${escapeHtml(request?.timeframe || '-')}</strong>
            <div class="muted">Manual run only. No background loop and no automatic execution.</div>
          </div>
          <span class="ai-trade-badge">paper only</span>
        </div>
        <pre class="analysis-results-panel">${escapeHtml(JSON.stringify(request, null, 2))}</pre>
        <div class="ai-trade-actions">
          <button type="button" class="secondary" data-action="aiPaperSchedule.decision">Run AI decision from schedule request</button>
        </div>
      </div>`;
    if (typeof window.bindWorkstationActions === 'function') window.bindWorkstationActions(target);
  }

  async function refreshAiPaperSchedules() {
    setStatus('Loading AI paper schedules...');
    const response = await fetch('/api/ai/paper-trader/schedules').then((item) => item.json());
    if (response.error) throw new Error(response.error.message || 'Unable to load schedules');
    state.schedules = response.schedules || [];
    renderScheduleList();
    printPaper({ ai_paper_schedules: response, paper_only: true, live_execution: false });
    setStatus(`Loaded ${state.schedules.length} AI paper schedule(s). Background loop disabled.`);
    return response;
  }

  async function createAiPaperSchedule() {
    const payload = buildSchedulePayload();
    setStatus('Saving AI paper schedule...');
    const response = await postJson('/api/ai/paper-trader/schedules', payload);
    await refreshAiPaperSchedules();
    printPaper({ ai_paper_schedule_created: response, paper_only: true, live_execution: false });
    setStatus(`Saved schedule: ${response.schedule?.name || 'AI paper schedule'}.`);
    return response;
  }

  async function deleteAiPaperSchedule(scheduleId) {
    const id = scheduleId || $('aiScheduleSelectedId')?.value;
    if (!id) throw new Error('Select a schedule to delete.');
    setStatus('Deleting AI paper schedule...');
    const response = await deleteJson(`/api/ai/paper-trader/schedules/${encodeURIComponent(id)}`);
    await refreshAiPaperSchedules();
    printPaper({ ai_paper_schedule_deleted: response, paper_only: true, live_execution: false });
    setStatus('Deleted AI paper schedule.');
    return response;
  }

  async function runAiPaperScheduleRequest(scheduleId) {
    const id = scheduleId || $('aiScheduleSelectedId')?.value;
    if (!id) throw new Error('Select a schedule to run.');
    setStatus('Building scheduled AI paper decision request...');
    const response = await postJson(`/api/ai/paper-trader/schedules/${encodeURIComponent(id)}/run-request`, {});
    state.lastRunRequest = response;
    renderRunRequest(response);
    printPaper({ ai_paper_schedule_run_request: response, paper_only: true, live_execution: false });
    setStatus('Scheduled decision request ready. Run AI decision manually to continue.');
    return response;
  }

  async function runAiDecisionFromSchedule() {
    const request = state.lastRunRequest?.decision_request;
    if (!request) throw new Error('Create a scheduled decision request first.');
    setStatus('Running AI decision from scheduled request...');
    const response = await postJson('/api/ai/paper-trader/decision', request);
    state.lastDecision = response;
    printPaper({ ai_paper_schedule_decision: response, paper_only: true, live_execution: false });
    if (typeof window.renderAiPaperTraderDecisionCard === 'function') window.renderAiPaperTraderDecisionCard(response);
    setStatus(`Scheduled AI decision returned: ${response.decision?.action || 'unknown'}. Execution remains manual.`);
    return response;
  }

  async function recordAiPaperScheduleRun(scheduleId) {
    const id = scheduleId || state.lastRunRequest?.schedule?.id || $('aiScheduleSelectedId')?.value;
    if (!id) throw new Error('Select a schedule to record.');
    const result = state.lastDecision || { note: 'manual record from schedule UI without decision result' };
    setStatus('Recording AI paper schedule run...');
    const response = await postJson(`/api/ai/paper-trader/schedules/${encodeURIComponent(id)}/record-run`, { result });
    await refreshAiPaperSchedules();
    printPaper({ ai_paper_schedule_run_recorded: response, paper_only: true, live_execution: false });
    setStatus('Recorded scheduled AI paper run.');
    return response;
  }

  function showError(error) {
    const message = error && error.message ? error.message : String(error);
    setStatus(message);
    if (typeof window.print === 'function') window.print(message);
  }

  function ensurePanel() {
    if ($('aiPaperSchedulePanel')) return;
    const paperStatus = $('paperTradingStatus');
    if (!paperStatus || !paperStatus.parentElement) return;
    const panel = document.createElement('div');
    panel.id = 'aiPaperSchedulePanel';
    panel.className = 'ai-paper-schedule-panel';
    panel.innerHTML = `
      <div class="label">AI paper schedules</div>
      <p class="paper-trading-warning">Schedules create manual decision requests only. Background loop disabled; no live broker orders.</p>
      <div class="paper-order-grid" aria-label="AI paper schedule settings">
        <input id="aiScheduleName" placeholder="schedule name" value="Market open AI paper scan" />
        <input id="aiScheduleSymbols" placeholder="symbols, comma-separated" />
        <select id="aiScheduleAssetType"><option value="stock">stock</option><option value="crypto">crypto</option><option value="other">other</option></select>
        <input id="aiScheduleExchange" placeholder="exchange" value="NASDAQ" />
        <input id="aiScheduleTimeframe" placeholder="timeframe" value="5m" />
        <input id="aiScheduleTimeframes" placeholder="timeframes" value="5m,15m,1h,1D" />
        <select id="aiScheduleProfile"><option value="intraday_paper">intraday paper</option><option value="swing_paper">swing paper</option><option value="risk_review">risk review</option></select>
        <select id="aiScheduleTriggerType"><option value="manual">manual</option><option value="interval">interval</option><option value="daily_time">daily UTC time</option><option value="market_open">market open</option></select>
        <input id="aiScheduleIntervalMinutes" placeholder="interval minutes" value="15" />
        <input id="aiScheduleTimeUtc" placeholder="UTC time HH:MM" value="14:30" />
        <input id="aiScheduleOffsetMinutes" placeholder="offset minutes" value="5" />
        <input id="aiScheduleMarket" placeholder="market" value="US" />
        <input id="aiScheduleMaxPositionValue" placeholder="max position $" value="1000" />
        <input id="aiScheduleMaxRiskValue" placeholder="max risk $" value="100" />
        <input id="aiScheduleMaxTradesPerDay" placeholder="max trades/day" value="3" />
        <input id="aiScheduleMaxOpenPositions" placeholder="max positions" value="3" />
        <input id="aiScheduleMaxOpenOrders" placeholder="max orders" value="5" />
        <input id="aiScheduleMinRiskReward" placeholder="min R/R" value="0" />
        <select id="aiScheduleMinConfidence"><option value="low">min low confidence</option><option value="medium">min medium confidence</option><option value="high">min high confidence</option></select>
        <select id="aiScheduleMarketSession"><option value="unknown">session unknown</option><option value="open">market open</option><option value="closed">market closed</option><option value="crypto_24_7">crypto 24/7</option></select>
        <input id="aiScheduleAllowedSymbols" class="paper-notes-input" placeholder="allowed symbols optional" />
        <label class="sync-toggle"><input id="aiScheduleEnabled" type="checkbox" checked /> enabled</label>
        <label class="sync-toggle"><input id="aiScheduleRequireConfirmation" type="checkbox" checked /> require confirmation</label>
        <label class="sync-toggle"><input id="aiScheduleRequireStop" type="checkbox" /> require stop price</label>
        <label class="sync-toggle"><input id="aiScheduleRequireMarketOpen" type="checkbox" /> require market open</label>
        <label class="sync-toggle"><input id="aiScheduleAllowShort" type="checkbox" /> allow short/sell opens</label>
        <label class="sync-toggle"><input id="aiScheduleFillMarketOrders" type="checkbox" /> schedule preference: fill market orders after explicit execution</label>
        <label class="sync-toggle"><input id="aiScheduleCancelOnNoTrade" type="checkbox" /> cancel open orders on no-trade after explicit execution</label>
        <button type="button" class="secondary" data-action="aiPaperSchedule.create">Save schedule</button>
        <button type="button" class="secondary" data-action="aiPaperSchedule.refresh">Refresh schedules</button>
      </div>
      <div id="aiPaperScheduleStatus" class="module-control-status">AI paper schedules ready. Manual run requests only.</div>
      <div id="aiPaperScheduleList" class="ai-paper-schedule-list"></div>
      <div id="aiPaperScheduleRunPreview" class="ai-paper-schedule-run-preview"></div>
    `;
    paperStatus.parentElement.appendChild(panel);
    if (activeSymbol() && $('aiScheduleSymbols')) $('aiScheduleSymbols').value = activeSymbol();
    if ($('exchange') && $('aiScheduleExchange')) $('aiScheduleExchange').value = $('exchange').value || 'NASDAQ';
    if ($('tf') && $('aiScheduleTimeframe')) $('aiScheduleTimeframe').value = $('tf').value || '5m';
    if (typeof window.bindWorkstationActions === 'function') window.bindWorkstationActions(panel);
  }

  function bootAiPaperSchedulePanel() {
    ensurePanel();
    refreshAiPaperSchedules().catch(showError);
  }

  window.aiPaperScheduleState = state;
  window.refreshAiPaperSchedules = refreshAiPaperSchedules;
  window.createAiPaperSchedule = createAiPaperSchedule;
  window.deleteAiPaperSchedule = deleteAiPaperSchedule;
  window.runAiPaperScheduleRequest = runAiPaperScheduleRequest;
  window.runAiDecisionFromSchedule = runAiDecisionFromSchedule;
  window.recordAiPaperScheduleRun = recordAiPaperScheduleRun;

  if (window.workstationBoot) window.workstationBoot.register('ai-paper-schedules', bootAiPaperSchedulePanel);
  else if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bootAiPaperSchedulePanel);
  else bootAiPaperSchedulePanel();
})();
