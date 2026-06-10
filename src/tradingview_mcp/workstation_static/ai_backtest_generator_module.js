(function() {
  let lastIdea = null;
  let lastPlan = null;

  const STRATEGY_HINTS = {
    breakout: 'donchian',
    pullback: 'rsi_pullback',
    mean_reversion: 'bollinger',
    reversal: 'rsi',
    momentum: 'macd',
    continuation: 'triple_ema',
    trend: 'ema_cross',
    no_trade: 'ema_cross',
  };

  const ALLOWED_STRATEGIES = ['ema_cross', 'rsi', 'bollinger', 'macd', 'supertrend', 'donchian', 'rsi_pullback', 'keltner_breakout', 'triple_ema'];
  const ALLOWED_PERIODS = ['1mo', '3mo', '6mo', '1y', '2y'];

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function textOf(value, fallback = '') {
    if (value === null || value === undefined || value === '') return fallback;
    if (Array.isArray(value)) return value.length ? value.join('\n') : fallback;
    if (typeof value === 'object') return JSON.stringify(value, null, 2);
    return String(value);
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

  function normalizeStrategy(value, setupType) {
    const raw = String(value || '').toLowerCase().trim();
    if (ALLOWED_STRATEGIES.includes(raw)) return raw;
    const setup = String(setupType || '').toLowerCase();
    const match = Object.entries(STRATEGY_HINTS).find(([keyword]) => setup.includes(keyword));
    return match ? match[1] : 'ema_cross';
  }

  function normalizePeriod(value) {
    const raw = String(value || '').toLowerCase().trim();
    return ALLOWED_PERIODS.includes(raw) ? raw : '1y';
  }

  function normalizeInterval(timeframe) {
    const value = String(timeframe || '').toLowerCase();
    if (value === '1d' || value === '1day') return '1d';
    if (value === '1w' || value === '1week') return '1wk';
    if (['1m', '5m', '15m', '30m', '60m', '1h'].includes(value)) return value === '1h' ? '60m' : value;
    return '1d';
  }

  function normalizePlan(raw) {
    const source = raw && typeof raw === 'object' ? raw : {};
    const idea = lastIdea?.parsed?.trade_idea || {};
    const setupType = source.setup_type || idea.setup_type || 'ai_trade_idea';
    return {
      strategy: normalizeStrategy(source.strategy, setupType),
      period: normalizePeriod(source.period),
      interval: normalizeInterval(source.interval || idea.timeframe || $('tf')?.value),
      setup_type: textOf(setupType, 'ai_trade_idea'),
      hypothesis: textOf(source.hypothesis || lastIdea?.parsed?.summary, 'Backtest whether the AI trade idea has historical support.'),
      entry_rules: normalizeList(source.entry_rules || source.entry_rule),
      exit_rules: normalizeList(source.exit_rules || source.exit_rule),
      invalidation_rules: normalizeList(source.invalidation_rules || source.stop_rules || idea.stop_or_invalidation),
      parameters: source.parameters && typeof source.parameters === 'object' ? source.parameters : {},
      success_criteria: normalizeList(source.success_criteria || ['Positive expectancy after costs', 'Acceptable drawdown for the setup', 'Enough trades to be meaningful']),
      caveats: normalizeList(source.caveats || source.risks),
      confidence: ['low', 'medium', 'high'].includes(String(source.confidence || '').toLowerCase()) ? String(source.confidence).toLowerCase() : 'low',
      no_live_orders: true,
      simulated_only: true,
    };
  }

  function buildFallbackPlan() {
    const idea = lastIdea?.parsed?.trade_idea || {};
    const parsed = lastIdea?.parsed || {};
    return normalizePlan({
      strategy: null,
      period: '1y',
      interval: idea.timeframe || $('tf')?.value,
      setup_type: idea.setup_type || 'ai_trade_idea',
      hypothesis: parsed.summary,
      entry_rules: [idea.entry_zone ? `Entry/confirmation zone: ${idea.entry_zone}` : 'Use the selected strategy entry trigger.'],
      exit_rules: normalizeList(idea.targets).concat(['Compare exits against invalidation/stop condition.']),
      invalidation_rules: [idea.stop_or_invalidation || parsed.invalidation || 'Review invalidation before using results.'],
      caveats: normalizeList(parsed.risks),
      confidence: parsed.confidence || 'low',
    });
  }

  function buildPrompt() {
    const context = typeof window.collectTradeIdeaContext === 'function' ? window.collectTradeIdeaContext() : {};
    return [
      'Convert this AI trade idea into a concrete, research-only backtest plan for the workstation.',
      'Return only valid JSON. Do not include prose outside JSON.',
      'Allowed strategy values: ema_cross, rsi, bollinger, macd, supertrend, donchian, rsi_pullback, keltner_breakout, triple_ema.',
      'Allowed period values: 1mo, 3mo, 6mo, 1y, 2y. Use 1y unless the setup clearly needs a different period.',
      'Include keys: strategy, period, interval, setup_type, hypothesis, entry_rules, exit_rules, invalidation_rules, parameters, success_criteria, caveats, confidence, no_live_orders, simulated_only.',
      'The workstation backtest engine may not support every parameter yet, so pick the closest supported strategy and put extra logic into parameters/caveats.',
      'This is research-only and must not recommend live trading.',
      `AI trade idea:\n${JSON.stringify(lastIdea?.parsed || {}, null, 2)}`,
      `Visible chart context:\n${JSON.stringify(context, null, 2)}`,
    ].join('\n\n');
  }

  async function generateBacktestPlan() {
    if (!lastIdea) throw new Error('Generate an AI trade idea first.');
    setStatus('Generating AI backtest plan...');
    const payload = {
      symbol: $('symbol')?.value,
      asset_type: $('asset')?.value,
      exchange: $('exchange')?.value,
      timeframe: $('tf')?.value,
      question: buildPrompt(),
    };
    try {
      const response = await post('/api/ai/analyze', payload);
      const parsed = safeJsonParse(response.analysis?.content || response.trade_idea?.content || '') || response.structured_analysis?.raw || response.structured_analysis || response;
      lastPlan = { response, plan: normalizePlan(parsed), source: 'ai' };
    } catch (error) {
      lastPlan = { response: { error: String(error && error.message ? error.message : error) }, plan: buildFallbackPlan(), source: 'fallback' };
    }
    renderPlanCard();
    setStatus(lastPlan.source === 'ai' ? 'AI backtest plan generated. Review before running.' : 'AI unavailable; generated fallback backtest plan from the trade idea.' );
    return lastPlan;
  }

  function applyBacktestPlan() {
    if (!lastPlan) throw new Error('Generate a backtest plan first.');
    const plan = lastPlan.plan;
    if ($('strategy')) $('strategy').value = plan.strategy;
    if ($('period')) $('period').value = plan.period;
    const planText = [
      `Strategy: ${plan.strategy}`,
      `Period: ${plan.period}`,
      `Hypothesis: ${plan.hypothesis}`,
      `Entry rules:\n${plan.entry_rules.join('\n')}`,
      `Exit rules:\n${plan.exit_rules.join('\n')}`,
      `Invalidation:\n${plan.invalidation_rules.join('\n')}`,
      `Parameters:\n${JSON.stringify(plan.parameters, null, 2)}`,
      `Success criteria:\n${plan.success_criteria.join('\n')}`,
      `Caveats:\n${plan.caveats.join('\n')}`,
    ].join('\n\n');
    if ($('backtestPlan')) $('backtestPlan').value = planText;
    setStatus(`Applied generated backtest plan: ${plan.strategy} / ${plan.period}.`);
  }

  async function runGeneratedBacktest() {
    if (!lastPlan) await generateBacktestPlan();
    applyBacktestPlan();
    const plan = lastPlan.plan;
    const payload = {
      symbol: ($('symbol')?.value || '').trim().toUpperCase(),
      strategy: plan.strategy,
      period: plan.period,
      initial_capital: 10000,
      commission_pct: 0.1,
      slippage_pct: 0.05,
      interval: plan.interval,
      include_trade_log: true,
      include_equity_curve: true,
      idea_id: $('ideaId')?.value || null,
      notes: `AI generated backtest plan: ${plan.hypothesis}`,
      metadata: {
        ai_backtest_plan: plan,
        ai_trade_idea: lastIdea?.parsed || null,
        no_live_orders: true,
        simulated_only: true,
      },
    };
    setStatus('Running generated backtest plan...');
    const result = await post('/api/backtest/run', payload);
    print({ ai_backtest_plan: plan, result }, 'backtests');
    setStatus('Generated backtest completed. Review metrics before any paper simulation.');
    return result;
  }

  function renderPlanCard() {
    const container = ensureContainer();
    const plan = lastPlan?.plan;
    if (!plan) return;
    container.innerHTML = `
      <div class="ai-backtest-generator-card">
        <div class="ai-trade-card-header">
          <div>
            <div class="label">AI backtest generator</div>
            <strong>${escapeHtml(plan.strategy)} · ${escapeHtml(plan.period)} · ${escapeHtml(plan.interval)}</strong>
            <div class="muted">Source: ${escapeHtml(lastPlan.source)} · confidence ${escapeHtml(plan.confidence)}</div>
          </div>
          <span class="ai-trade-badge">research-only</span>
        </div>
        <div class="ai-trade-section"><b>Hypothesis</b><p>${escapeHtml(plan.hypothesis)}</p></div>
        <div class="ai-trade-section"><b>Entry rules</b>${listItems(plan.entry_rules)}</div>
        <div class="ai-trade-section"><b>Exit rules</b>${listItems(plan.exit_rules)}</div>
        <div class="ai-trade-section"><b>Invalidation rules</b>${listItems(plan.invalidation_rules)}</div>
        <div class="ai-trade-section"><b>Parameters</b><pre>${escapeHtml(JSON.stringify(plan.parameters, null, 2))}</pre></div>
        <div class="ai-trade-section"><b>Success criteria</b>${listItems(plan.success_criteria)}</div>
        <div class="ai-trade-section"><b>Caveats</b>${listItems(plan.caveats)}</div>
        <div class="ai-trade-actions">
          <button type="button" class="secondary" id="applyAiBacktestPlanButton">Apply plan</button>
          <button type="button" class="secondary" id="runAiBacktestPlanButton">Run generated backtest</button>
          <button type="button" class="secondary" id="copyAiBacktestPlanButton">Copy plan JSON</button>
        </div>
        <p class="workflow-note">Generated backtest plans are research-only. Results may not map perfectly to unsupported custom parameters.</p>
      </div>
    `;
    document.getElementById('applyAiBacktestPlanButton')?.addEventListener('click', () => { try { applyBacktestPlan(); } catch (error) { showError(error); } });
    document.getElementById('runAiBacktestPlanButton')?.addEventListener('click', () => runGeneratedBacktest().catch(showError));
    document.getElementById('copyAiBacktestPlanButton')?.addEventListener('click', copyPlanJson);
    print({ ai_backtest_plan: plan }, 'backtests');
  }

  async function copyPlanJson() {
    if (!lastPlan) return;
    const text = JSON.stringify(lastPlan.plan, null, 2);
    try {
      await navigator.clipboard.writeText(text);
      setStatus('Backtest plan JSON copied.');
    } catch (_) {
      print(text, 'backtests');
      setStatus('Clipboard unavailable; plan printed in Backtests pane.');
    }
  }

  function ensureContainer() {
    let container = document.getElementById('aiBacktestGeneratorCard');
    if (container) return container;
    const tradeCard = document.getElementById('aiTradeIdeaCard');
    container = document.createElement('div');
    container.id = 'aiBacktestGeneratorCard';
    container.className = 'ai-backtest-generator-shell';
    if (tradeCard) tradeCard.insertAdjacentElement('afterend', container);
    else document.querySelector('.analysis-results-panel')?.appendChild(container) || document.body.appendChild(container);
    return container;
  }

  function addGeneratorButton() {
    const card = document.querySelector('#aiTradeIdeaCard .ai-trade-actions');
    if (!card || document.getElementById('generateAiBacktestPlanButton')) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.id = 'generateAiBacktestPlanButton';
    button.className = 'secondary';
    button.textContent = 'Generate backtest plan';
    button.addEventListener('click', () => generateBacktestPlan().catch(showError));
    card.insertBefore(button, document.getElementById('backtestAiTradeIdeaButton') || null);
  }

  function wrapTradeIdeaRenderer() {
    if (window.__aiBacktestGeneratorWrapped) return;
    const original = window.renderTradeIdeaCard;
    if (typeof original !== 'function') return;
    window.renderTradeIdeaCard = function(parsed, response) {
      lastIdea = { parsed, response, context: typeof window.collectTradeIdeaContext === 'function' ? window.collectTradeIdeaContext() : {} };
      lastPlan = null;
      const result = original.apply(this, arguments);
      addGeneratorButton();
      ensureContainer().innerHTML = '';
      return result;
    };
    window.__aiBacktestGeneratorWrapped = true;
  }

  function setStatus(message) {
    const status = document.getElementById('aiTradeIdeaStatus');
    if (status) status.textContent = message;
  }

  function showError(error) {
    const message = String(error && error.message ? error.message : error);
    setStatus(message);
    print(message, 'backtests');
  }

  function addStyles() {
    if (document.getElementById('aiBacktestGeneratorStyles')) return;
    const style = document.createElement('style');
    style.id = 'aiBacktestGeneratorStyles';
    style.textContent = '.ai-backtest-generator-shell{margin:8px 0}.ai-backtest-generator-card{border:1px solid #2563eb;border-radius:10px;background:#08111f;padding:10px;display:grid;gap:9px}.ai-backtest-generator-card pre{white-space:pre-wrap;background:#020617;border:1px solid #1e293b;border-radius:8px;padding:7px;font-size:11px;max-height:180px;overflow:auto}';
    document.head.appendChild(style);
  }

  function bootAiBacktestGenerator() {
    if (window.workstationModuleGuard) {
      window.workstationModuleGuard.check('aiBacktestGenerator', {
        globals: ['post', 'print', '$'],
        selectors: ['#symbol', '#asset', '#exchange', '#tf', '#strategy', '#period', '#backtestPlan'],
      });
    }
    addStyles();
    wrapTradeIdeaRenderer();
    addGeneratorButton();
  }

  window.generateAiBacktestPlan = generateBacktestPlan;
  window.applyAiBacktestPlan = applyBacktestPlan;
  window.runGeneratedAiBacktest = runGeneratedBacktest;

  if (window.workstationBoot) window.workstationBoot.register('ai-backtest-generator', bootAiBacktestGenerator);
  else if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bootAiBacktestGenerator);
  else bootAiBacktestGenerator();
})();
