(function() {
  let lastBacktestReview = null;
  let originalBacktestTradeIdea = null;

  const VERDICT_LABELS = {
    supports: 'Supports idea',
    weakens: 'Weakens idea',
    needs_review: 'Needs review',
    no_trade: 'No trade / wait',
  };

  function $(id) { return document.getElementById(id); }

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
    if (cleaned.startsWith('```')) cleaned = cleaned.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
    try { return JSON.parse(cleaned); } catch (_) { return null; }
  }

  function normalizeList(value) {
    if (Array.isArray(value)) return value.map((item) => textOf(item, '')).filter(Boolean);
    if (value === null || value === undefined || value === '') return [];
    return [textOf(value, '')].filter(Boolean);
  }

  function listItems(values) {
    const items = normalizeList(values);
    return items.length ? `<ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>` : '<p class="muted">None provided.</p>';
  }

  function toNumber(value) {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string') {
      const cleaned = value.replace(/[%,$]/g, '').trim();
      if (cleaned !== '') {
        const parsed = Number(cleaned);
        if (Number.isFinite(parsed)) return parsed;
      }
    }
    return null;
  }

  function findMetric(value, aliases, depth = 0) {
    if (!value || typeof value !== 'object' || depth > 4) return null;
    for (const key of Object.keys(value)) {
      const normalized = key.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (aliases.includes(normalized)) {
        const number = toNumber(value[key]);
        if (number !== null) return number;
      }
    }
    for (const key of Object.keys(value)) {
      const child = value[key];
      if (child && typeof child === 'object') {
        const found = findMetric(child, aliases, depth + 1);
        if (found !== null) return found;
      }
    }
    return null;
  }

  function extractBacktestMetrics(result) {
    return {
      total_return: findMetric(result, ['totalreturn', 'totalreturnpct', 'returnpct', 'netreturn', 'netreturnpct', 'cumulative_return', 'cumulativereturn']),
      win_rate: findMetric(result, ['winrate', 'winratepct', 'percentprofitable']),
      max_drawdown: findMetric(result, ['maxdrawdown', 'maxdrawdownpct', 'drawdown']),
      trade_count: findMetric(result, ['tradecount', 'trades', 'numtrades', 'totaltrades']),
      profit_factor: findMetric(result, ['profitfactor']),
      sharpe: findMetric(result, ['sharpe', 'sharperatio']),
    };
  }

  function metricText(value, suffix = '') {
    return value === null || value === undefined ? 'n/a' : `${Number(value).toFixed(Math.abs(value) >= 100 ? 0 : 2)}${suffix}`;
  }

  function heuristicReview(result) {
    const metrics = extractBacktestMetrics(result);
    const totalReturn = metrics.total_return;
    const winRate = metrics.win_rate;
    const maxDrawdown = metrics.max_drawdown;
    const tradeCount = metrics.trade_count;
    const profitFactor = metrics.profit_factor;
    let score = 0;
    const evidence = [];
    const risks = [];

    if (tradeCount !== null && tradeCount < 3) {
      risks.push('Backtest produced too few trades to support a reliable conclusion.');
      score -= 2;
    } else if (tradeCount !== null) {
      evidence.push(`Backtest produced ${metricText(tradeCount)} trades.`);
      score += 1;
    }

    if (totalReturn !== null) {
      if (totalReturn > 0) { evidence.push(`Total return was positive (${metricText(totalReturn, '%')}).`); score += 2; }
      else { risks.push(`Total return was not positive (${metricText(totalReturn, '%')}).`); score -= 2; }
    }

    if (winRate !== null) {
      if (winRate >= 50) { evidence.push(`Win rate was at least 50% (${metricText(winRate, '%')}).`); score += 1; }
      else { risks.push(`Win rate was below 50% (${metricText(winRate, '%')}).`); score -= 1; }
    }

    if (profitFactor !== null) {
      if (profitFactor >= 1.1) { evidence.push(`Profit factor was above 1.1 (${metricText(profitFactor)}).`); score += 1; }
      else { risks.push(`Profit factor was weak (${metricText(profitFactor)}).`); score -= 1; }
    }

    if (maxDrawdown !== null) {
      const drawdownAbs = Math.abs(maxDrawdown);
      if (drawdownAbs <= 15) { evidence.push(`Maximum drawdown was controlled (${metricText(maxDrawdown, '%')}).`); score += 1; }
      else { risks.push(`Maximum drawdown was high (${metricText(maxDrawdown, '%')}).`); score -= 2; }
    }

    let verdict = 'needs_review';
    if (score >= 3) verdict = 'supports';
    if (score <= -2) verdict = 'weakens';
    if (tradeCount === 0) verdict = 'no_trade';

    return {
      verdict,
      summary: VERDICT_LABELS[verdict] || 'Needs review',
      evidence,
      risks,
      next_steps: [
        'Inspect trade log and equity curve before paper simulation.',
        'Compare against at least one baseline strategy or no-trade alternative.',
        'Keep this research-only; do not treat a single backtest as a live trading signal.',
      ],
      metrics,
      source: 'heuristic_backtest_review',
    };
  }

  function normalizeAiReview(raw, fallback) {
    const source = raw && typeof raw === 'object' ? raw : {};
    const verdict = ['supports', 'weakens', 'needs_review', 'no_trade'].includes(String(source.verdict || '').toLowerCase())
      ? String(source.verdict).toLowerCase()
      : fallback.verdict;
    return {
      verdict,
      summary: textOf(source.summary, fallback.summary),
      evidence: normalizeList(source.evidence).length ? normalizeList(source.evidence) : fallback.evidence,
      risks: normalizeList(source.risks).length ? normalizeList(source.risks) : fallback.risks,
      next_steps: normalizeList(source.next_steps).length ? normalizeList(source.next_steps) : fallback.next_steps,
      paper_trade_candidate: source.paper_trade_candidate === true || (source.paper_trade_candidate !== false && verdict === 'supports'),
      metrics: fallback.metrics,
      source: source.source || 'ai_backtest_review',
      raw: source,
    };
  }

  function reviewGateComplete() {
    const safety = document.getElementById('aiTradeReviewSafety');
    const invalidation = document.getElementById('aiTradeReviewInvalidation');
    const noLive = document.getElementById('aiTradeReviewNoLive');
    if (!safety && !invalidation && !noLive) return true;
    return !!(safety?.checked && invalidation?.checked && noLive?.checked);
  }

  function setStatus(message) {
    const status = document.getElementById('aiTradeWorkflowStatus') || document.getElementById('aiTradeIdeaStatus');
    if (status) status.textContent = message;
  }

  async function requestAiBacktestReview(backtestResult, fallback) {
    const context = typeof window.collectTradeIdeaContext === 'function' ? window.collectTradeIdeaContext() : {};
    const payload = {
      symbol: $('symbol')?.value || context.chart?.symbol || '',
      asset_type: $('asset')?.value || context.chart?.asset_type || 'auto',
      exchange: $('exchange')?.value || context.chart?.exchange || 'NASDAQ',
      timeframe: $('tf')?.value || context.chart?.timeframe || '1D',
      question: [
        'Review this backtest result against the current AI trade idea as research only.',
        'Return only valid JSON with keys: verdict, summary, evidence, risks, next_steps, paper_trade_candidate.',
        'Allowed verdict values: supports, weakens, needs_review, no_trade.',
        'Do not recommend live trading. Require paper simulation/backtest review before any simulated order.',
        `Trade/chart context:\n${JSON.stringify(context, null, 2)}`,
        `Heuristic review:\n${JSON.stringify(fallback, null, 2)}`,
        `Backtest result:\n${JSON.stringify(backtestResult, null, 2)}`,
      ].join('\n\n'),
    };
    const response = await post('/api/ai/analyze', payload);
    const parsed = safeJsonParse(response.analysis?.content || '') || response.structured_analysis?.raw || response.structured_analysis || null;
    return normalizeAiReview(parsed, fallback);
  }

  function ensureReviewContainer() {
    let container = document.getElementById('aiBacktestReviewCard');
    if (container) return container;
    const tradeCard = document.querySelector('#aiTradeIdeaCard .ai-trade-card');
    container = document.createElement('div');
    container.id = 'aiBacktestReviewCard';
    container.className = 'ai-backtest-review-card-shell';
    const actions = tradeCard?.querySelector('.ai-trade-actions');
    if (tradeCard && actions) tradeCard.insertBefore(container, actions);
    else if (tradeCard) tradeCard.appendChild(container);
    else document.querySelector('.analysis-results-panel')?.appendChild(container) || document.body.appendChild(container);
    return container;
  }

  function renderReviewCard(review, pending = false) {
    const container = ensureReviewContainer();
    const verdict = review.verdict || 'needs_review';
    container.innerHTML = `
      <div class="ai-backtest-review-card ${escapeHtml(verdict)}">
        <div class="ai-trade-card-header">
          <div>
            <div class="label">Backtest-aware AI review</div>
            <strong>${escapeHtml(VERDICT_LABELS[verdict] || 'Needs review')}</strong>
          </div>
          <span class="ai-trade-badge">${pending ? 'Reviewing…' : escapeHtml(verdict.replace(/_/g, ' '))}</span>
        </div>
        <p>${escapeHtml(textOf(review.summary, 'Review pending.'))}</p>
        <div class="ai-backtest-metrics">
          <div><span>Return</span><b>${escapeHtml(metricText(review.metrics?.total_return, '%'))}</b></div>
          <div><span>Win rate</span><b>${escapeHtml(metricText(review.metrics?.win_rate, '%'))}</b></div>
          <div><span>Drawdown</span><b>${escapeHtml(metricText(review.metrics?.max_drawdown, '%'))}</b></div>
          <div><span>Trades</span><b>${escapeHtml(metricText(review.metrics?.trade_count))}</b></div>
          <div><span>Profit factor</span><b>${escapeHtml(metricText(review.metrics?.profit_factor))}</b></div>
          <div><span>Sharpe</span><b>${escapeHtml(metricText(review.metrics?.sharpe))}</b></div>
        </div>
        <div class="ai-trade-section"><b>Evidence</b>${listItems(review.evidence)}</div>
        <div class="ai-trade-section"><b>Risks</b>${listItems(review.risks)}</div>
        <div class="ai-trade-section"><b>Next steps</b>${listItems(review.next_steps)}</div>
        <p class="workflow-note">Backtest review is research-only. It can support or weaken a paper-trade candidate, but it is not a live trade recommendation.</p>
      </div>
    `;
  }

  async function backtestTradeIdeaWithAiReview() {
    if (!reviewGateComplete()) {
      setStatus('Complete the AI trade review checklist before running backtest-aware review.');
      return null;
    }
    if (typeof originalBacktestTradeIdea !== 'function') throw new Error('AI trade backtest action is unavailable.');
    setStatus('Running backtest and preparing AI review...');
    const backtestResult = await originalBacktestTradeIdea();
    const heuristic = heuristicReview(backtestResult);
    renderReviewCard(heuristic, true);
    let review = heuristic;
    try {
      review = await requestAiBacktestReview(backtestResult, heuristic);
    } catch (error) {
      review = { ...heuristic, summary: `${heuristic.summary}. AI review unavailable; showing heuristic review.`, ai_error: String(error && error.message ? error.message : error) };
    }
    lastBacktestReview = { review, backtest_result: backtestResult };
    renderReviewCard(review, false);
    print({ ai_backtest_review: review, backtest_result: backtestResult }, 'backtests');
    setStatus(`${VERDICT_LABELS[review.verdict] || 'Needs review'} after backtest review. Review details before paper simulation.`);
    return lastBacktestReview;
  }

  function addBacktestReviewButton() {
    const actions = document.querySelector('#aiTradeIdeaCard .ai-trade-actions');
    if (!actions || document.getElementById('backtestAiTradeIdeaReviewButton')) return;
    const button = document.createElement('button');
    button.id = 'backtestAiTradeIdeaReviewButton';
    button.type = 'button';
    button.className = 'secondary';
    button.textContent = 'Backtest + AI review';
    button.addEventListener('click', () => backtestTradeIdeaWithAiReview().catch((error) => {
      setStatus(String(error && error.message ? error.message : error));
      print(String(error && error.message ? error.message : error), 'analysis');
    }));
    const plainBacktestButton = document.getElementById('backtestAiTradeIdeaButton');
    if (plainBacktestButton) plainBacktestButton.insertAdjacentElement('afterend', button);
    else actions.appendChild(button);
  }

  function patchTradeIdeaRenderer() {
    if (window.__aiBacktestReviewRendererPatched) return true;
    if (typeof window.renderTradeIdeaCard !== 'function') return false;
    const original = window.renderTradeIdeaCard;
    window.renderTradeIdeaCard = function patchedRenderTradeIdeaCard(...args) {
      const result = original.apply(this, args);
      window.setTimeout(addBacktestReviewButton, 0);
      return result;
    };
    window.__aiBacktestReviewRendererPatched = true;
    return true;
  }

  function captureOriginalBacktestAction() {
    if (typeof window.backtestTradeIdea === 'function' && !originalBacktestTradeIdea) {
      originalBacktestTradeIdea = window.backtestTradeIdea;
    }
    return !!originalBacktestTradeIdea;
  }

  function addStyles() {
    if (document.getElementById('aiBacktestReviewStyles')) return;
    const style = document.createElement('style');
    style.id = 'aiBacktestReviewStyles';
    style.textContent = '.ai-backtest-review-card-shell{margin:0}.ai-backtest-review-card{border:1px solid #334155;border-radius:10px;background:#080d18;padding:9px;display:grid;gap:8px}.ai-backtest-review-card.supports{border-color:#22c55e}.ai-backtest-review-card.weakens,.ai-backtest-review-card.no_trade{border-color:#ef4444}.ai-backtest-review-card.needs_review{border-color:#f59e0b}.ai-backtest-review-card p{margin:0;font-size:12px;line-height:1.45}.ai-backtest-metrics{display:grid;grid-template-columns:1fr 1fr 1fr;gap:5px}.ai-backtest-metrics div{border:1px solid #1e293b;border-radius:8px;padding:5px;background:#0b1220}.ai-backtest-metrics span{display:block;color:#94a3b8;font-size:10px;text-transform:uppercase;letter-spacing:.05em}.ai-backtest-metrics b{font-size:12px}@media(max-width:1200px){.ai-backtest-metrics{grid-template-columns:1fr 1fr}}';
    document.head.appendChild(style);
  }

  function bootAiBacktestReviewModule() {
    addStyles();
    captureOriginalBacktestAction();
    if (!patchTradeIdeaRenderer() || !captureOriginalBacktestAction()) {
      let attempts = 0;
      const timer = window.setInterval(() => {
        attempts += 1;
        const ready = patchTradeIdeaRenderer() && captureOriginalBacktestAction();
        if (ready) addBacktestReviewButton();
        if (ready || attempts > 50) window.clearInterval(timer);
      }, 100);
    }
    addBacktestReviewButton();
  }

  window.backtestTradeIdeaWithAiReview = backtestTradeIdeaWithAiReview;
  window.renderAiBacktestReviewCard = renderReviewCard;
  window.lastAiBacktestReview = () => lastBacktestReview;

  if (window.workstationBoot) window.workstationBoot.register('ai-backtest-review', bootAiBacktestReviewModule);
  else if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bootAiBacktestReviewModule);
  else bootAiBacktestReviewModule();
})();
