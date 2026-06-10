(function() {
  const RISK_ALLOWED = new Set(['acceptable', 'too_risky', 'unclear', 'reject']);
  const state = {
    originalSubmit: null,
    lastFingerprint: '',
    lastReview: null,
    acknowledged: false,
    installing: false,
  };

  function $(id) {
    return document.getElementById(id);
  }

  function text(id, fallback = '') {
    const element = $(id);
    return ((element && element.value) || fallback || '').trim();
  }

  function numeric(id) {
    const value = parseFloat(text(id));
    return Number.isFinite(value) ? value : null;
  }

  function activeSymbol() {
    return text('symbol').toUpperCase();
  }

  function activeAssetType() {
    const asset = text('asset', 'auto').toLowerCase();
    const symbol = activeSymbol();
    if (asset === 'crypto' || symbol.endsWith('USDT') || symbol.endsWith('-USD')) return 'crypto';
    if (asset === 'stock' || asset === 'auto') return 'stock';
    return 'other';
  }

  function activeExchange() {
    return text('exchange', activeAssetType() === 'crypto' ? 'BINANCE' : 'NASDAQ').toUpperCase();
  }

  function activeTimeframe() {
    return text('timeframe', '1d');
  }

  function setStatus(message) {
    const target = $('aiPaperRiskStatus') || $('paperTradingStatus');
    if (target) target.textContent = message;
  }

  function printPaper(value) {
    if (typeof window.setResultPane === 'function') window.setResultPane('paper', value);
    else if (typeof window.print === 'function') window.print(value);
  }

  function ticketSnapshot() {
    return {
      symbol: activeSymbol(),
      asset_type: activeAssetType(),
      exchange: activeExchange(),
      timeframe: activeTimeframe(),
      side: text('paperSide', 'buy').toLowerCase(),
      order_type: text('paperOrderType', 'market').toLowerCase(),
      quantity: numeric('paperQuantity'),
      limit_price: numeric('paperLimitPrice'),
      stop_price: numeric('paperStopPrice'),
      fill_price: numeric('paperFillPrice'),
      mark_price: numeric('paperMarkPrice'),
      idea_id: text('paperIdeaId'),
      notes: text('paperNotes'),
    };
  }

  function accountSnapshot() {
    const account = window.paperTradingState?.account || window.paperState?.account || null;
    return account || null;
  }

  function chartSnapshot() {
    if (typeof window.getPrimaryChartContext === 'function') {
      try { return window.getPrimaryChartContext(); } catch (_error) { return null; }
    }
    return null;
  }

  function stableFingerprint(value) {
    return JSON.stringify(value, Object.keys(value).sort());
  }

  function normalizeList(value) {
    if (Array.isArray(value)) return value.map((item) => String(item || '').trim()).filter(Boolean);
    if (typeof value === 'string' && value.trim()) return value.split(/\n|;/).map((item) => item.trim()).filter(Boolean);
    return [];
  }

  function normalizeVerdict(value) {
    const verdict = String(value || '').toLowerCase().replace(/[^a-z_]/g, '_');
    if (RISK_ALLOWED.has(verdict)) return verdict;
    if (verdict.includes('reject')) return 'reject';
    if (verdict.includes('risky') || verdict.includes('danger')) return 'too_risky';
    if (verdict.includes('acceptable') || verdict.includes('ok')) return 'acceptable';
    return 'unclear';
  }

  function parseMaybeJson(payload) {
    if (!payload) return {};
    if (payload.risk_verdict || payload.recommended_changes) return payload;
    const content = payload.content || payload.analysis || payload.summary || '';
    if (typeof content !== 'string') return {};
    const match = content.match(/\{[\s\S]*\}/);
    if (!match) return { summary: content.slice(0, 700) };
    try { return JSON.parse(match[0]); } catch (_error) { return { summary: content.slice(0, 700) }; }
  }

  function normalizeRiskReview(raw, ticket) {
    const parsed = parseMaybeJson(raw);
    return {
      risk_verdict: normalizeVerdict(parsed.risk_verdict || parsed.verdict),
      summary: String(parsed.summary || parsed.reason || 'AI risk review returned limited detail. Review order size, invalidation, and idea alignment before submitting the simulated order.').trim(),
      idea_alignment: String(parsed.idea_alignment || parsed.alignment || 'Unclear from available context.').trim(),
      position_size_warning: String(parsed.position_size_warning || parsed.sizing_warning || '').trim(),
      stop_loss_warning: String(parsed.stop_loss_warning || parsed.invalidation_warning || '').trim(),
      recommended_changes: normalizeList(parsed.recommended_changes || parsed.next_steps || parsed.suggestions),
      risks: normalizeList(parsed.risks || parsed.key_risks),
      paper_trade_candidate: parsed.paper_trade_candidate === true && ticket.side !== 'no_trade',
      not_financial_advice: true,
      simulated_only: true,
      live_execution: false,
      raw: raw || parsed,
    };
  }

  function localPreflight(ticket) {
    const warnings = [];
    if (!ticket.symbol) warnings.push('Missing symbol.');
    if (!ticket.quantity || ticket.quantity <= 0) warnings.push('Missing positive quantity.');
    if (ticket.order_type === 'limit' && !ticket.limit_price) warnings.push('Limit order is missing a positive limit price.');
    if (ticket.order_type === 'stop' && !ticket.stop_price) warnings.push('Stop order is missing a positive stop price.');
    if (!ticket.idea_id && !ticket.notes) warnings.push('No linked idea or notes; alignment is hard to review.');
    return warnings;
  }

  function buildRiskPrompt(ticket, chart, account, preflight) {
    return [
      'Review this proposed SIMULATED PAPER TRADE before submission.',
      'Return strict JSON only. Do not include markdown.',
      'Allowed risk_verdict values: acceptable, too_risky, unclear, reject.',
      'Reject or mark unclear if sizing, invalidation, stop, or idea alignment is not reviewable.',
      'Do not provide financial advice; this is research-only paper simulation and no live broker order will be submitted.',
      'Required schema: {"risk_verdict":"acceptable|too_risky|unclear|reject","summary":"...","idea_alignment":"...","position_size_warning":"...","stop_loss_warning":"...","risks":["..."],"recommended_changes":["..."],"paper_trade_candidate":true|false,"not_financial_advice":true}',
      `Paper order ticket JSON: ${JSON.stringify(ticket)}`,
      `Local preflight warnings: ${JSON.stringify(preflight)}`,
      `Paper account snapshot JSON: ${JSON.stringify(account || {})}`,
      `Visible chart context JSON: ${JSON.stringify(chart || {})}`,
    ].join('\n');
  }

  async function postJson(url, body) {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload.error) {
      const message = payload?.error?.message || payload?.detail?.message || `${response.status} ${response.statusText}`;
      throw new Error(message);
    }
    return payload;
  }

  async function requestAiRiskReview(ticket) {
    const chart = chartSnapshot();
    const account = accountSnapshot();
    const preflight = localPreflight(ticket);
    if (preflight.length) {
      return normalizeRiskReview({
        risk_verdict: 'unclear',
        summary: 'Local preflight found issues that must be reviewed before paper submission.',
        risks: preflight,
        recommended_changes: preflight,
        paper_trade_candidate: false,
      }, ticket);
    }
    const prompt = buildRiskPrompt(ticket, chart, account, preflight);
    const payload = {
      symbol: ticket.symbol,
      asset_type: ticket.asset_type,
      exchange: ticket.exchange,
      timeframe: ticket.timeframe,
      question: prompt,
    };
    const raw = await postJson('/api/ai/analyze', payload);
    return normalizeRiskReview(raw, ticket);
  }

  function ensureStyles() {
    if ($('aiPaperRiskStyles')) return;
    const style = document.createElement('style');
    style.id = 'aiPaperRiskStyles';
    style.textContent = `
.ai-paper-risk-panel{margin-top:8px;padding:8px;border:1px solid #334155;border-radius:10px;background:#0b1220;color:#cbd5e1;font-size:12px;display:grid;gap:7px}
.ai-paper-risk-panel strong{color:#f8fafc}
.ai-paper-risk-verdict{display:inline-flex;align-items:center;gap:6px;width:max-content;padding:3px 7px;border-radius:999px;border:1px solid #475569;background:#111827;color:#e5e7eb;font-size:11px;text-transform:uppercase;letter-spacing:.06em}
.ai-paper-risk-verdict.acceptable{border-color:#22c55e;color:#bbf7d0}.ai-paper-risk-verdict.too_risky,.ai-paper-risk-verdict.reject{border-color:#ef4444;color:#fecaca}.ai-paper-risk-verdict.unclear{border-color:#f59e0b;color:#fde68a}
.ai-paper-risk-actions{display:flex;flex-wrap:wrap;gap:6px}.ai-paper-risk-actions button{font-size:12px;padding:5px 8px}.ai-paper-risk-ack{display:flex;gap:6px;align-items:flex-start;color:#f8fafc}.ai-paper-risk-ack input{margin-top:2px}.ai-paper-risk-list{margin:0;padding-left:18px;color:#cbd5e1}.ai-paper-risk-status{color:#94a3b8;font-size:11px}
`;
    document.head.appendChild(style);
  }

  function ensurePanel() {
    ensureStyles();
    if ($('aiPaperRiskPanel')) return $('aiPaperRiskPanel');
    const status = $('paperTradingStatus');
    const anchor = status?.parentElement || $('paperTradingPanel') || status;
    const panel = document.createElement('div');
    panel.id = 'aiPaperRiskPanel';
    panel.className = 'ai-paper-risk-panel';
    panel.innerHTML = `
      <div><strong>AI paper risk review</strong></div>
      <div class="ai-paper-risk-status" id="aiPaperRiskStatus">Run AI review before submitting simulated paper orders.</div>
      <div id="aiPaperRiskReviewBody"></div>
      <label class="ai-paper-risk-ack"><input type="checkbox" id="aiPaperRiskAck"> <span>I reviewed this risk check and understand this is simulated paper trading only; no live broker order will be submitted.</span></label>
      <div class="ai-paper-risk-actions">
        <button type="button" data-action="paper.riskReview">Run AI risk review</button>
        <button type="button" data-action="paper.submitReviewed">Submit reviewed paper order</button>
      </div>
    `;
    if (anchor && anchor.parentElement) anchor.parentElement.insertBefore(panel, anchor.nextSibling);
    else document.body.appendChild(panel);
    const ack = $('aiPaperRiskAck');
    if (ack) ack.addEventListener('change', () => { state.acknowledged = Boolean(ack.checked); });
    return panel;
  }

  function renderRiskReview(review) {
    ensurePanel();
    const target = $('aiPaperRiskReviewBody');
    if (!target) return;
    const risks = normalizeList(review.risks);
    const changes = normalizeList(review.recommended_changes);
    target.innerHTML = `
      <span class="ai-paper-risk-verdict ${review.risk_verdict}">${review.risk_verdict.replace('_', ' ')}</span>
      <div>${escapeHtml(review.summary)}</div>
      <div><strong>Idea alignment:</strong> ${escapeHtml(review.idea_alignment || 'Unclear')}</div>
      ${review.position_size_warning ? `<div><strong>Size:</strong> ${escapeHtml(review.position_size_warning)}</div>` : ''}
      ${review.stop_loss_warning ? `<div><strong>Invalidation/stop:</strong> ${escapeHtml(review.stop_loss_warning)}</div>` : ''}
      ${risks.length ? `<div><strong>Risks:</strong><ul class="ai-paper-risk-list">${risks.map((risk) => `<li>${escapeHtml(risk)}</li>`).join('')}</ul></div>` : ''}
      ${changes.length ? `<div><strong>Recommended changes:</strong><ul class="ai-paper-risk-list">${changes.map((change) => `<li>${escapeHtml(change)}</li>`).join('')}</ul></div>` : ''}
    `;
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  }

  async function runPaperRiskReview() {
    const ticket = ticketSnapshot();
    const fingerprint = stableFingerprint(ticket);
    state.acknowledged = false;
    if ($('aiPaperRiskAck')) $('aiPaperRiskAck').checked = false;
    setStatus('Running AI paper risk review...');
    try {
      const review = await requestAiRiskReview(ticket);
      state.lastFingerprint = fingerprint;
      state.lastReview = review;
      renderRiskReview(review);
      setStatus(`AI paper risk review complete: ${review.risk_verdict.replace('_', ' ')}.`);
      printPaper({ ai_paper_risk_review: review, ticket, simulated: true, live_execution: false });
      return review;
    } catch (error) {
      const review = normalizeRiskReview({
        risk_verdict: 'unclear',
        summary: `AI risk review unavailable: ${error.message || error}. Manual review is required before simulated submission.`,
        risks: ['AI risk review endpoint unavailable or returned an error.'],
        recommended_changes: ['Review order size, invalidation, risk/reward, and idea alignment manually.'],
        paper_trade_candidate: false,
      }, ticket);
      state.lastFingerprint = fingerprint;
      state.lastReview = review;
      renderRiskReview(review);
      setStatus('AI paper risk review unavailable; manual review required.');
      printPaper({ ai_paper_risk_review: review, ticket, simulated: true, live_execution: false });
      return review;
    }
  }

  function canSubmitWithReview(ticket) {
    const fingerprint = stableFingerprint(ticket);
    if (!state.lastReview || state.lastFingerprint !== fingerprint) return false;
    if (!state.acknowledged) return false;
    if (state.lastReview.risk_verdict === 'reject') return false;
    return true;
  }

  async function submitReviewedPaperOrder() {
    const ticket = ticketSnapshot();
    ensurePanel();
    if (!canSubmitWithReview(ticket)) {
      if (!state.lastReview || state.lastFingerprint !== stableFingerprint(ticket)) {
        await runPaperRiskReview();
      }
      setStatus('Review the AI risk check and acknowledge it before submitting the simulated paper order.');
      return { blocked: true, reason: 'risk_review_required', simulated: true, live_execution: false };
    }
    if (state.lastReview?.risk_verdict === 'too_risky') {
      const proceed = window.confirm('AI marked this simulated paper trade as too risky. Submit the paper order anyway?');
      if (!proceed) return { blocked: true, reason: 'too_risky_cancelled', simulated: true, live_execution: false };
    }
    return state.originalSubmit();
  }

  function wrapPaperSubmit() {
    if (state.installing || window.submitPaperOrder?.__aiPaperRiskWrapped) return;
    if (typeof window.submitPaperOrder !== 'function') return;
    state.installing = true;
    state.originalSubmit = window.submitPaperOrder;
    const wrapped = function() { return submitReviewedPaperOrder(); };
    wrapped.__aiPaperRiskWrapped = true;
    window.submitPaperOrder = wrapped;
    state.installing = false;
  }

  function initializeAiPaperRiskReview() {
    ensurePanel();
    wrapPaperSubmit();
  }

  window.reviewPaperOrderRisk = runPaperRiskReview;
  window.submitReviewedPaperOrder = submitReviewedPaperOrder;

  if (window.workstationBoot) window.workstationBoot.register('ai-paper-risk', initializeAiPaperRiskReview);
  else if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initializeAiPaperRiskReview);
  else initializeAiPaperRiskReview();
})();
