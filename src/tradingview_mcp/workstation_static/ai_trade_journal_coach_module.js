(function() {
  const coachState = {
    lastReview: null,
    lastContext: null,
  };

  function $(id) {
    return document.getElementById(id);
  }

  function textOf(value, fallback = '-') {
    if (value === null || value === undefined || value === '') return fallback;
    if (Array.isArray(value)) return value.length ? value.join('\n') : fallback;
    if (typeof value === 'object') return JSON.stringify(value, null, 2);
    return String(value);
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function safeJsonParse(content) {
    if (!content || typeof content !== 'string') return null;
    let cleaned = content.trim();
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim();
    }
    try { return JSON.parse(cleaned); } catch (_) { return null; }
  }

  function normalizeList(value) {
    if (Array.isArray(value)) return value.map((item) => textOf(item, '')).filter(Boolean);
    if (value === null || value === undefined || value === '') return [];
    return [textOf(value, '')].filter(Boolean);
  }

  function listItems(values) {
    const items = normalizeList(values);
    return items.length
      ? `<ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`
      : '<p class="muted">None returned.</p>';
  }

  function setCoachStatus(message) {
    const status = $('aiJournalCoachStatus');
    if (status) status.textContent = message;
  }

  function printJournal(value) {
    if (typeof window.setResultPane === 'function') window.setResultPane('journal', value);
    else if (typeof window.print === 'function') window.print(value);
  }

  async function ensurePaperSnapshot() {
    if (window.paperTradingState?.account && Array.isArray(window.paperTradingState?.orders) && Array.isArray(window.paperTradingState?.fills)) {
      return window.paperTradingState;
    }
    if (typeof window.refreshPaperTrading === 'function') {
      return window.refreshPaperTrading();
    }
    return { account: null, orders: [], fills: [] };
  }

  function newestByTime(items) {
    return [...(items || [])].sort((a, b) => {
      const at = Date.parse(a.filled_at || a.updated_at || a.created_at || a.timestamp || '') || 0;
      const bt = Date.parse(b.filled_at || b.updated_at || b.created_at || b.timestamp || '') || 0;
      return bt - at;
    })[0] || null;
  }

  function matchingOrder(orderId, orders) {
    if (!orderId) return null;
    return (orders || []).find((order) => String(order.id || order.order_id || '') === String(orderId)) || null;
  }

  function matchingFill(orderId, fills) {
    if (!orderId) return null;
    return (fills || []).find((fill) => String(fill.order_id || fill.id || '') === String(orderId)) || null;
  }

  async function collectJournalContext(options = {}) {
    const paperState = await ensurePaperSnapshot();
    const selectedOrderId = ($('paperOrderId')?.value || '').trim();
    const orders = paperState.orders || [];
    const fills = paperState.fills || [];
    const selectedOrder = matchingOrder(selectedOrderId, orders);
    const selectedFill = matchingFill(selectedOrderId, fills);
    const latestFill = newestByTime(fills);
    const latestOrder = newestByTime(orders);
    const reviewedFill = options.selectedOnly ? selectedFill : (selectedFill || latestFill);
    const reviewedOrder = options.selectedOnly ? selectedOrder : (selectedOrder || matchingOrder(reviewedFill?.order_id, orders) || latestOrder);
    if (!reviewedFill && !reviewedOrder) {
      throw new Error('No paper orders or fills found. Submit/fill a simulated paper order before running the journal coach.');
    }
    const chartContext = typeof window.getPrimaryChartContext === 'function'
      ? window.getPrimaryChartContext()
      : {
          symbol: $('symbol')?.value,
          asset_type: $('asset')?.value,
          exchange: $('exchange')?.value,
          timeframe: $('tf')?.value,
        };
    return {
      reviewed_order: reviewedOrder,
      reviewed_fill: reviewedFill,
      selected_order_id: selectedOrderId || null,
      paper_account: paperState.account || null,
      recent_orders: orders.slice(0, 10),
      recent_fills: fills.slice(0, 10),
      chart_context: chartContext,
      linked_idea_id: reviewedOrder?.idea_id || $('paperIdeaId')?.value || $('ideaId')?.value || null,
      research_only: true,
      live_execution: false,
      review_scope: options.selectedOnly ? 'selected_order' : 'latest_paper_activity',
    };
  }

  function journalCoachPrompt(context) {
    return [
      'You are an AI trade journal coach for a simulated paper trading workstation.',
      'Review the paper order/fill context and produce a coaching journal entry. This is research-only and not financial advice.',
      'Do not encourage live trading. Focus on process quality, plan adherence, risk management, and what to improve next.',
      'Return only valid JSON with keys: review_verdict, journal_summary, plan_adherence, entry_quality, exit_quality, risk_management, what_went_well, what_to_improve, mistake_patterns, next_rules, tags, not_financial_advice.',
      'Allowed review_verdict values: followed_plan, needs_review, rule_violation, insufficient_context.',
      'Use insufficient_context if there is no fill, unclear invalidation, no linked idea, or not enough chart/order context.',
      `Paper trade context:\n${JSON.stringify(context, null, 2)}`,
    ].join('\n\n');
  }

  function normalizeReview(payload) {
    const source = payload && typeof payload === 'object' ? payload : {};
    const verdict = String(source.review_verdict || source.verdict || 'insufficient_context').toLowerCase();
    const allowed = ['followed_plan', 'needs_review', 'rule_violation', 'insufficient_context'];
    return {
      review_verdict: allowed.includes(verdict) ? verdict : 'insufficient_context',
      journal_summary: textOf(source.journal_summary || source.summary, 'No journal summary returned.'),
      plan_adherence: textOf(source.plan_adherence, 'Insufficient context.'),
      entry_quality: textOf(source.entry_quality, 'Insufficient context.'),
      exit_quality: textOf(source.exit_quality, 'Insufficient context.'),
      risk_management: textOf(source.risk_management, 'Insufficient context.'),
      what_went_well: normalizeList(source.what_went_well),
      what_to_improve: normalizeList(source.what_to_improve || source.improvements),
      mistake_patterns: normalizeList(source.mistake_patterns),
      next_rules: normalizeList(source.next_rules || source.next_steps),
      tags: normalizeList(source.tags),
      not_financial_advice: source.not_financial_advice !== false,
    };
  }

  async function callJournalCoach(context) {
    const payload = {
      symbol: context.chart_context?.symbol || $('symbol')?.value || '',
      asset_type: context.chart_context?.asset_type || $('asset')?.value || 'auto',
      exchange: context.chart_context?.exchange || $('exchange')?.value || '',
      timeframe: context.chart_context?.timeframe || $('tf')?.value || '1D',
      question: journalCoachPrompt(context),
    };
    const response = await post('/api/ai/analyze', payload);
    const parsed = safeJsonParse(response.analysis?.content || '')
      || response.structured_analysis?.raw
      || response.structured_analysis?.parsed
      || response.structured_analysis
      || response;
    return { response, parsed: normalizeReview(parsed) };
  }

  function renderReviewCard(review, context) {
    const container = ensureCoachCard();
    const order = context.reviewed_order || {};
    const fill = context.reviewed_fill || {};
    container.innerHTML = `
      <div class="ai-journal-coach-card verdict-${escapeHtml(review.review_verdict)}">
        <div class="ai-journal-coach-header">
          <div>
            <div class="label">AI trade journal coach</div>
            <strong>${escapeHtml(order.symbol || context.chart_context?.symbol || 'Paper trade')}</strong>
            <div class="muted">Scope: ${escapeHtml(context.review_scope)} · Idea: ${escapeHtml(context.linked_idea_id || 'none')}</div>
          </div>
          <span class="ai-journal-coach-badge">${escapeHtml(review.review_verdict.replace(/_/g, ' '))}</span>
        </div>
        <div class="ai-journal-coach-grid">
          <div><span>Order</span><b>${escapeHtml(order.side || '-') } ${escapeHtml(order.order_type || '-') } ${escapeHtml(order.quantity || '-')}</b></div>
          <div><span>Fill</span><b>${escapeHtml(fill.fill_price || fill.price || 'not filled')}</b></div>
          <div><span>Plan adherence</span><b>${escapeHtml(review.plan_adherence)}</b></div>
          <div><span>Risk management</span><b>${escapeHtml(review.risk_management)}</b></div>
        </div>
        <div class="ai-journal-coach-section"><b>Journal summary</b><p>${escapeHtml(review.journal_summary)}</p></div>
        <div class="ai-journal-coach-section"><b>Entry quality</b><p>${escapeHtml(review.entry_quality)}</p></div>
        <div class="ai-journal-coach-section"><b>Exit quality</b><p>${escapeHtml(review.exit_quality)}</p></div>
        <div class="ai-journal-coach-section"><b>What went well</b>${listItems(review.what_went_well)}</div>
        <div class="ai-journal-coach-section"><b>What to improve</b>${listItems(review.what_to_improve)}</div>
        <div class="ai-journal-coach-section"><b>Mistake patterns</b>${listItems(review.mistake_patterns)}</div>
        <div class="ai-journal-coach-section"><b>Next rules</b>${listItems(review.next_rules)}</div>
        <div class="ai-journal-coach-actions">
          <button type="button" class="secondary" id="copyAiJournalCoachJson">Copy review JSON</button>
          <button type="button" class="secondary" id="printAiJournalCoachReview">Print to journal pane</button>
        </div>
        <p class="workflow-note">Simulated paper-trade coaching only. No live broker orders are submitted or recommended.</p>
      </div>
    `;
    $('copyAiJournalCoachJson')?.addEventListener('click', copyReviewJson);
    $('printAiJournalCoachReview')?.addEventListener('click', () => printJournal({ ai_trade_journal_review: review, context }));
    printJournal({ ai_trade_journal_review: review, context });
  }

  async function reviewLatestPaperTrade() {
    setCoachStatus('Generating AI journal review for latest simulated paper activity...');
    const context = await collectJournalContext({ selectedOnly: false });
    const result = await callJournalCoach(context);
    coachState.lastReview = result.parsed;
    coachState.lastContext = context;
    renderReviewCard(result.parsed, context);
    setCoachStatus('AI journal coach review generated. Review and copy/store manually as needed.');
    return result;
  }

  async function reviewSelectedPaperTrade() {
    setCoachStatus('Generating AI journal review for selected paper order...');
    const context = await collectJournalContext({ selectedOnly: true });
    const result = await callJournalCoach(context);
    coachState.lastReview = result.parsed;
    coachState.lastContext = context;
    renderReviewCard(result.parsed, context);
    setCoachStatus('Selected paper order review generated.');
    return result;
  }

  async function copyReviewJson() {
    if (!coachState.lastReview) throw new Error('Run an AI journal coach review first.');
    const text = JSON.stringify({ review: coachState.lastReview, context: coachState.lastContext }, null, 2);
    try {
      await navigator.clipboard.writeText(text);
      setCoachStatus('AI journal coach JSON copied.');
    } catch (_) {
      printJournal(text);
      setCoachStatus('Clipboard unavailable; review printed to journal pane.');
    }
  }

  function ensureCoachCard() {
    let container = $('aiJournalCoachCard');
    if (container) return container;
    container = document.createElement('div');
    container.id = 'aiJournalCoachCard';
    container.className = 'ai-journal-coach-card-shell';
    const panel = $('aiJournalCoachPanel') || $('paperTradingStatus')?.parentElement || document.querySelector('.analysis-results-panel');
    if (panel) panel.appendChild(container);
    else document.body.appendChild(container);
    return container;
  }

  function ensureCoachPanel() {
    if ($('aiJournalCoachPanel')) return;
    const status = $('paperTradingStatus');
    const panel = document.createElement('div');
    panel.id = 'aiJournalCoachPanel';
    panel.className = 'ai-journal-coach-panel';
    panel.innerHTML = `
      <div class="label">AI journal coach</div>
      <p class="workflow-note">Generate a post-trade process review from simulated paper orders/fills, chart context, and linked idea ID when available.</p>
      <div class="ai-journal-coach-actions">
        <button type="button" class="secondary" id="reviewLatestPaperTradeButton">Review latest paper trade</button>
        <button type="button" class="secondary" id="reviewSelectedPaperTradeButton">Review selected order</button>
      </div>
      <div id="aiJournalCoachStatus" class="module-control-status">AI journal coach is research-only and uses simulated paper activity.</div>
    `;
    if (status) status.insertAdjacentElement('afterend', panel);
    else document.querySelector('.right .panel')?.appendChild(panel);
    $('reviewLatestPaperTradeButton')?.addEventListener('click', () => reviewLatestPaperTrade().catch(showCoachError));
    $('reviewSelectedPaperTradeButton')?.addEventListener('click', () => reviewSelectedPaperTrade().catch(showCoachError));
  }

  function ensureCoachStyles() {
    if ($('aiJournalCoachStyles')) return;
    const style = document.createElement('style');
    style.id = 'aiJournalCoachStyles';
    style.textContent = '.ai-journal-coach-panel{margin-top:10px;border-top:1px solid #334155;padding-top:8px}.ai-journal-coach-card-shell{margin-top:8px}.ai-journal-coach-card{border:1px solid #334155;border-radius:10px;background:#0b1220;padding:10px;display:grid;gap:9px}.ai-journal-coach-card.verdict-rule_violation{border-color:#ef4444}.ai-journal-coach-card.verdict-needs_review,.ai-journal-coach-card.verdict-insufficient_context{border-color:#f59e0b}.ai-journal-coach-header{display:flex;justify-content:space-between;gap:8px;align-items:flex-start}.ai-journal-coach-badge{border:1px solid #334155;border-radius:999px;padding:4px 8px;background:#111827;color:#bfdbfe;text-transform:capitalize;font-size:12px}.ai-journal-coach-grid{display:grid;grid-template-columns:1fr 1fr;gap:6px}.ai-journal-coach-grid div{border:1px solid #1e293b;border-radius:8px;padding:6px;background:#080d18}.ai-journal-coach-grid span{display:block;color:#94a3b8;font-size:11px;text-transform:uppercase;letter-spacing:.05em}.ai-journal-coach-grid b{font-size:12px;white-space:pre-wrap}.ai-journal-coach-section{font-size:12px;line-height:1.45}.ai-journal-coach-section p{margin:4px 0}.ai-journal-coach-section ul{margin:5px 0 0 18px;padding:0}.ai-journal-coach-actions{display:flex;gap:6px;flex-wrap:wrap}.ai-journal-coach-actions button{font-size:12px;padding:5px 7px}@media(max-width:1200px){.ai-journal-coach-grid{grid-template-columns:1fr}}';
    document.head.appendChild(style);
  }

  function showCoachError(error) {
    const message = String(error && error.message ? error.message : error);
    setCoachStatus(message);
    printJournal(message);
  }

  function bootAiTradeJournalCoach() {
    if (window.workstationModuleGuard) {
      window.workstationModuleGuard.check('aiTradeJournalCoach', {
        globals: ['post', 'print'],
        selectors: ['#paperTradingStatus', '#symbol', '#asset', '#exchange', '#tf'],
      });
    }
    ensureCoachStyles();
    ensureCoachPanel();
  }

  window.aiTradeJournalCoachState = coachState;
  window.reviewLatestPaperTrade = reviewLatestPaperTrade;
  window.reviewSelectedPaperTrade = reviewSelectedPaperTrade;
  window.copyAiJournalCoachReview = copyReviewJson;

  if (window.workstationBoot) window.workstationBoot.register('ai-trade-journal-coach', bootAiTradeJournalCoach);
  else if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bootAiTradeJournalCoach);
  else bootAiTradeJournalCoach();
})();
