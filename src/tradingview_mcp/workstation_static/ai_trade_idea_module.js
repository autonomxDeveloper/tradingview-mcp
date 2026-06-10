(function() {
  let lastTradeIdeaResponse = null;

  function safeJsonParse(content) {
    if (!content || typeof content !== 'string') return null;
    let cleaned = content.trim();
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
    }
    try { return JSON.parse(cleaned); } catch (_) { return null; }
  }

  function textOf(value, fallback = '-') {
    if (value === null || value === undefined || value === '') return fallback;
    if (Array.isArray(value)) return value.length ? value.join('\n') : fallback;
    if (typeof value === 'object') return JSON.stringify(value, null, 2);
    return String(value);
  }

  function listItems(values) {
    const items = Array.isArray(values) ? values : values ? [values] : [];
    return items.length ? `<ul>${items.map((item) => `<li>${escapeHtml(textOf(item, ''))}</li>`).join('')}</ul>` : '<p class="muted">None provided.</p>';
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function collectTradeIdeaContext() {
    const chartContext = typeof window.getPrimaryChartContext === 'function'
      ? window.getPrimaryChartContext()
      : {
          symbol: $('symbol')?.value,
          asset_type: $('asset')?.value,
          exchange: $('exchange')?.value,
          timeframe: $('tf')?.value,
        };
    const question = ($('question')?.value || '').trim();
    const paperSummary = document.getElementById('paperAccountSummary')?.textContent || '';
    const providerSummary = document.getElementById('dataProviderStatus')?.textContent || document.getElementById('chartMeta')?.textContent || '';
    return { chart: chartContext, user_question: question, paper_summary: paperSummary, provider_summary: providerSummary };
  }

  function tradeIdeaPrompt(context) {
    return [
      'Generate one research-only trade idea for the currently loaded chart, or return no_trade if there is no clean setup.',
      'This is for simulated paper trading/research only. Do not instruct the user to place a live trade.',
      'Return only valid JSON. Include these keys: summary, trend, key_levels, risks, invalidation, backtest_ideas, confidence, not_financial_advice, trade_idea.',
      'trade_idea must include: bias, setup_type, direction, entry_zone, stop_or_invalidation, targets, risk_reward, sizing_note, timeframe, paper_trade_candidate, no_trade_reason.',
      'Use no_trade_reason and direction="no_trade" when the chart is not a high-quality setup.',
      'Keep entries and targets as zones/conditions, not guarantees. Prefer confirmation triggers over market orders.',
      `Visible workstation context:\n${JSON.stringify(context, null, 2)}`,
    ].join('\n\n');
  }

  async function generateTradeIdea() {
    const context = collectTradeIdeaContext();
    const payload = {
      symbol: $('symbol').value,
      asset_type: $('asset').value,
      exchange: $('exchange').value,
      timeframe: $('tf').value,
      question: tradeIdeaPrompt(context),
    };
    setTradeIdeaStatus('Generating AI trade idea...');
    print('Generating AI trade idea...', 'analysis');
    const response = await post('/api/ai/analyze', payload);
    const parsed = safeJsonParse(response.analysis?.content || '') || response.structured_analysis?.raw || response.structured_analysis || response;
    lastTradeIdeaResponse = { response, parsed, context };
    renderTradeIdeaCard(parsed, response);
    return lastTradeIdeaResponse;
  }

  function renderTradeIdeaCard(parsed, response) {
    const container = ensureTradeIdeaContainer();
    const tradeIdea = parsed.trade_idea || parsed.tradePlan || parsed.trade_plan || {};
    const direction = tradeIdea.direction || parsed.direction || 'unknown';
    const isNoTrade = String(direction).toLowerCase() === 'no_trade' || !!tradeIdea.no_trade_reason;
    container.innerHTML = `
      <div class="ai-trade-card ${isNoTrade ? 'no-trade' : ''}">
        <div class="ai-trade-card-header">
          <div>
            <div class="label">AI trade idea</div>
            <strong>${escapeHtml(($('symbol')?.value || '').toUpperCase())} · ${escapeHtml($('tf')?.value || '')}</strong>
          </div>
          <span class="ai-trade-badge">${escapeHtml(isNoTrade ? 'No trade / wait' : direction)}</span>
        </div>
        <div class="ai-trade-grid">
          <div><span>Bias</span><b>${escapeHtml(tradeIdea.bias || parsed.trend || 'unknown')}</b></div>
          <div><span>Setup</span><b>${escapeHtml(tradeIdea.setup_type || parsed.setup_type || 'unspecified')}</b></div>
          <div><span>Entry zone</span><b>${escapeHtml(textOf(tradeIdea.entry_zone, 'wait for confirmation'))}</b></div>
          <div><span>Invalidation</span><b>${escapeHtml(textOf(tradeIdea.stop_or_invalidation || parsed.invalidation, 'not specified'))}</b></div>
          <div><span>Targets</span><b>${escapeHtml(textOf(tradeIdea.targets, 'not specified'))}</b></div>
          <div><span>Risk/reward</span><b>${escapeHtml(textOf(tradeIdea.risk_reward, 'unknown'))}</b></div>
          <div><span>Confidence</span><b>${escapeHtml(parsed.confidence || 'unknown')}</b></div>
          <div><span>Paper candidate</span><b>${tradeIdea.paper_trade_candidate === false || isNoTrade ? 'No' : 'Possible'}</b></div>
        </div>
        ${tradeIdea.no_trade_reason ? `<p class="ai-trade-warning"><b>No-trade reason:</b> ${escapeHtml(tradeIdea.no_trade_reason)}</p>` : ''}
        <div class="ai-trade-section"><b>Summary</b><p>${escapeHtml(textOf(parsed.summary, 'No summary returned.'))}</p></div>
        <div class="ai-trade-section"><b>Risks</b>${listItems(parsed.risks)}</div>
        <div class="ai-trade-section"><b>Backtest ideas</b>${listItems(parsed.backtest_ideas)}</div>
        <div class="ai-trade-actions">
          <button type="button" class="secondary" id="applyTradeIdeaToIdeaForm">Apply to idea form</button>
          <button type="button" class="secondary" id="applyTradeIdeaToPaperTicket">Prefill paper ticket</button>
          <button type="button" class="secondary" id="copyTradeIdeaJson">Copy JSON</button>
        </div>
        <p class="workflow-note">Research-only AI output. Use paper trading for simulation; no live broker orders are submitted.</p>
      </div>
    `;
    document.getElementById('applyTradeIdeaToIdeaForm')?.addEventListener('click', applyTradeIdeaToIdeaForm);
    document.getElementById('applyTradeIdeaToPaperTicket')?.addEventListener('click', applyTradeIdeaToPaperTicket);
    document.getElementById('copyTradeIdeaJson')?.addEventListener('click', copyTradeIdeaJson);
    print(parsed, 'analysis');
    setTradeIdeaStatus(`AI trade idea generated${response?.analysis?.model ? ` by ${response.analysis.model}` : ''}.`);
  }

  function applyTradeIdeaToIdeaForm() {
    if (!lastTradeIdeaResponse) return;
    const parsed = lastTradeIdeaResponse.parsed || {};
    const tradeIdea = parsed.trade_idea || {};
    if ($('hypothesis')) $('hypothesis').value = parsed.summary || `${tradeIdea.bias || 'unknown'} ${tradeIdea.setup_type || 'setup'} on ${$('symbol').value}`;
    if ($('invalidation')) $('invalidation').value = tradeIdea.stop_or_invalidation || parsed.invalidation || '';
    if ($('backtestPlan')) $('backtestPlan').value = Array.isArray(parsed.backtest_ideas) ? parsed.backtest_ideas.join('\n') : textOf(parsed.backtest_ideas, '');
    setTradeIdeaStatus('Trade idea copied into research idea fields. Review before saving.');
  }

  function applyTradeIdeaToPaperTicket() {
    if (!lastTradeIdeaResponse) return;
    const tradeIdea = lastTradeIdeaResponse.parsed?.trade_idea || {};
    const direction = String(tradeIdea.direction || '').toLowerCase();
    if ($('paperSide') && ['long', 'buy'].includes(direction)) $('paperSide').value = 'buy';
    if ($('paperSide') && ['short', 'sell'].includes(direction)) $('paperSide').value = 'sell';
    if ($('paperOrderType')) $('paperOrderType').value = 'limit';
    if ($('paperIdeaId')) $('paperIdeaId').value = $('ideaId')?.value || '';
    if ($('paperNotes')) $('paperNotes').value = `AI paper idea: ${textOf(tradeIdea.setup_type || lastTradeIdeaResponse.parsed?.summary, '')}`;
    setTradeIdeaStatus('Paper ticket prefilled where possible. Set quantity/price and review before submitting a simulated order.');
  }

  async function copyTradeIdeaJson() {
    if (!lastTradeIdeaResponse) return;
    const text = JSON.stringify(lastTradeIdeaResponse.parsed, null, 2);
    try {
      await navigator.clipboard.writeText(text);
      setTradeIdeaStatus('Trade idea JSON copied.');
    } catch (_) {
      print(text, 'analysis');
      setTradeIdeaStatus('Clipboard unavailable; JSON printed in AI panel.');
    }
  }

  function setTradeIdeaStatus(message) {
    const status = document.getElementById('aiTradeIdeaStatus');
    if (status) status.textContent = message;
  }

  function ensureTradeIdeaContainer() {
    let container = document.getElementById('aiTradeIdeaCard');
    if (container) return container;
    const panel = document.querySelector('.analysis-results-panel');
    container = document.createElement('div');
    container.id = 'aiTradeIdeaCard';
    container.className = 'ai-trade-idea-card-shell';
    if (panel) panel.insertBefore(container, document.getElementById('analysis'));
    else document.body.appendChild(container);
    return container;
  }

  function addTradeIdeaControls() {
    const analyzeButton = document.querySelector('[data-action="analysis.run"]');
    const panel = analyzeButton?.parentElement;
    if (!panel || document.getElementById('generateTradeIdeaButton')) return;
    const button = document.createElement('button');
    button.id = 'generateTradeIdeaButton';
    button.type = 'button';
    button.className = 'secondary';
    button.textContent = 'AI trade idea';
    button.addEventListener('click', () => generateTradeIdea().catch((error) => {
      setTradeIdeaStatus(String(error && error.message ? error.message : error));
      print(String(error && error.message ? error.message : error), 'analysis');
    }));
    analyzeButton.insertAdjacentElement('afterend', button);
    const status = document.createElement('div');
    status.id = 'aiTradeIdeaStatus';
    status.className = 'module-control-status';
    status.textContent = 'AI trade ideas are research-only and can be copied to idea/paper workflows.';
    panel.appendChild(status);
  }

  function addTradeIdeaStyles() {
    if (document.getElementById('aiTradeIdeaStyles')) return;
    const style = document.createElement('style');
    style.id = 'aiTradeIdeaStyles';
    style.textContent = '.ai-trade-idea-card-shell{margin-bottom:8px}.ai-trade-card{border:1px solid #334155;border-radius:10px;background:#0b1220;padding:10px;display:grid;gap:9px}.ai-trade-card.no-trade{border-color:#f59e0b}.ai-trade-card-header{display:flex;justify-content:space-between;gap:8px;align-items:flex-start}.ai-trade-badge{border:1px solid #334155;border-radius:999px;padding:4px 8px;background:#111827;color:#bfdbfe;text-transform:capitalize;font-size:12px}.ai-trade-grid{display:grid;grid-template-columns:1fr 1fr;gap:6px}.ai-trade-grid div{border:1px solid #1e293b;border-radius:8px;padding:6px;background:#080d18}.ai-trade-grid span{display:block;color:#94a3b8;font-size:11px;text-transform:uppercase;letter-spacing:.05em}.ai-trade-grid b{font-size:12px;white-space:pre-wrap}.ai-trade-section{font-size:12px;line-height:1.45}.ai-trade-section p{margin:4px 0}.ai-trade-section ul{margin:5px 0 0 18px;padding:0}.ai-trade-warning{border:1px solid #f59e0b;border-radius:8px;padding:7px;background:rgba(245,158,11,.12);font-size:12px}.ai-trade-actions{display:flex;gap:6px;flex-wrap:wrap}.ai-trade-actions button{font-size:12px;padding:5px 7px}@media(max-width:1200px){.ai-trade-grid{grid-template-columns:1fr}}';
    document.head.appendChild(style);
  }

  function bootAiTradeIdeaModule() {
    if (window.workstationModuleGuard) {
      window.workstationModuleGuard.check('aiTradeIdeas', {
        globals: ['post', 'print', '$'],
        selectors: ['#symbol', '#asset', '#exchange', '#tf', '#question', '#analysis'],
      });
    }
    addTradeIdeaStyles();
    addTradeIdeaControls();
    ensureTradeIdeaContainer();
  }

  window.collectTradeIdeaContext = collectTradeIdeaContext;
  window.generateTradeIdea = generateTradeIdea;
  window.renderTradeIdeaCard = renderTradeIdeaCard;

  if (window.workstationBoot) window.workstationBoot.register('ai-trade-ideas', bootAiTradeIdeaModule);
  else if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bootAiTradeIdeaModule);
  else bootAiTradeIdeaModule();
})();
