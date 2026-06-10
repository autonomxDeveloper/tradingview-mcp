(function() {
  const state = {
    lastPacket: null,
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
    const target = $('aiPaperReviewPacketStatus');
    if (target) target.textContent = message;
  }

  function printPaper(value) {
    if (typeof window.setResultPane === 'function') window.setResultPane('paper', value);
    else if (typeof window.print === 'function') window.print(value);
  }

  function parseJsonTextarea(id, fallback) {
    const raw = String($(id)?.value || '').trim();
    if (!raw) return fallback;
    try {
      return JSON.parse(raw);
    } catch (error) {
      throw new Error(`${id} must contain valid JSON.`);
    }
  }

  function listFromInput(id, fallback = []) {
    const raw = String($(id)?.value || '').trim();
    const values = raw ? raw.split(',').map((item) => item.trim()).filter(Boolean) : [];
    return values.length ? values : fallback;
  }

  function numberFromInput(id, fallback = 100) {
    const value = parseInt(String($(id)?.value || '').trim(), 10);
    return Number.isFinite(value) && value > 0 ? value : fallback;
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

  function buildReviewPacketPayload() {
    return {
      limit: numberFromInput('aiPaperReviewPacketLimit', 100),
      symbol: String($('aiPaperReviewPacketSymbol')?.value || '').trim().toUpperCase() || null,
      include_blocked: !!$('aiPaperReviewPacketIncludeBlocked')?.checked,
      include_non_trade: !!$('aiPaperReviewPacketIncludeNonTrade')?.checked,
      include_decisions: !!$('aiPaperReviewPacketIncludeDecisions')?.checked,
      include_replay_records: !!$('aiPaperReviewPacketIncludeReplayRecords')?.checked,
      marks_by_symbol: parseJsonTextarea('aiPaperReviewPacketMarks', {}),
      replay: parseJsonTextarea('aiPaperReviewPacketReplay', {}),
      groups: listFromInput('aiPaperReviewPacketGroups', ['symbol', 'action', 'side', 'confidence', 'exit_reason', 'outcome']),
    };
  }

  function renderReviewPacket(payload) {
    const target = $('aiPaperReviewPacketResult');
    if (!target) return;
    const packet = payload || {};
    const summary = packet.summary || {};
    const performance = packet.performance || {};
    const perfSummary = performance.summary || {};
    const groups = performance.groups || {};
    const groupRows = Object.entries(groups).flatMap(([group, rows]) => (rows || []).slice(0, 4).map((row) => ({ group, row })));
    target.innerHTML = `
      <div class="ai-paper-trader-card executable">
        <div class="ai-trade-card-header">
          <div>
            <div class="label">AI paper review packet</div>
            <strong>${escapeHtml(packet.packet_type || 'ai_paper_review_packet')}</strong>
            <div class="muted">Read-only audit/export packet · paper_only=${escapeHtml(textOf(packet.paper_only, 'true'))} · live_execution=${escapeHtml(textOf(packet.live_execution, 'false'))}</div>
          </div>
          <span class="ai-trade-badge">read only</span>
        </div>
        <div class="ai-trade-grid">
          <div><span>Decisions</span><b>${escapeHtml(textOf(summary.decision_count, '0'))}</b></div>
          <div><span>Replay records</span><b>${escapeHtml(textOf(summary.replay_record_count, '0'))}</b></div>
          <div><span>Replayed</span><b>${escapeHtml(textOf(summary.replayed_count || perfSummary.replayed_count, '0'))}</b></div>
          <div><span>Win rate</span><b>${escapeHtml(textOf(summary.win_rate || perfSummary.win_rate, '0'))}</b></div>
          <div><span>Total PnL</span><b>${escapeHtml(textOf(summary.total_realized_pnl || perfSummary.total_realized_pnl, '0'))}</b></div>
          <div><span>Symbols</span><b>${escapeHtml(textOf(summary.symbols, 'none'))}</b></div>
        </div>
        <div class="ai-trade-section">
          <b>Grouped performance preview</b>
          ${groupRows.length ? groupRows.map(({ group, row }) => `
            <div class="ai-paper-performance-group">
              <div><strong>${escapeHtml(group)}: ${escapeHtml(textOf(row.key, '-'))}</strong></div>
              <div class="muted">count ${escapeHtml(textOf(row.count, '0'))} · win rate ${escapeHtml(textOf(row.win_rate, '0'))} · avg PnL ${escapeHtml(textOf(row.average_realized_pnl, '0'))}</div>
            </div>`).join('') : '<p class="muted">No grouped performance rows available.</p>'}
        </div>
        <div class="ai-trade-actions">
          <button type="button" class="secondary" data-action="aiPaperReviewPacket.copy">Copy packet JSON</button>
        </div>
        <p class="workflow-note">Review packets are read-only exports. They do not call the LLM, mutate paper state, submit simulated orders, or call live broker endpoints.</p>
      </div>`;
    if (typeof window.bindWorkstationActions === 'function') window.bindWorkstationActions(target);
  }

  function syncReviewPacketInputs() {
    const replaySource = $('aiPaperPerformanceReplay')?.value || $('aiPaperReplayResultJson')?.value || '';
    const marksSource = $('aiPaperReplayMarks')?.value || '';
    if ($('aiPaperReviewPacketReplay') && replaySource) $('aiPaperReviewPacketReplay').value = replaySource;
    if ($('aiPaperReviewPacketMarks') && marksSource) $('aiPaperReviewPacketMarks').value = marksSource;
    setStatus('Synced review packet inputs from replay/performance fields when available.');
  }

  function loadReviewPacketExample() {
    if ($('aiPaperReviewPacketReplay')) {
      $('aiPaperReviewPacketReplay').value = JSON.stringify({
        replays: [
          {
            symbol: 'AAPL',
            action: 'open_trade',
            side: 'buy',
            outcome: 'win',
            exit_reason: 'target_hit',
            realized_pnl: 5,
            realized_pnl_pct: 5,
            max_favorable_excursion_pct: 6,
            max_adverse_excursion_pct: -1,
          },
        ],
      }, null, 2);
    }
    if ($('aiPaperReviewPacketMarks')) {
      $('aiPaperReviewPacketMarks').value = JSON.stringify({
        AAPL: [{ timestamp: '2026-01-01T00:00:00Z', close: 100, high: 106, low: 99 }],
      }, null, 2);
    }
    setStatus('Loaded example review packet inputs.');
  }

  async function buildAiPaperReviewPacket() {
    setStatus('Building read-only AI paper review packet...');
    const payload = buildReviewPacketPayload();
    const response = await postJson('/api/ai/paper-trader/review-packet', payload);
    state.lastPacket = response;
    renderReviewPacket(response);
    printPaper({ ai_paper_review_packet: response, paper_only: true, live_execution: false, execution_submitted: false, read_only: true });
    setStatus('Review packet ready. Read-only export; no execution or paper mutation.');
    return response;
  }

  async function copyAiPaperReviewPacket() {
    const packet = state.lastPacket;
    if (!packet) throw new Error('Build a review packet before copying.');
    const text = JSON.stringify(packet, null, 2);
    if (navigator.clipboard && navigator.clipboard.writeText) await navigator.clipboard.writeText(text);
    else if (typeof window.print === 'function') window.print(text);
    setStatus('Review packet JSON copied.');
    return packet;
  }

  function ensurePanel() {
    if ($('aiPaperReviewPacketPanel')) return;
    const paperStatus = $('paperTradingStatus');
    if (!paperStatus || !paperStatus.parentElement) return;
    const panel = document.createElement('div');
    panel.id = 'aiPaperReviewPacketPanel';
    panel.className = 'ai-paper-review-packet-panel';
    panel.innerHTML = `
      <div class="label">AI paper review packet</div>
      <p class="paper-trading-warning">Read-only audit/export packets. No LLM calls, paper mutation, simulated order submission, or live broker execution.</p>
      <div class="paper-order-grid" aria-label="AI paper review packet settings">
        <input id="aiPaperReviewPacketLimit" placeholder="history limit" value="100" />
        <input id="aiPaperReviewPacketSymbol" placeholder="optional symbol filter" />
        <input id="aiPaperReviewPacketGroups" placeholder="groups" value="symbol,action,side,confidence,exit_reason,outcome" />
        <label><input id="aiPaperReviewPacketIncludeBlocked" type="checkbox" checked /> include blocked</label>
        <label><input id="aiPaperReviewPacketIncludeNonTrade" type="checkbox" checked /> include no-trade/hold</label>
        <label><input id="aiPaperReviewPacketIncludeDecisions" type="checkbox" checked /> include decisions</label>
        <label><input id="aiPaperReviewPacketIncludeReplayRecords" type="checkbox" checked /> include replay records</label>
        <textarea id="aiPaperReviewPacketReplay" class="paper-notes-input" placeholder='optional replay JSON, e.g. {"replays": [...]}'></textarea>
        <textarea id="aiPaperReviewPacketMarks" class="paper-notes-input" placeholder='optional marks_by_symbol JSON, e.g. {"AAPL":[{"close":100,"high":106,"low":99}]}'></textarea>
        <button type="button" class="secondary" data-action="aiPaperReviewPacket.sync">Sync replay inputs</button>
        <button type="button" class="secondary" data-action="aiPaperReviewPacket.example">Load packet example</button>
        <button type="button" class="secondary" data-action="aiPaperReviewPacket.build">Build review packet</button>
      </div>
      <div id="aiPaperReviewPacketStatus" class="module-control-status">Review packet builder ready. Read-only; no automatic execution.</div>
      <div id="aiPaperReviewPacketResult" class="ai-paper-review-packet-result"></div>
    `;
    paperStatus.parentElement.appendChild(panel);
    if (typeof window.bindWorkstationActions === 'function') window.bindWorkstationActions(panel);
  }

  function bootAiPaperReviewPacket() {
    ensurePanel();
  }

  window.buildAiPaperReviewPacket = buildAiPaperReviewPacket;
  window.renderAiPaperReviewPacket = renderReviewPacket;
  window.copyAiPaperReviewPacket = copyAiPaperReviewPacket;
  window.syncReviewPacketInputs = syncReviewPacketInputs;
  window.loadReviewPacketExample = loadReviewPacketExample;

  if (window.workstationBoot) window.workstationBoot.register('ai-paper-review-packet', bootAiPaperReviewPacket);
  else if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bootAiPaperReviewPacket);
  else bootAiPaperReviewPacket();
})();
