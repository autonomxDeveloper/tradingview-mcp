(function() {
  const state = {
    lastExport: null,
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
    const target = $('aiPaperAuditExportStatus');
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

  function selectedFormat() {
    const value = String($('aiPaperAuditExportFormat')?.value || 'json').trim().toLowerCase();
    return value === 'markdown' || value === 'md' ? 'markdown' : 'json';
  }

  function buildAuditExportPayload() {
    const packet = parseJsonTextarea('aiPaperAuditExportPacket', {});
    const payload = {
      packet,
      export_format: selectedFormat(),
      name: String($('aiPaperAuditExportName')?.value || '').trim() || null,
      limit: numberFromInput('aiPaperAuditExportLimit', 100),
      symbol: String($('aiPaperAuditExportSymbol')?.value || '').trim().toUpperCase() || null,
      include_blocked: !!$('aiPaperAuditExportIncludeBlocked')?.checked,
      include_non_trade: !!$('aiPaperAuditExportIncludeNonTrade')?.checked,
      include_decisions: !!$('aiPaperAuditExportIncludeDecisions')?.checked,
      include_replay_records: !!$('aiPaperAuditExportIncludeReplayRecords')?.checked,
      marks_by_symbol: parseJsonTextarea('aiPaperAuditExportMarks', {}),
      replay: parseJsonTextarea('aiPaperAuditExportReplay', {}),
      groups: listFromInput('aiPaperAuditExportGroups', ['symbol', 'action', 'side', 'confidence', 'exit_reason', 'outcome']),
    };
    if (!Object.keys(packet || {}).length) delete payload.packet;
    return payload;
  }

  function renderAuditExport(payload) {
    const target = $('aiPaperAuditExportResult');
    if (!target) return;
    const exportPayload = payload || {};
    const summary = exportPayload.packet_summary || {};
    target.innerHTML = `
      <div class="ai-paper-trader-card executable">
        <div class="ai-trade-card-header">
          <div>
            <div class="label">AI paper audit export</div>
            <strong>${escapeHtml(exportPayload.filename || 'ai-paper-audit.json')}</strong>
            <div class="muted">${escapeHtml(exportPayload.content_type || 'application/json')} · ${escapeHtml(textOf(exportPayload.size_bytes, '0'))} bytes · paper_only=${escapeHtml(textOf(exportPayload.paper_only, 'true'))} · live_execution=${escapeHtml(textOf(exportPayload.live_execution, 'false'))}</div>
          </div>
          <span class="ai-trade-badge">read only</span>
        </div>
        <div class="ai-trade-grid">
          <div><span>Format</span><b>${escapeHtml(textOf(exportPayload.format, 'json'))}</b></div>
          <div><span>Decisions</span><b>${escapeHtml(textOf(summary.decision_count, '0'))}</b></div>
          <div><span>Replay records</span><b>${escapeHtml(textOf(summary.replay_record_count, '0'))}</b></div>
          <div><span>Win rate</span><b>${escapeHtml(textOf(summary.win_rate, '0'))}</b></div>
          <div><span>Total PnL</span><b>${escapeHtml(textOf(summary.total_realized_pnl, '0'))}</b></div>
          <div><span>Symbols</span><b>${escapeHtml(textOf(summary.symbols, 'none'))}</b></div>
        </div>
        <div class="ai-trade-section">
          <b>Audit content preview</b>
          <pre id="aiPaperAuditExportOutput" class="paper-json-output">${escapeHtml(String(exportPayload.content || '').slice(0, 8000))}</pre>
        </div>
        <div class="ai-trade-actions">
          <button type="button" class="secondary" data-action="aiPaperAuditExport.copy">Copy audit export</button>
          <button type="button" class="secondary" data-action="aiPaperAuditExport.download">Download audit export</button>
        </div>
        <p class="workflow-note">Audit exports are read-only reporting artifacts. They do not call the LLM, mutate paper state, submit simulated orders, write server files, or call live broker endpoints.</p>
      </div>`;
    if (typeof window.bindWorkstationActions === 'function') window.bindWorkstationActions(target);
  }

  function syncAuditExportInputs() {
    const replaySource = $('aiPaperReviewPacketReplay')?.value || $('aiPaperPerformanceReplay')?.value || $('aiPaperReplayResultJson')?.value || '';
    const marksSource = $('aiPaperReviewPacketMarks')?.value || $('aiPaperReplayMarks')?.value || '';
    const groupsSource = $('aiPaperReviewPacketGroups')?.value || $('aiPaperPerformanceGroups')?.value || '';
    const reviewPacketOutput = $('aiPaperReviewPacketOutput')?.textContent || $('aiPaperReviewPacketOutput')?.value || '';
    if ($('aiPaperAuditExportReplay') && replaySource) $('aiPaperAuditExportReplay').value = replaySource;
    if ($('aiPaperAuditExportMarks') && marksSource) $('aiPaperAuditExportMarks').value = marksSource;
    if ($('aiPaperAuditExportGroups') && groupsSource) $('aiPaperAuditExportGroups').value = groupsSource;
    if ($('aiPaperAuditExportPacket') && reviewPacketOutput) $('aiPaperAuditExportPacket').value = reviewPacketOutput;
    setStatus('Synced audit export inputs from review/replay/performance fields when available.');
  }

  function loadAuditExportExample() {
    if ($('aiPaperAuditExportFormat')) $('aiPaperAuditExportFormat').value = 'markdown';
    if ($('aiPaperAuditExportName')) $('aiPaperAuditExportName').value = 'ai-paper-audit-example';
    if ($('aiPaperAuditExportPacket')) {
      $('aiPaperAuditExportPacket').value = JSON.stringify({
        packet_type: 'ai_paper_review_packet',
        summary: {
          decision_count: 1,
          replay_record_count: 1,
          replayed_count: 1,
          win_rate: 100,
          total_realized_pnl: 5,
          symbols: ['AAPL'],
        },
        performance: {
          summary: { replayed_count: 1, win_rate: 100, total_realized_pnl: 5 },
          groups: {
            symbol: [{ key: 'AAPL', count: 1, win_rate: 100, average_realized_pnl: 5 }],
          },
        },
        paper_only: true,
        live_execution: false,
        execution_submitted: false,
        background_loop_enabled: false,
        read_only: true,
      }, null, 2);
    }
    setStatus('Loaded example audit export packet. Read-only; no account mutation.');
  }

  async function buildAiPaperAuditExport() {
    setStatus('Building read-only AI paper audit export...');
    const payload = buildAuditExportPayload();
    const response = await postJson('/api/ai/paper-trader/audit-export', payload);
    state.lastExport = response;
    renderAuditExport(response);
    printPaper({ ai_paper_audit_export: response, paper_only: true, live_execution: false, execution_submitted: false, read_only: true });
    setStatus('Audit export ready. Read-only reporting; no LLM, no paper mutation, no live execution.');
    return response;
  }

  async function copyAiPaperAuditExport() {
    const exportPayload = state.lastExport;
    if (!exportPayload) throw new Error('Build an audit export before copying.');
    const text = String(exportPayload.content || '');
    if (navigator.clipboard && navigator.clipboard.writeText) await navigator.clipboard.writeText(text);
    else if (typeof window.print === 'function') window.print(text);
    setStatus('Audit export content copied.');
    return exportPayload;
  }

  function downloadAiPaperAuditExport() {
    const exportPayload = state.lastExport;
    if (!exportPayload) throw new Error('Build an audit export before downloading.');
    const blob = new Blob([String(exportPayload.content || '')], { type: exportPayload.content_type || 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = exportPayload.filename || (selectedFormat() === 'markdown' ? 'ai-paper-audit.md' : 'ai-paper-audit.json');
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    setStatus('Audit export download started in the browser.');
    return exportPayload;
  }

  function ensurePanel() {
    if ($('aiPaperAuditExportPanel')) return;
    const reviewPanel = $('aiPaperReviewPacketPanel');
    const paperStatus = $('paperTradingStatus');
    const anchor = reviewPanel || paperStatus;
    if (!anchor || !anchor.parentElement) return;
    const panel = document.createElement('div');
    panel.id = 'aiPaperAuditExportPanel';
    panel.className = 'ai-paper-audit-export-panel';
    panel.innerHTML = `
      <div class="label">AI paper audit export</div>
      <p class="paper-trading-warning">Read-only browser export for AI paper review packets. No LLM calls, paper mutation, simulated order submission, server file writes, or live broker execution.</p>
      <div class="paper-order-grid" aria-label="AI paper audit export settings">
        <select id="aiPaperAuditExportFormat" aria-label="Audit export format">
          <option value="json">JSON</option>
          <option value="markdown">Markdown</option>
        </select>
        <input id="aiPaperAuditExportName" placeholder="optional filename prefix" />
        <input id="aiPaperAuditExportLimit" placeholder="history limit" value="100" />
        <input id="aiPaperAuditExportSymbol" placeholder="optional symbol filter" />
        <input id="aiPaperAuditExportGroups" placeholder="groups" value="symbol,action,side,confidence,exit_reason,outcome" />
        <label><input id="aiPaperAuditExportIncludeBlocked" type="checkbox" checked /> include blocked</label>
        <label><input id="aiPaperAuditExportIncludeNonTrade" type="checkbox" checked /> include no-trade/hold</label>
        <label><input id="aiPaperAuditExportIncludeDecisions" type="checkbox" checked /> include decisions</label>
        <label><input id="aiPaperAuditExportIncludeReplayRecords" type="checkbox" checked /> include replay records</label>
        <textarea id="aiPaperAuditExportPacket" class="paper-notes-input" placeholder='optional review packet JSON; leave blank to build from history/replay inputs'></textarea>
        <textarea id="aiPaperAuditExportReplay" class="paper-notes-input" placeholder='optional replay JSON, e.g. {"replays": [...]}'></textarea>
        <textarea id="aiPaperAuditExportMarks" class="paper-notes-input" placeholder='optional marks_by_symbol JSON, e.g. {"AAPL":[{"close":100,"high":106,"low":99}]}'></textarea>
        <button type="button" class="secondary" data-action="aiPaperAuditExport.sync">Sync audit inputs</button>
        <button type="button" class="secondary" data-action="aiPaperAuditExport.example">Load audit example</button>
        <button type="button" class="secondary" data-action="aiPaperAuditExport.build">Build audit export</button>
      </div>
      <div id="aiPaperAuditExportStatus" class="module-control-status">Audit export builder ready. Read-only; paper_only: true · live_execution: false · execution_submitted: false · read_only: true.</div>
      <div id="aiPaperAuditExportResult" class="ai-paper-audit-export-result"></div>
    `;
    if (reviewPanel && reviewPanel.nextSibling) reviewPanel.parentElement.insertBefore(panel, reviewPanel.nextSibling);
    else anchor.parentElement.appendChild(panel);
    if (typeof window.bindWorkstationActions === 'function') window.bindWorkstationActions(panel);
  }

  function bootAiPaperAuditExport() {
    ensurePanel();
  }

  window.buildAiPaperAuditExport = buildAiPaperAuditExport;
  window.renderAiPaperAuditExport = renderAuditExport;
  window.copyAiPaperAuditExport = copyAiPaperAuditExport;
  window.downloadAiPaperAuditExport = downloadAiPaperAuditExport;
  window.syncAuditExportInputs = syncAuditExportInputs;
  window.loadAuditExportExample = loadAuditExportExample;

  if (window.workstationBoot) window.workstationBoot.register('ai-paper-audit-export', bootAiPaperAuditExport);
  else if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bootAiPaperAuditExport);
  else bootAiPaperAuditExport();
})();
