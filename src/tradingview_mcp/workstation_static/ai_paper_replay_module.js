(function() {
  const state = {
    lastReplay: null,
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
    const target = $('aiPaperReplayStatus');
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

  function parseJsonInput(id, fallback) {
    const raw = String($(id)?.value || '').trim();
    if (!raw) return fallback;
    try {
      const parsed = JSON.parse(raw);
      return parsed === null || parsed === undefined ? fallback : parsed;
    } catch (error) {
      throw new Error(`${id} must contain valid JSON.`);
    }
  }

  function replayOutcomeClass(outcome) {
    const value = String(outcome || '').toLowerCase();
    if (value === 'win') return 'executable';
    if (value === 'loss') return 'blocked';
    if (value === 'missed_entry' || value === 'not_replayed') return 'review';
    return 'neutral';
  }

  function renderReplayRows(replays) {
    if (!replays || !replays.length) return '<p class="muted">No replay rows returned.</p>';
    return replays.map((row) => `
      <div class="ai-paper-replay-row ${replayOutcomeClass(row.outcome)}">
        <div class="ai-trade-card-header">
          <div>
            <strong>${escapeHtml(row.symbol || '-')} · ${escapeHtml(row.side || 'none')} · ${escapeHtml(row.action || 'decision')}</strong>
            <div class="muted">${escapeHtml(row.exit_reason || 'not_replayed')} · ${escapeHtml(textOf(row.bars_replayed, '0'))} bar(s)</div>
          </div>
          <span class="ai-trade-badge">${escapeHtml(row.outcome || 'not_replayed')}</span>
        </div>
        <div class="ai-trade-grid">
          <div><span>Qty</span><b>${escapeHtml(textOf(row.quantity, '0'))}</b></div>
          <div><span>Entry</span><b>${escapeHtml(textOf(row.entry_price, '-'))}</b></div>
          <div><span>Exit</span><b>${escapeHtml(textOf(row.exit_price, '-'))}</b></div>
          <div><span>PnL</span><b>${escapeHtml(textOf(row.realized_pnl, '0'))}</b></div>
          <div><span>PnL %</span><b>${escapeHtml(textOf(row.realized_pnl_pct, '0'))}</b></div>
          <div><span>MFE %</span><b>${escapeHtml(textOf(row.max_favorable_excursion_pct, '0'))}</b></div>
          <div><span>MAE %</span><b>${escapeHtml(textOf(row.max_adverse_excursion_pct, '0'))}</b></div>
          <div><span>Execution</span><b>${escapeHtml(textOf(row.execution_submitted, 'false'))}</b></div>
        </div>
      </div>`).join('');
  }

  function renderReplay(payload) {
    const target = $('aiPaperReplayResult');
    if (!target) return;
    const replay = payload?.replay || payload || {};
    const summary = replay.summary || {};
    target.innerHTML = `
      <div class="ai-paper-trader-card executable">
        <div class="ai-trade-card-header">
          <div>
            <div class="label">AI paper replay</div>
            <strong>${escapeHtml(textOf(summary.replayed_count, '0'))} replayed · ${escapeHtml(textOf(summary.win_rate, '0'))} win rate</strong>
            <div class="muted">Research-only replay · paper_only=${escapeHtml(textOf(replay.paper_only, 'true'))} · live_execution=${escapeHtml(textOf(replay.live_execution, 'false'))}</div>
          </div>
          <span class="ai-trade-badge">replay</span>
        </div>
        <div class="ai-trade-grid">
          <div><span>Decisions</span><b>${escapeHtml(textOf(summary.decision_count, '0'))}</b></div>
          <div><span>Wins</span><b>${escapeHtml(textOf(summary.win_count, '0'))}</b></div>
          <div><span>Losses</span><b>${escapeHtml(textOf(summary.loss_count, '0'))}</b></div>
          <div><span>Flats</span><b>${escapeHtml(textOf(summary.flat_count, '0'))}</b></div>
          <div><span>Missed</span><b>${escapeHtml(textOf(summary.missed_entry_count, '0'))}</b></div>
          <div><span>Total PnL</span><b>${escapeHtml(textOf(summary.total_realized_pnl, '0'))}</b></div>
          <div><span>Avg PnL</span><b>${escapeHtml(textOf(summary.average_realized_pnl, '0'))}</b></div>
          <div><span>Background loop</span><b>${escapeHtml(textOf(replay.background_loop_enabled, 'false'))}</b></div>
        </div>
        <div class="ai-trade-section"><b>Replay rows</b>${renderReplayRows(replay.replays || [])}</div>
        <p class="workflow-note">Replay is research-only. It does not mutate the paper account or submit simulated/live orders.</p>
      </div>`;
  }

  function exampleReplayPayload() {
    const symbol = String($('symbol')?.value || 'AAPL').trim().toUpperCase() || 'AAPL';
    const decisions = [
      {
        symbol,
        decision: {
          action: 'open_trade',
          side: 'buy',
          quantity: 1,
          order_type: 'market',
          limit_price: 100,
          stop_price: 95,
          take_profit: 108,
          paper_only: true,
          live_execution: false,
        },
      },
    ];
    const marksBySymbol = {
      [symbol]: [
        { timestamp: '2026-06-10T14:30:00Z', open: 100, high: 102, low: 99, close: 101 },
        { timestamp: '2026-06-10T14:35:00Z', open: 101, high: 109, low: 100, close: 108 },
      ],
    };
    if ($('aiPaperReplayDecisions')) $('aiPaperReplayDecisions').value = JSON.stringify(decisions, null, 2);
    if ($('aiPaperReplayMarks')) $('aiPaperReplayMarks').value = JSON.stringify(marksBySymbol, null, 2);
    setStatus('Loaded example replay payload. Adjust decisions/marks, then run replay.');
  }

  async function runAiPaperReplay() {
    const decisions = parseJsonInput('aiPaperReplayDecisions', []);
    const marksBySymbol = parseJsonInput('aiPaperReplayMarks', {});
    if (!Array.isArray(decisions) || !decisions.length) throw new Error('Replay decisions JSON must be a non-empty array.');
    if (!marksBySymbol || typeof marksBySymbol !== 'object' || Array.isArray(marksBySymbol)) throw new Error('Replay marks JSON must be an object keyed by symbol.');
    setStatus('Running deterministic AI paper replay...');
    const response = await postJson('/api/ai/paper-trader/replay', { decisions, marks_by_symbol: marksBySymbol });
    state.lastReplay = response;
    renderReplay(response);
    printPaper({ ai_paper_replay: response, paper_only: true, live_execution: false, execution_submitted: false });
    setStatus('Replay complete. Research-only; no paper account mutation or execution submitted.');
    return response;
  }

  function showError(error) {
    const message = error && error.message ? error.message : String(error);
    setStatus(message);
    if (typeof window.print === 'function') window.print(message);
  }

  function ensurePanel() {
    if ($('aiPaperReplayPanel')) return;
    const paperStatus = $('paperTradingStatus');
    if (!paperStatus || !paperStatus.parentElement) return;
    const panel = document.createElement('div');
    panel.id = 'aiPaperReplayPanel';
    panel.className = 'ai-paper-replay-panel';
    panel.innerHTML = `
      <div class="label">AI paper replay</div>
      <p class="paper-trading-warning">Replay is research-only. It does not mutate the paper account, submit simulated orders, or live-execute trades.</p>
      <div class="paper-order-grid" aria-label="AI paper replay settings">
        <textarea id="aiPaperReplayDecisions" class="paper-notes-input" placeholder='decisions JSON array'></textarea>
        <textarea id="aiPaperReplayMarks" class="paper-notes-input" placeholder='marks_by_symbol JSON object'></textarea>
        <button type="button" class="secondary" data-action="aiPaperReplay.example">Load replay example</button>
        <button type="button" class="secondary" data-action="aiPaperReplay.run">Run deterministic replay</button>
      </div>
      <div id="aiPaperReplayStatus" class="module-control-status">Replay ready. Paste decisions and historical marks, then run a research-only replay.</div>
      <div id="aiPaperReplayResult" class="ai-paper-replay-result"></div>
    `;
    paperStatus.parentElement.appendChild(panel);
    if (typeof window.bindWorkstationActions === 'function') window.bindWorkstationActions(panel);
  }

  function bootAiPaperReplay() {
    ensurePanel();
  }

  window.runAiPaperReplay = runAiPaperReplay;
  window.loadAiPaperReplayExample = exampleReplayPayload;
  window.renderAiPaperReplay = renderReplay;

  if (window.workstationBoot) window.workstationBoot.register('ai-paper-replay', bootAiPaperReplay);
  else if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bootAiPaperReplay);
  else bootAiPaperReplay();
})();
