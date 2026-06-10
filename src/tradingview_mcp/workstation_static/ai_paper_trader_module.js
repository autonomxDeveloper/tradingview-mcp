(function() {
  const state = {
    lastDecisionResponse: null,
    lastExecutionResponse: null,
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

  function numberFromInput(id) {
    const value = parseFloat(($(id) && $(id).value) || '');
    return Number.isFinite(value) && value > 0 ? value : null;
  }

  function activeSymbol() {
    return (($('symbol')?.value || '') + '').trim().toUpperCase();
  }

  function activeAssetType() {
    const asset = String($('asset')?.value || 'auto').toLowerCase();
    const symbol = activeSymbol();
    if (asset === 'crypto' || symbol.endsWith('USDT') || symbol.endsWith('-USD')) return 'crypto';
    if (asset === 'stock' || asset === 'auto') return 'stock';
    return 'other';
  }

  function activeChartContext() {
    if (typeof window.getPrimaryChartContext === 'function') return window.getPrimaryChartContext();
    return {
      symbol: activeSymbol(),
      asset_type: activeAssetType(),
      exchange: $('exchange')?.value || 'NASDAQ',
      timeframe: $('tf')?.value || '1D',
    };
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

  function setStatus(message) {
    const target = $('aiPaperTraderStatus');
    if (target) target.textContent = message;
  }

  function printPaper(value) {
    if (typeof window.setResultPane === 'function') window.setResultPane('paper', value);
    else if (typeof window.print === 'function') window.print(value);
  }

  function parseTimeframes() {
    const raw = ($('aiPaperTraderTimeframes')?.value || '5m,15m,1h,1D');
    return raw.split(',').map((item) => item.trim()).filter(Boolean);
  }

  function buildRiskConfig() {
    const allowed = ($('aiPaperAllowedSymbols')?.value || '').split(',').map((item) => item.trim().toUpperCase()).filter(Boolean);
    return {
      max_position_value: numberFromInput('aiPaperMaxPositionValue') || 1000,
      max_risk_per_trade_value: numberFromInput('aiPaperMaxRiskValue') || 100,
      max_trades_per_day: numberFromInput('aiPaperMaxTradesPerDay') || 3,
      max_open_positions: numberFromInput('aiPaperMaxOpenPositions') || 3,
      max_open_orders: numberFromInput('aiPaperMaxOpenOrders') || 5,
      min_risk_reward: numberFromInput('aiPaperMinRiskReward') || 0,
      min_confidence_for_open: $('aiPaperMinConfidence')?.value || 'low',
      require_confirmation: !!$('aiPaperRequireConfirmation')?.checked,
      require_stop_price: !!$('aiPaperRequireStop')?.checked,
      require_market_open: !!$('aiPaperRequireMarketOpen')?.checked,
      market_session: $('aiPaperMarketSession')?.value || 'unknown',
      allow_short: !!$('aiPaperAllowShort')?.checked,
      allowed_symbols: allowed,
      blocked_symbols: [],
    };
  }

  function buildDecisionRequest() {
    const symbol = activeSymbol();
    if (!symbol) throw new Error('Load or enter a symbol before running the AI paper trader.');
    return {
      symbol,
      asset_type: activeAssetType(),
      exchange: $('exchange')?.value || 'NASDAQ',
      timeframe: $('tf')?.value || '1D',
      question: 'Create a strict paper-only decision for the active chart. Use no_trade unless guardrails and evidence support simulation.',
      chart_context: activeChartContext(),
      timeframes: parseTimeframes(),
      profile: $('aiPaperTraderProfile')?.value || 'intraday_paper',
      mode: 'paper_trader_ui_decision',
      risk: buildRiskConfig(),
    };
  }

  function decisionIsExecutable(decision) {
    if (!decision || decision.paper_only !== true || decision.live_execution !== false) return false;
    if ((decision.guardrail_warnings || []).length) return false;
    if (decision.execution_submitted === true) return false;
    if (decision.action === 'open_trade') return decision.paper_trade_candidate === true && Number(decision.quantity || 0) > 0 && ['buy', 'sell'].includes(String(decision.side || '').toLowerCase());
    if (decision.action === 'close_trade') return Number(decision.quantity || 0) > 0;
    return false;
  }

  function renderWarnings(decision) {
    const warnings = decision?.guardrail_warnings || [];
    if (!warnings.length) return '<p class="muted">No guardrail warnings.</p>';
    return `<ul>${warnings.map((warning) => `<li>${escapeHtml(warning)}</li>`).join('')}</ul>`;
  }

  function renderDecisionCard(response) {
    const container = $('aiPaperTraderDecision');
    if (!container) return;
    const decision = response?.decision || {};
    const executable = decisionIsExecutable(decision);
    container.innerHTML = `
      <div class="ai-paper-trader-card ${executable ? 'executable' : 'blocked'}">
        <div class="ai-trade-card-header">
          <div>
            <div class="label">AI paper trader decision</div>
            <strong>${escapeHtml(response?.context?.symbol || activeSymbol())} · ${escapeHtml(response?.context?.active_timeframe || $('tf')?.value || '')}</strong>
            <div class="muted">Decision only until you explicitly submit paper execution.</div>
          </div>
          <span class="ai-trade-badge">${escapeHtml(decision.action || 'unknown')}</span>
        </div>
        <div class="ai-trade-grid">
          <div><span>Side</span><b>${escapeHtml(decision.side || 'none')}</b></div>
          <div><span>Qty</span><b>${escapeHtml(textOf(decision.quantity, '0'))}</b></div>
          <div><span>Order</span><b>${escapeHtml(decision.order_type || 'market')}</b></div>
          <div><span>Confidence</span><b>${escapeHtml(decision.confidence || 'low')}</b></div>
          <div><span>R/R</span><b>${escapeHtml(textOf(decision.risk_reward, 'unknown'))}</b></div>
          <div><span>Paper candidate</span><b>${decision.paper_trade_candidate ? 'Yes' : 'No'}</b></div>
        </div>
        <div class="ai-trade-section"><b>Reasoning</b><p>${escapeHtml(textOf(decision.reasoning_summary, 'No reasoning returned.'))}</p></div>
        <div class="ai-trade-section"><b>Invalidation</b><p>${escapeHtml(textOf(decision.invalidation, 'Not provided.'))}</p></div>
        <div class="ai-trade-section"><b>Guardrails</b>${renderWarnings(decision)}</div>
        <div class="ai-trade-actions">
          <label class="sync-toggle"><input type="checkbox" id="aiPaperExecuteAck" /> I reviewed this simulated paper decision; no live order will be placed.</label>
          <label class="sync-toggle"><input type="checkbox" id="aiPaperFillMarketOrders" /> fill market order immediately at fill price</label>
          <input id="aiPaperExecutionFillPrice" class="level-input" placeholder="fill price optional" />
          <button type="button" class="secondary" id="executeAiPaperDecisionButton" ${executable ? '' : 'disabled'}>Execute simulated paper decision</button>
        </div>
        <p class="workflow-note">Execution endpoint is paper-only. Blocked decisions cannot be submitted.</p>
      </div>
    `;
    $('executeAiPaperDecisionButton')?.addEventListener('click', () => executeAiPaperDecision().catch(showError));
  }

  async function runAiPaperTraderDecision() {
    const request = buildDecisionRequest();
    setStatus('Requesting AI paper-trader decision...');
    const response = await postJson('/api/ai/paper-trader/decision', request);
    state.lastDecisionResponse = response;
    state.lastExecutionResponse = null;
    renderDecisionCard(response);
    printPaper({ ai_paper_trader_decision: response, paper_only: true, live_execution: false });
    setStatus(`Decision returned: ${response.decision?.action || 'unknown'}. Review before simulated execution.`);
    return response;
  }

  async function executeAiPaperDecision() {
    const response = state.lastDecisionResponse;
    const decision = response?.decision;
    if (!decision) throw new Error('Run an AI paper-trader decision first.');
    if (!decisionIsExecutable(decision)) throw new Error('This AI paper decision is blocked or not executable.');
    if (!$('aiPaperExecuteAck')?.checked) throw new Error('Confirm that you reviewed the simulated paper decision first.');
    const symbol = response?.context?.symbol || activeSymbol();
    const fillPrice = numberFromInput('aiPaperExecutionFillPrice');
    const payload = {
      symbol,
      asset_type: response?.context?.asset_type || activeAssetType(),
      decision,
      idea_id: $('paperIdeaId')?.value || null,
      notes: 'AI paper trader UI explicit simulated execution',
      fill_market_orders: !!$('aiPaperFillMarketOrders')?.checked,
      fill_price: fillPrice,
      cancel_open_orders_on_no_trade: false,
    };
    setStatus('Submitting explicit simulated paper execution...');
    const execution = await postJson('/api/ai/paper-trader/execute', payload);
    state.lastExecutionResponse = execution;
    if (execution?.result?.order?.id && $('paperOrderId')) $('paperOrderId').value = execution.result.order.id;
    if (typeof window.refreshPaperTrading === 'function') await window.refreshPaperTrading();
    printPaper({ ai_paper_trader_execution: execution, paper_only: true, live_execution: false });
    setStatus(`Execution result: ${execution.result?.execution_action || 'unknown'}; live execution false.`);
    return execution;
  }

  function showError(error) {
    const message = error && error.message ? error.message : String(error);
    setStatus(message);
    if (typeof window.print === 'function') window.print(message);
  }

  function ensurePanel() {
    if ($('aiPaperTraderPanel')) return;
    const paperStatus = $('paperTradingStatus');
    if (!paperStatus || !paperStatus.parentElement) return;
    const panel = document.createElement('div');
    panel.id = 'aiPaperTraderPanel';
    panel.className = 'ai-paper-trader-panel';
    panel.innerHTML = `
      <div class="label">AI paper trader</div>
      <p class="paper-trading-warning">AI decisions and executions are simulated paper-only. No live broker orders.</p>
      <div class="paper-order-grid" aria-label="AI paper trader settings">
        <select id="aiPaperTraderProfile"><option value="intraday_paper">intraday paper</option><option value="swing_paper">swing paper</option><option value="risk_review">risk review</option></select>
        <input id="aiPaperTraderTimeframes" value="5m,15m,1h,1D" />
        <input id="aiPaperMaxPositionValue" placeholder="max position $" value="1000" />
        <input id="aiPaperMaxRiskValue" placeholder="max risk $" value="100" />
        <input id="aiPaperMaxTradesPerDay" placeholder="max trades/day" value="3" />
        <input id="aiPaperMaxOpenPositions" placeholder="max positions" value="3" />
        <input id="aiPaperMaxOpenOrders" placeholder="max orders" value="5" />
        <input id="aiPaperMinRiskReward" placeholder="min R/R" value="0" />
        <select id="aiPaperMinConfidence"><option value="low">min low confidence</option><option value="medium">min medium confidence</option><option value="high">min high confidence</option></select>
        <select id="aiPaperMarketSession"><option value="unknown">session unknown</option><option value="open">market open</option><option value="closed">market closed</option><option value="crypto_24_7">crypto 24/7</option></select>
        <input id="aiPaperAllowedSymbols" class="paper-notes-input" placeholder="allowed symbols optional, comma-separated" />
        <label class="sync-toggle"><input id="aiPaperRequireConfirmation" type="checkbox" checked /> require confirmation</label>
        <label class="sync-toggle"><input id="aiPaperRequireStop" type="checkbox" /> require stop price</label>
        <label class="sync-toggle"><input id="aiPaperRequireMarketOpen" type="checkbox" /> require market open</label>
        <label class="sync-toggle"><input id="aiPaperAllowShort" type="checkbox" /> allow short/sell opens</label>
        <button type="button" class="secondary" data-action="aiPaperTrader.decision">Get AI paper decision</button>
      </div>
      <div id="aiPaperTraderStatus" class="module-control-status">AI paper trader ready. Decision first; explicit simulated execution second.</div>
      <div id="aiPaperTraderDecision"></div>
    `;
    paperStatus.insertAdjacentElement('afterend', panel);
    if (typeof window.bindWorkstationActions === 'function') window.bindWorkstationActions(panel);
  }

  function initializeAiPaperTrader() {
    ensurePanel();
  }

  window.aiPaperTraderState = state;
  window.runAiPaperTraderDecision = runAiPaperTraderDecision;
  window.executeAiPaperDecision = executeAiPaperDecision;

  if (window.workstationBoot) window.workstationBoot.register('ai-paper-trader', initializeAiPaperTrader);
  else if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initializeAiPaperTrader);
  else initializeAiPaperTrader();
})();
