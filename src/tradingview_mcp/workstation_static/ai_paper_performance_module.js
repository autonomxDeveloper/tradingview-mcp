(function() {
  const state = {
    lastPerformance: null,
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

  function parseJsonInput(id, fallback) {
    const raw = String($(id)?.value || '').trim();
    if (!raw) return fallback;
    try {
      return JSON.parse(raw);
    } catch (error) {
      throw new Error(`${id} must contain valid JSON.`);
    }
  }

  function setStatus(message) {
    const target = $('aiPaperPerformanceStatus');
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

  function parseGroups() {
    const raw = String($('aiPaperPerformanceGroups')?.value || 'symbol,action,side,confidence,exit_reason').trim();
    return raw.split(',').map((item) => item.trim()).filter(Boolean);
  }

  function replayFromReplayTextarea() {
    const replayDecisionRaw = String($('aiPaperReplayDecisions')?.value || '').trim();
    if (!replayDecisionRaw) return { replays: [] };
    const parsed = parseJsonInput('aiPaperReplayResultsInput', { replays: [] });
    return parsed;
  }

  function buildPerformancePayload() {
    return {
      replay: parseJsonInput('aiPaperPerformanceReplay', { replays: [] }),
      decision_history: parseJsonInput('aiPaperPerformanceHistory', []),
      groups: parseGroups(),
    };
  }

  function renderMetricGrid(summary) {
    const metrics = summary || {};
    return `
      <div class="ai-trade-grid">
        <div><span>Decisions</span><b>${escapeHtml(textOf(metrics.decision_count, '0'))}</b></div>
        <div><span>Replayed</span><b>${escapeHtml(textOf(metrics.replayed_count, '0'))}</b></div>
        <div><span>Wins</span><b>${escapeHtml(textOf(metrics.win_count, '0'))}</b></div>
        <div><span>Losses</span><b>${escapeHtml(textOf(metrics.loss_count, '0'))}</b></div>
        <div><span>Flats</span><b>${escapeHtml(textOf(metrics.flat_count, '0'))}</b></div>
        <div><span>Missed</span><b>${escapeHtml(textOf(metrics.missed_entry_count, '0'))}</b></div>
        <div><span>Win rate</span><b>${escapeHtml(textOf(metrics.win_rate, '0'))}</b></div>
        <div><span>Total PnL</span><b>${escapeHtml(textOf(metrics.total_realized_pnl, '0'))}</b></div>
        <div><span>Avg PnL</span><b>${escapeHtml(textOf(metrics.average_realized_pnl, '0'))}</b></div>
      </div>`;
  }

  function renderGroupBuckets(groups) {
    const entries = Object.entries(groups || {});
    if (!entries.length) return '<p class="muted">No grouped performance metrics returned.</p>';
    return entries.map(([group, buckets]) => `
      <div class="ai-trade-section">
        <b>Group: ${escapeHtml(group)}</b>
        ${(buckets || []).map((bucket) => `
          <div class="ai-paper-performance-bucket">
            <div class="ai-trade-card-header">
              <strong>${escapeHtml(bucket.key || 'unknown')}</strong>
              <span class="ai-trade-badge">win rate ${escapeHtml(textOf(bucket.win_rate, '0'))}</span>
            </div>
            ${renderMetricGrid(bucket)}
            <div class="ai-trade-grid">
              <div><span>Avg PnL %</span><b>${escapeHtml(textOf(bucket.average_realized_pnl_pct, '0'))}</b></div>
              <div><span>Avg MFE %</span><b>${escapeHtml(textOf(bucket.average_mfe_pct, '0'))}</b></div>
              <div><span>Avg MAE %</span><b>${escapeHtml(textOf(bucket.average_mae_pct, '0'))}</b></div>
              <div><span>Paper only</span><b>${escapeHtml(textOf(bucket.paper_only, 'true'))}</b></div>
            </div>
          </div>`).join('')}
      </div>`).join('');
  }

  function renderPerformance(payload) {
    const target = $('aiPaperPerformanceResult');
    if (!target) return;
    const summary = payload?.summary || {};
    target.innerHTML = `
      <div class="ai-paper-trader-card executable">
        <div class="ai-trade-card-header">
          <div>
            <div class="label">AI paper performance summary</div>
            <strong>${escapeHtml(textOf(summary.decision_count, '0'))} replay decision(s)</strong>
            <div class="muted">Read-only · paper_only=${escapeHtml(textOf(payload.paper_only, 'true'))} · live_execution=${escapeHtml(textOf(payload.live_execution, 'false'))}</div>
          </div>
          <span class="ai-trade-badge">report</span>
        </div>
        ${renderMetricGrid(summary)}
        <div class="workflow-note">Performance summary is reporting-only. It does not mutate paper state, submit simulated orders, or call live broker endpoints.</div>
        ${renderGroupBuckets(payload?.groups)}
      </div>`;
  }

  function loadReplayResultIntoPerformance() {
    const replayText = String($('aiPaperReplayResultJson')?.value || '').trim();
    const resultTextarea = $('aiPaperPerformanceReplay');
    if (!resultTextarea) throw new Error('Performance replay textarea is missing.');
    if (replayText) {
      resultTextarea.value = replayText;
      setStatus('Loaded replay result JSON into performance input.');
      return;
    }
    const paperText = String($('out')?.textContent || '').trim();
    if (paperText.includes('ai_paper_replay')) {
      resultTextarea.value = paperText;
      setStatus('Loaded paper pane text into performance input; confirm it is valid replay JSON before running.');
      return;
    }
    throw new Error('No replay result JSON found. Paste replay output into the performance replay input.');
  }

  function loadHistoryIntoPerformance() {
    const historyText = String($('aiPaperHistoryResultJson')?.value || '').trim();
    const target = $('aiPaperPerformanceHistory');
    if (!target) throw new Error('Performance history textarea is missing.');
    if (!historyText) throw new Error('No history JSON found. Refresh AI paper decision history first or paste records manually.');
    const parsed = JSON.parse(historyText);
    target.value = JSON.stringify(parsed.records || parsed.decision_history || [], null, 2);
    setStatus('Loaded decision history records into performance input.');
  }

  async function runAiPaperPerformanceSummary() {
    setStatus('Building read-only AI paper performance summary...');
    const payload = buildPerformancePayload();
    const response = await postJson('/api/ai/paper-trader/performance', payload);
    state.lastPerformance = response;
    renderPerformance(response);
    printPaper({ ai_paper_performance: response, paper_only: true, live_execution: false, execution_submitted: false, read_only: true });
    setStatus('Performance summary complete. Reporting-only; no execution or paper account mutation.');
    return response;
  }

  function loadAiPaperPerformanceExample() {
    $('aiPaperPerformanceReplay').value = JSON.stringify({
      replays: [
        { symbol: 'AAPL', action: 'open_trade', side: 'buy', outcome: 'win', exit_reason: 'target_hit', realized_pnl: 50, realized_pnl_pct: 5, max_favorable_excursion_pct: 7, max_adverse_excursion_pct: -1 },
        { symbol: 'MSFT', action: 'open_trade', side: 'buy', outcome: 'loss', exit_reason: 'stop_hit', realized_pnl: -20, realized_pnl_pct: -2, max_favorable_excursion_pct: 1, max_adverse_excursion_pct: -3 },
      ],
    }, null, 2);
    $('aiPaperPerformanceHistory').value = JSON.stringify([
      { symbol: 'AAPL', action: 'open_trade', side: 'buy', confidence: 'high', paper_trade_candidate: true },
      { symbol: 'MSFT', action: 'open_trade', side: 'buy', confidence: 'medium', paper_trade_candidate: true },
    ], null, 2);
    setStatus('Loaded example replay and decision-history metadata.');
  }

  function showError(error) {
    const message = error && error.message ? error.message : String(error);
    setStatus(message);
    if (typeof window.print === 'function') window.print(message);
  }

  function ensurePanel() {
    if ($('aiPaperPerformancePanel')) return;
    const paperStatus = $('paperTradingStatus');
    if (!paperStatus || !paperStatus.parentElement) return;
    const panel = document.createElement('div');
    panel.id = 'aiPaperPerformancePanel';
    panel.className = 'ai-paper-performance-panel';
    panel.innerHTML = `
      <div class="label">AI paper performance</div>
      <p class="paper-trading-warning">Performance summaries are read-only reporting. No LLM calls, paper mutation, simulated execution, or live broker orders.</p>
      <div class="paper-order-grid" aria-label="AI paper performance settings">
        <input id="aiPaperPerformanceGroups" value="symbol,action,side,confidence,exit_reason" placeholder="groups, comma-separated" />
        <button type="button" class="secondary" data-action="aiPaperPerformance.example">Load performance example</button>
        <button type="button" class="secondary" data-action="aiPaperPerformance.fromReplay">Load replay JSON</button>
        <button type="button" class="secondary" data-action="aiPaperPerformance.fromHistory">Load history metadata</button>
        <button type="button" class="secondary" data-action="aiPaperPerformance.run">Summarize performance</button>
      </div>
      <textarea id="aiPaperPerformanceReplay" class="paper-notes-input" placeholder='Replay JSON, e.g. {"replays":[...]}'></textarea>
      <textarea id="aiPaperPerformanceHistory" class="paper-notes-input" placeholder='Optional decision-history JSON array'></textarea>
      <div id="aiPaperPerformanceStatus" class="module-control-status">Performance summary ready. Read-only reporting only.</div>
      <div id="aiPaperPerformanceResult" class="ai-paper-performance-result"></div>
    `;
    paperStatus.parentElement.appendChild(panel);
    if (typeof window.bindWorkstationActions === 'function') window.bindWorkstationActions(panel);
  }

  function bootAiPaperPerformance() {
    ensurePanel();
  }

  window.runAiPaperPerformanceSummary = runAiPaperPerformanceSummary;
  window.loadAiPaperPerformanceExample = loadAiPaperPerformanceExample;
  window.loadReplayResultIntoPerformance = loadReplayResultIntoPerformance;
  window.loadHistoryIntoPerformance = loadHistoryIntoPerformance;
  window.renderAiPaperPerformance = renderPerformance;

  if (window.workstationBoot) window.workstationBoot.register('ai-paper-performance', bootAiPaperPerformance);
  else if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bootAiPaperPerformance);
  else bootAiPaperPerformance();
})();
