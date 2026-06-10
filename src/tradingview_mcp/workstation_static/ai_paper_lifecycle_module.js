(function() {
  const state = {
    lastLifecycle: null,
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

  function numberFromInput(id, fallback = null) {
    const value = parseFloat(String($(id)?.value || '').trim());
    return Number.isFinite(value) && value >= 0 ? value : fallback;
  }

  function setStatus(message) {
    const target = $('aiPaperLifecycleStatus');
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

  function parseMarks() {
    const raw = String($('aiPaperLifecycleMarks')?.value || '').trim();
    if (!raw) return {};
    return raw.split(',').reduce((marks, pair) => {
      const [symbol, price] = pair.split(':').map((item) => String(item || '').trim());
      const parsed = parseFloat(price);
      if (symbol && Number.isFinite(parsed) && parsed > 0) marks[symbol.toUpperCase()] = parsed;
      return marks;
    }, {});
  }

  function parseMarketContext() {
    const raw = String($('aiPaperLifecycleMarketContext')?.value || '').trim();
    if (!raw) return {};
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (error) {
      throw new Error('Lifecycle market context must be valid JSON when provided.');
    }
  }

  function buildLifecycleRisk() {
    return {
      max_unrealized_loss_pct: numberFromInput('aiPaperLifecycleMaxLossPct', 5),
      take_profit_review_pct: numberFromInput('aiPaperLifecycleTakeProfitPct', 8),
      stale_order_minutes: numberFromInput('aiPaperLifecycleStaleMinutes', 60),
      max_position_value: numberFromInput('aiPaperLifecycleMaxPositionValue', 0),
    };
  }

  function recommendationClass(recommendation) {
    const value = String(recommendation || '').toLowerCase();
    if (['review_close', 'risk_review', 'cancel_stale_order_review'].includes(value)) return 'blocked';
    if (['tighten_stop_review', 'take_profit_review'].includes(value)) return 'review';
    return 'executable';
  }

  function renderReviewList(items, emptyLabel) {
    if (!items || !items.length) return `<p class="muted">${escapeHtml(emptyLabel)}</p>`;
    return items.map((item) => `
      <div class="ai-paper-lifecycle-review ${recommendationClass(item.recommendation)}">
        <div class="ai-trade-card-header">
          <div>
            <strong>${escapeHtml(item.symbol || '-')} · ${escapeHtml(item.type || 'review')}</strong>
            <div class="muted">${escapeHtml(textOf(item.rationale, 'No rationale returned.'))}</div>
          </div>
          <span class="ai-trade-badge">${escapeHtml(item.recommendation || 'hold')}</span>
        </div>
        <div class="ai-trade-grid">
          <div><span>Qty</span><b>${escapeHtml(textOf(item.quantity, '0'))}</b></div>
          <div><span>Mark</span><b>${escapeHtml(textOf(item.mark_price, '-'))}</b></div>
          <div><span>PnL %</span><b>${escapeHtml(textOf(item.unrealized_pnl_pct, '-'))}</b></div>
          <div><span>Order age</span><b>${escapeHtml(textOf(item.age_minutes, '-'))}</b></div>
          <div><span>Trend</span><b>${escapeHtml(textOf(item.trend_alignment, 'unknown'))}</b></div>
          <div><span>Warnings</span><b>${escapeHtml(textOf(item.warnings, 'none'))}</b></div>
        </div>
        <p class="workflow-note">Advisory lifecycle review only. No paper order action is submitted automatically.</p>
      </div>`).join('');
  }

  function renderLifecycle(payload) {
    const target = $('aiPaperLifecycleResult');
    if (!target) return;
    const lifecycle = payload?.lifecycle || payload || {};
    const summary = lifecycle.summary || {};
    target.innerHTML = `
      <div class="ai-paper-trader-card ${summary.requires_attention ? 'blocked' : 'executable'}">
        <div class="ai-trade-card-header">
          <div>
            <div class="label">AI paper lifecycle review</div>
            <strong>${summary.requires_attention ? 'Attention recommended' : 'No lifecycle warnings'}</strong>
            <div class="muted">Advisory only · paper_only=${escapeHtml(textOf(lifecycle.paper_only, 'true'))} · live_execution=${escapeHtml(textOf(lifecycle.live_execution, 'false'))}</div>
          </div>
          <span class="ai-trade-badge">${summary.requires_attention ? 'review' : 'hold'}</span>
        </div>
        <div class="ai-trade-grid">
          <div><span>Positions</span><b>${escapeHtml(textOf(summary.position_count, '0'))}</b></div>
          <div><span>Open orders</span><b>${escapeHtml(textOf(summary.open_order_count, '0'))}</b></div>
          <div><span>Warnings</span><b>${escapeHtml(textOf(summary.warnings, 'none'))}</b></div>
          <div><span>Background loop</span><b>${escapeHtml(textOf(lifecycle.background_loop_enabled, 'false'))}</b></div>
        </div>
        <div class="ai-trade-section"><b>Position reviews</b>${renderReviewList(lifecycle.position_reviews, 'No simulated paper positions to review.')}</div>
        <div class="ai-trade-section"><b>Open order reviews</b>${renderReviewList(lifecycle.order_reviews, 'No open simulated paper orders to review.')}</div>
      </div>`;
  }

  async function runAiPaperLifecycleReview() {
    setStatus('Running advisory AI paper lifecycle review...');
    const payload = {
      market_context: parseMarketContext(),
      risk: buildLifecycleRisk(),
      marks: parseMarks(),
    };
    const response = await postJson('/api/ai/paper-trader/lifecycle', payload);
    state.lastLifecycle = response;
    renderLifecycle(response);
    printPaper({ ai_paper_lifecycle_review: response, paper_only: true, live_execution: false, execution_submitted: false });
    setStatus('Lifecycle review complete. Advisory only; no paper order action submitted.');
    return response;
  }

  function showError(error) {
    const message = error && error.message ? error.message : String(error);
    setStatus(message);
    if (typeof window.print === 'function') window.print(message);
  }

  function ensurePanel() {
    if ($('aiPaperLifecyclePanel')) return;
    const paperStatus = $('paperTradingStatus');
    if (!paperStatus || !paperStatus.parentElement) return;
    const panel = document.createElement('div');
    panel.id = 'aiPaperLifecyclePanel';
    panel.className = 'ai-paper-lifecycle-panel';
    panel.innerHTML = `
      <div class="label">AI paper lifecycle</div>
      <p class="paper-trading-warning">Lifecycle reviews are advisory only. They do not submit, fill, cancel, or live-execute orders.</p>
      <div class="paper-order-grid" aria-label="AI paper lifecycle settings">
        <input id="aiPaperLifecycleMarks" placeholder="marks e.g. AAPL:192,NVDA:120" />
        <input id="aiPaperLifecycleMaxLossPct" placeholder="max loss review %" value="5" />
        <input id="aiPaperLifecycleTakeProfitPct" placeholder="take profit review %" value="8" />
        <input id="aiPaperLifecycleStaleMinutes" placeholder="stale order minutes" value="60" />
        <input id="aiPaperLifecycleMaxPositionValue" placeholder="max position value optional" value="0" />
        <textarea id="aiPaperLifecycleMarketContext" class="paper-notes-input" placeholder='optional market context JSON, e.g. {"symbol":"AAPL","summary":{"latest_close":190,"trend_alignment":"bullish_aligned"}}'></textarea>
        <button type="button" class="secondary" data-action="aiPaperLifecycle.review">Run lifecycle review</button>
      </div>
      <div id="aiPaperLifecycleStatus" class="module-control-status">Lifecycle monitor ready. Advisory only; no automatic execution.</div>
      <div id="aiPaperLifecycleResult" class="ai-paper-lifecycle-result"></div>
    `;
    paperStatus.parentElement.appendChild(panel);
    if (typeof window.bindWorkstationActions === 'function') window.bindWorkstationActions(panel);
  }

  function bootAiPaperLifecycle() {
    ensurePanel();
  }

  window.runAiPaperLifecycleReview = runAiPaperLifecycleReview;
  window.renderAiPaperLifecycleReview = renderLifecycle;

  if (window.workstationBoot) window.workstationBoot.register('ai-paper-lifecycle', bootAiPaperLifecycle);
  else if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bootAiPaperLifecycle);
  else bootAiPaperLifecycle();
})();
