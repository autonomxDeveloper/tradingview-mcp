(function() {
  const state = {
    lastHistory: null,
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

  function boolQuery(id) {
    return !!$(id)?.checked;
  }

  function setStatus(message) {
    const target = $('aiPaperHistoryStatus');
    if (target) target.textContent = message;
  }

  function printPaper(value) {
    if (typeof window.setResultPane === 'function') window.setResultPane('paper', value);
    else if (typeof window.print === 'function') window.print(value);
  }

  async function getJson(url) {
    const response = await fetch(url);
    const payload = await response.json();
    if (!response.ok || payload.error) {
      const message = payload?.error?.message || `${response.status} ${response.statusText}`;
      throw new Error(message);
    }
    return payload;
  }

  function historyUrl() {
    const params = new URLSearchParams();
    const limit = parseInt(String($('aiPaperHistoryLimit')?.value || '50'), 10);
    const symbol = String($('aiPaperHistorySymbol')?.value || '').trim().toUpperCase();
    params.set('limit', String(Number.isFinite(limit) && limit > 0 ? Math.min(limit, 1000) : 50));
    if (symbol) params.set('symbol', symbol);
    params.set('include_blocked', String(boolQuery('aiPaperHistoryIncludeBlocked')));
    params.set('include_non_trade', String(boolQuery('aiPaperHistoryIncludeNonTrade')));
    return `/api/ai/paper-trader/decision-history?${params.toString()}`;
  }

  function decisionClass(record) {
    if ((record.guardrail_warnings || []).length) return 'blocked';
    if (record.paper_trade_candidate) return 'executable';
    return 'review';
  }

  function renderHistoryRows(records) {
    if (!records || !records.length) return '<p class="muted">No saved AI paper decisions found.</p>';
    return records.map((record, index) => `
      <div class="ai-paper-history-row ${decisionClass(record)}">
        <div class="ai-trade-card-header">
          <div>
            <strong>${escapeHtml(record.symbol || '-')} · ${escapeHtml(record.action || 'decision')} · ${escapeHtml(record.side || 'none')}</strong>
            <div class="muted">${escapeHtml(record.timestamp_utc || '-')} · ${escapeHtml(record.profile || '-')} · ${escapeHtml(record.timeframe || '-')}</div>
          </div>
          <span class="ai-trade-badge">${record.paper_trade_candidate ? 'candidate' : 'history'}</span>
        </div>
        <div class="ai-trade-grid">
          <div><span>Qty</span><b>${escapeHtml(textOf(record.quantity, '0'))}</b></div>
          <div><span>Order</span><b>${escapeHtml(textOf(record.order_type, '-'))}</b></div>
          <div><span>Confidence</span><b>${escapeHtml(textOf(record.confidence, '-'))}</b></div>
          <div><span>R/R</span><b>${escapeHtml(textOf(record.risk_reward, 'unknown'))}</b></div>
          <div><span>Warnings</span><b>${escapeHtml(textOf(record.guardrail_warnings, 'none'))}</b></div>
          <div><span>Executed symbol</span><b>${escapeHtml(textOf(record.has_execution_event_for_symbol, 'false'))}</b></div>
        </div>
        <div class="ai-trade-actions">
          <button type="button" class="secondary" data-action="aiPaperHistory.loadOne" data-action-arg="${index}">Load this decision into replay</button>
        </div>
      </div>`).join('');
  }

  function renderHistory(payload) {
    const target = $('aiPaperHistoryResult');
    if (!target) return;
    const summary = payload?.summary || {};
    target.innerHTML = `
      <div class="ai-paper-trader-card executable">
        <div class="ai-trade-card-header">
          <div>
            <div class="label">AI paper decision history</div>
            <strong>${escapeHtml(textOf(summary.decision_count, '0'))} decision(s) · ${escapeHtml(textOf(summary.replay_record_count, '0'))} replay-ready</strong>
            <div class="muted">Read-only journal view · paper_only=${escapeHtml(textOf(payload.paper_only, 'true'))} · live_execution=${escapeHtml(textOf(payload.live_execution, 'false'))}</div>
          </div>
          <span class="ai-trade-badge">read only</span>
        </div>
        <div class="ai-trade-grid">
          <div><span>Symbols</span><b>${escapeHtml(textOf(summary.symbols, 'none'))}</b></div>
          <div><span>Blocked</span><b>${escapeHtml(textOf(summary.blocked_count, '0'))}</b></div>
          <div><span>Candidates</span><b>${escapeHtml(textOf(summary.trade_candidate_count, '0'))}</b></div>
          <div><span>Execution symbols</span><b>${escapeHtml(textOf(summary.execution_event_symbol_count, '0'))}</b></div>
          <div><span>Read only</span><b>${escapeHtml(textOf(payload.read_only, 'true'))}</b></div>
          <div><span>Background loop</span><b>${escapeHtml(textOf(payload.background_loop_enabled, 'false'))}</b></div>
        </div>
        <div class="ai-trade-actions">
          <button type="button" class="secondary" data-action="aiPaperHistory.loadReplay">Load all replay records</button>
        </div>
        <div class="ai-trade-section"><b>Decision records</b>${renderHistoryRows(payload.decisions || [])}</div>
        <p class="workflow-note">History is read-only. Loading replay records only fills the replay textarea; it does not mutate the paper account or execute orders.</p>
      </div>`;
    if (typeof window.bindWorkstationActions === 'function') window.bindWorkstationActions(target);
  }

  function setReplayDecisions(records) {
    const target = $('aiPaperReplayDecisions');
    if (!target) throw new Error('AI paper replay panel is not loaded yet.');
    target.value = JSON.stringify(records || [], null, 2);
    if (typeof window.print === 'function') window.print({ ai_paper_history_loaded_replay_records: records, read_only: true, paper_only: true, live_execution: false });
  }

  function loadHistoryReplayRecords() {
    const records = state.lastHistory?.replay_records || [];
    if (!records.length) throw new Error('No replay records are available from the current history query.');
    setReplayDecisions(records);
    setStatus(`Loaded ${records.length} replay record(s) into the replay decisions textarea.`);
  }

  function loadOneHistoryDecision(index) {
    const record = state.lastHistory?.decisions?.[Number(index)];
    if (!record) throw new Error('History decision record not found.');
    setReplayDecisions([record.replay_record]);
    setStatus(`Loaded ${record.symbol || 'decision'} into the replay decisions textarea.`);
  }

  async function refreshAiPaperDecisionHistory() {
    setStatus('Loading read-only AI paper decision history...');
    const response = await getJson(historyUrl());
    state.lastHistory = response;
    renderHistory(response);
    printPaper({ ai_paper_decision_history: response, read_only: true, paper_only: true, live_execution: false, execution_submitted: false });
    setStatus(`Loaded ${response.summary?.decision_count || 0} AI paper decision(s). Read-only; no execution.`);
    return response;
  }

  function showError(error) {
    const message = error && error.message ? error.message : String(error);
    setStatus(message);
    if (typeof window.print === 'function') window.print(message);
  }

  function ensurePanel() {
    if ($('aiPaperHistoryPanel')) return;
    const replayPanel = $('aiPaperReplayPanel');
    const paperStatus = $('paperTradingStatus');
    const anchor = replayPanel || paperStatus;
    if (!anchor || !anchor.parentElement) return;
    const panel = document.createElement('div');
    panel.id = 'aiPaperHistoryPanel';
    panel.className = 'ai-paper-history-panel';
    panel.innerHTML = `
      <div class="label">AI paper decision history</div>
      <p class="paper-trading-warning">History is read-only. Loading decisions into replay does not submit simulated orders or live-execute trades.</p>
      <div class="paper-order-grid" aria-label="AI paper history filters">
        <input id="aiPaperHistorySymbol" placeholder="symbol filter optional" />
        <input id="aiPaperHistoryLimit" placeholder="limit" value="50" />
        <label class="sync-toggle"><input id="aiPaperHistoryIncludeBlocked" type="checkbox" checked /> include blocked</label>
        <label class="sync-toggle"><input id="aiPaperHistoryIncludeNonTrade" type="checkbox" /> include no-trade/hold</label>
        <button type="button" class="secondary" data-action="aiPaperHistory.refresh">Load decision history</button>
      </div>
      <div id="aiPaperHistoryStatus" class="module-control-status">Decision history ready. Read-only journal records for replay.</div>
      <div id="aiPaperHistoryResult" class="ai-paper-history-result"></div>
    `;
    anchor.parentElement.insertBefore(panel, replayPanel ? replayPanel.nextSibling : anchor.nextSibling);
    if (typeof window.bindWorkstationActions === 'function') window.bindWorkstationActions(panel);
  }

  function bootAiPaperHistory() {
    ensurePanel();
  }

  window.refreshAiPaperDecisionHistory = refreshAiPaperDecisionHistory;
  window.loadAiPaperHistoryReplayRecords = loadHistoryReplayRecords;
  window.loadOneAiPaperHistoryDecision = loadOneHistoryDecision;
  window.renderAiPaperDecisionHistory = renderHistory;

  if (window.workstationBoot) window.workstationBoot.register('ai-paper-history', bootAiPaperHistory);
  else if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bootAiPaperHistory);
  else bootAiPaperHistory();
})();
