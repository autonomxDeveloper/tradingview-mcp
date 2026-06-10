(function() {
  const state = {
    rows: [],
    byId: new Map(),
    running: false,
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

  function normalizeDirection(value) {
    const direction = String(value || '').toLowerCase().replace(/\s+/g, '_');
    if (['long', 'buy', 'bullish'].includes(direction)) return 'long';
    if (['short', 'sell', 'bearish'].includes(direction)) return 'short';
    return 'no_trade';
  }

  function normalizeConfidence(value) {
    const confidence = String(value || '').toLowerCase();
    return ['low', 'medium', 'high'].includes(confidence) ? confidence : 'low';
  }

  function normalizeBias(value) {
    const bias = String(value || '').toLowerCase();
    return ['bullish', 'bearish', 'neutral', 'range'].includes(bias) ? bias : 'neutral';
  }

  function normalizeTradeIdeaPayload(payload) {
    const source = payload && typeof payload === 'object' ? payload : {};
    const tradeIdea = (source.trade_idea || source.tradePlan || source.trade_plan || {});
    const direction = normalizeDirection(tradeIdea.direction || source.direction);
    return {
      ...source,
      summary: textOf(source.summary, 'No summary returned.'),
      trend: textOf(source.trend, 'unknown'),
      key_levels: normalizeList(source.key_levels),
      risks: normalizeList(source.risks),
      invalidation: textOf(source.invalidation, ''),
      backtest_ideas: normalizeList(source.backtest_ideas),
      confidence: normalizeConfidence(source.confidence),
      not_financial_advice: source.not_financial_advice !== false,
      trade_idea: {
        bias: normalizeBias(tradeIdea.bias || source.trend),
        setup_type: textOf(tradeIdea.setup_type || source.setup_type, direction === 'no_trade' ? 'no_trade' : 'unspecified'),
        direction,
        entry_zone: textOf(tradeIdea.entry_zone, direction === 'no_trade' ? 'wait for confirmation' : 'not specified'),
        stop_or_invalidation: textOf(tradeIdea.stop_or_invalidation || source.invalidation, direction === 'no_trade' ? 'not applicable' : 'not specified'),
        targets: normalizeList(tradeIdea.targets),
        risk_reward: textOf(tradeIdea.risk_reward, 'unknown'),
        sizing_note: textOf(tradeIdea.sizing_note, 'Paper simulation only; size manually after review.'),
        timeframe: textOf(tradeIdea.timeframe || source.timeframe || $('tf')?.value, '1D'),
        paper_trade_candidate: direction !== 'no_trade' && tradeIdea.paper_trade_candidate !== false,
        no_trade_reason: textOf(tradeIdea.no_trade_reason || source.no_trade_reason, direction === 'no_trade' ? 'No clean, high-quality setup was returned.' : ''),
      },
    };
  }

  function watchSymbols() {
    if (typeof window.watchSymbols === 'function') return window.watchSymbols();
    return [...document.querySelectorAll('#watch button')].map((button) => button.textContent.trim()).filter(Boolean);
  }

  function exchangeFor(symbol) {
    if (typeof window.scannerExchange === 'function') return window.scannerExchange(symbol);
    return String(symbol).includes('USDT') ? 'BINANCE' : 'NASDAQ';
  }

  function assetFor(symbol) {
    return String(symbol).includes('USDT') ? 'crypto' : 'stock';
  }

  function currentProfile() {
    return $('aiTradeIdeaProfile')?.value || 'swing';
  }

  function scannerRowsBySymbol() {
    const rows = window.workstationScannerRows || [];
    return new Map(rows.map((row) => [String(row.symbol || '').toUpperCase(), row]));
  }

  function rankScore(parsed, scannerRow) {
    const tradeIdea = parsed.trade_idea || {};
    const direction = tradeIdea.direction || 'no_trade';
    if (direction === 'no_trade') return 0;
    const confidenceScore = { low: 1, medium: 2, high: 3 }[parsed.confidence] || 1;
    const candidateScore = tradeIdea.paper_trade_candidate === false ? 0 : 2;
    const scannerSignal = String(scannerRow?.signal || scannerRow?.rating || '').toLowerCase();
    const scannerScore = scannerSignal.includes('buy') || scannerSignal.includes('strong') ? 1 : 0;
    const riskRewardScore = /[2-9](?:\.\d+)?:\s*1|[2-9](?:\.\d+)?r/i.test(String(tradeIdea.risk_reward || '')) ? 1 : 0;
    return confidenceScore + candidateScore + scannerScore + riskRewardScore;
  }

  function tradePrompt(context) {
    return [
      'Scan this watchlist candidate for one research-only trade idea, or return no_trade if it is not a clean setup.',
      'This is for simulated paper trading and research only. Do not instruct the user to place a live trade.',
      'Return only valid JSON. Include keys: summary, trend, key_levels, risks, invalidation, backtest_ideas, confidence, not_financial_advice, trade_idea.',
      'trade_idea must include: bias, setup_type, direction, entry_zone, stop_or_invalidation, targets, risk_reward, sizing_note, timeframe, paper_trade_candidate, no_trade_reason.',
      'Allowed direction values: long, short, no_trade. Confidence must be low, medium, or high. Do not force a trade.',
      `Watchlist candidate context:\n${JSON.stringify(context, null, 2)}`,
    ].join('\n\n');
  }

  async function callTradeIdea(symbol, scannerRow) {
    const assetType = assetFor(symbol);
    const exchange = exchangeFor(symbol);
    const timeframe = $('tf')?.value || '1D';
    const context = {
      symbol,
      asset_type: assetType,
      exchange,
      timeframe,
      profile: currentProfile(),
      scanner_row: scannerRow || null,
      source: 'ai_watchlist_scanner',
      no_live_orders: true,
      simulated_only: true,
    };
    const payload = {
      symbol,
      asset_type: assetType,
      exchange,
      timeframe,
      profile: currentProfile(),
      mode: 'watchlist_trade_scanner',
      chart_context: context,
      question: tradePrompt(context),
    };
    try {
      return await post('/api/ai/trade-idea', payload);
    } catch (error) {
      const message = String(error?.message || error);
      if (!message.includes('404')) throw error;
      return post('/api/ai/analyze', payload);
    }
  }

  function parseAiResponse(response) {
    const raw = safeJsonParse(response?.trade_idea?.content || response?.analysis?.content || '')
      || response?.structured_trade_idea?.raw
      || response?.structured_analysis?.raw
      || response?.structured_analysis
      || response;
    return normalizeTradeIdeaPayload(raw);
  }

  function maxScanCount() {
    const value = Number($('aiWatchlistScanMax')?.value || 5);
    return Number.isFinite(value) ? Math.max(1, Math.min(12, Math.trunc(value))) : 5;
  }

  async function scanWatchlistWithAi() {
    if (state.running) return;
    const symbols = watchSymbols().map((symbol) => symbol.toUpperCase()).filter(Boolean).slice(0, maxScanCount());
    if (!symbols.length) {
      setStatus('Add symbols to the watchlist first.');
      print('Add symbols to the watchlist first.', 'scanner');
      return;
    }
    state.running = true;
    state.rows = [];
    state.byId.clear();
    const scannerBySymbol = scannerRowsBySymbol();
    setStatus(`AI scanning ${symbols.length} watchlist symbols...`);
    if (typeof window.showResultPane === 'function') window.showResultPane('scanner');
    renderScanProgress(symbols, []);
    const rows = [];
    for (const symbol of symbols) {
      try {
        setStatus(`AI scanning ${symbol}...`);
        const scannerRow = scannerBySymbol.get(symbol) || null;
        const response = await callTradeIdea(symbol, scannerRow);
        const parsed = parseAiResponse(response);
        const row = {
          id: `ai-watchlist-${symbol}-${Date.now()}-${rows.length}`,
          symbol,
          asset_type: assetFor(symbol),
          exchange: exchangeFor(symbol),
          timeframe: $('tf')?.value || '1D',
          scanner_row: scannerRow,
          parsed,
          response,
          score: rankScore(parsed, scannerRow),
          error: null,
        };
        rows.push(row);
        renderScanProgress(symbols, rows);
      } catch (error) {
        rows.push({
          id: `ai-watchlist-${symbol}-${Date.now()}-${rows.length}`,
          symbol,
          asset_type: assetFor(symbol),
          exchange: exchangeFor(symbol),
          timeframe: $('tf')?.value || '1D',
          parsed: null,
          response: null,
          score: 0,
          error: String(error?.message || error),
        });
        renderScanProgress(symbols, rows);
      }
    }
    state.rows = rows.sort((a, b) => b.score - a.score || String(a.symbol).localeCompare(String(b.symbol)));
    state.byId = new Map(state.rows.map((row) => [row.id, row]));
    window.aiWatchlistTradeIdeas = state.rows;
    renderResults();
    print({ ai_watchlist_trade_ideas: state.rows, mode: 'research_only', no_live_orders: true }, 'scanner');
    setStatus(`AI watchlist scan complete: ${state.rows.filter((row) => row.parsed?.trade_idea?.direction !== 'no_trade').length} candidate(s), ${state.rows.length} reviewed.`);
    state.running = false;
  }

  function renderScanProgress(symbols, rows) {
    const pane = $('resultPane-scanner');
    if (!pane) return;
    pane.innerHTML = `<div class="ai-watchlist-scanner"><b>AI watchlist scan</b><p class="muted">Reviewed ${rows.length}/${symbols.length}. Research-only; no live orders.</p></div>`;
  }

  function listHtml(values) {
    const items = normalizeList(values);
    return items.length ? `<ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>` : '<p class="muted">None provided.</p>';
  }

  function renderResults() {
    const pane = $('resultPane-scanner');
    if (!pane) return;
    const rows = state.rows || [];
    const cards = rows.map(renderCandidateCard).join('');
    pane.innerHTML = `
      <div class="ai-watchlist-scanner">
        <div class="ai-watchlist-header">
          <div>
            <div class="label">AI watchlist trade scanner</div>
            <strong>${rows.length} symbols reviewed</strong>
          </div>
          <span class="ai-watchlist-badge">Research / paper only</span>
        </div>
        <p class="workflow-note">Candidates are ranked for review, not execution. Save/backtest before using paper simulation. No live broker orders are submitted.</p>
        <div class="ai-watchlist-grid">${cards || '<p class="muted">No scan results yet.</p>'}</div>
      </div>`;
    bindResultActions(pane);
    if (typeof window.showResultPane === 'function') window.showResultPane('scanner');
  }

  function renderCandidateCard(row) {
    if (row.error) {
      return `<div class="ai-watchlist-card error"><div class="ai-watchlist-title"><b>${escapeHtml(row.symbol)}</b><span>Error</span></div><p>${escapeHtml(row.error)}</p></div>`;
    }
    const parsed = row.parsed || {};
    const tradeIdea = parsed.trade_idea || {};
    const direction = tradeIdea.direction || 'no_trade';
    const isNoTrade = direction === 'no_trade';
    return `
      <div class="ai-watchlist-card ${isNoTrade ? 'no-trade' : ''}" data-ai-watchlist-id="${escapeHtml(row.id)}">
        <div class="ai-watchlist-title">
          <div><b>${escapeHtml(row.symbol)}</b><span>${escapeHtml(row.timeframe)} · ${escapeHtml(row.exchange)}</span></div>
          <em>${escapeHtml(isNoTrade ? 'No trade' : direction)} · score ${escapeHtml(row.score)}</em>
        </div>
        <div class="ai-watchlist-mini-grid">
          <div><span>Bias</span><b>${escapeHtml(tradeIdea.bias || parsed.trend || 'neutral')}</b></div>
          <div><span>Setup</span><b>${escapeHtml(tradeIdea.setup_type || 'unspecified')}</b></div>
          <div><span>Entry</span><b>${escapeHtml(textOf(tradeIdea.entry_zone, 'wait'))}</b></div>
          <div><span>Invalidation</span><b>${escapeHtml(textOf(tradeIdea.stop_or_invalidation || parsed.invalidation, 'not specified'))}</b></div>
          <div><span>Confidence</span><b>${escapeHtml(parsed.confidence || 'low')}</b></div>
          <div><span>R/R</span><b>${escapeHtml(textOf(tradeIdea.risk_reward, 'unknown'))}</b></div>
        </div>
        ${tradeIdea.no_trade_reason ? `<p class="ai-watchlist-warning"><b>No-trade reason:</b> ${escapeHtml(tradeIdea.no_trade_reason)}</p>` : ''}
        <p>${escapeHtml(parsed.summary || 'No summary returned.')}</p>
        <details><summary>Risks / backtest ideas</summary><b>Risks</b>${listHtml(parsed.risks)}<b>Backtest ideas</b>${listHtml(parsed.backtest_ideas)}</details>
        <div class="ai-watchlist-actions">
          <button type="button" class="secondary" data-ai-watchlist-action="load">Load chart</button>
          <button type="button" class="secondary" data-ai-watchlist-action="save">Save idea</button>
          <button type="button" class="secondary" data-ai-watchlist-action="backtest">Backtest</button>
          <button type="button" class="secondary" data-ai-watchlist-action="paper">Prefill paper</button>
        </div>
      </div>`;
  }

  function bindResultActions(container) {
    container.querySelectorAll('[data-ai-watchlist-action]').forEach((button) => {
      button.addEventListener('click', () => handleCandidateAction(button));
    });
  }

  async function handleCandidateAction(button) {
    const card = button.closest('[data-ai-watchlist-id]');
    const row = state.byId.get(card?.dataset.aiWatchlistId || '');
    if (!row) return;
    const action = button.dataset.aiWatchlistAction;
    try {
      if (action === 'load') return loadCandidate(row);
      if (action === 'save') return await saveCandidate(row);
      if (action === 'backtest') return await backtestCandidate(row);
      if (action === 'paper') return prefillPaperCandidate(row);
    } catch (error) {
      setStatus(String(error?.message || error));
      print(String(error?.message || error), 'scanner');
    }
  }

  function loadCandidate(row) {
    if ($('symbol')) $('symbol').value = row.symbol;
    if ($('asset')) $('asset').value = row.asset_type;
    if ($('exchange')) $('exchange').value = row.exchange;
    if ($('tf')) $('tf').value = row.timeframe;
    if (typeof window.loadMarket === 'function') window.loadMarket();
    setStatus(`${row.symbol} loaded from AI watchlist scan.`);
  }

  function ideaPayload(row) {
    const parsed = row.parsed || {};
    const tradeIdea = parsed.trade_idea || {};
    return {
      symbol: row.symbol,
      asset_type: row.asset_type,
      timeframe: row.timeframe,
      status: 'draft',
      bias: normalizeBias(tradeIdea.bias || parsed.trend),
      setup_type: String(tradeIdea.setup_type || 'ai_watchlist_scan'),
      hypothesis: parsed.summary || `${row.symbol} AI watchlist scan candidate`,
      invalidation: tradeIdea.stop_or_invalidation || parsed.invalidation || 'Review AI output for invalidation.',
      risk_notes: textOf(parsed.risks, ''),
      backtest_plan: textOf(parsed.backtest_ideas, 'Backtest before simulated paper trading.'),
      source: 'ai_watchlist_scanner',
      links: [],
      metadata: {
        ai_trade_idea: parsed,
        scanner_row: row.scanner_row || null,
        score: row.score,
        no_live_orders: true,
        simulated_only: true,
      },
    };
  }

  async function saveCandidate(row) {
    setStatus(`Saving ${row.symbol} AI watchlist idea...`);
    const result = await post('/api/ideas', ideaPayload(row));
    const ideaId = result?.idea?.id || result?.record?.id || result?.id || result?.event?.id || result?.payload?.id || '';
    if ($('ideaId') && ideaId) $('ideaId').value = ideaId;
    setStatus(ideaId ? `Saved ${row.symbol} as research idea ${ideaId}.` : `Saved ${row.symbol} as research idea.`);
    print(result, 'ideas');
    return result;
  }

  function normalizeBacktestInterval(timeframe) {
    const value = String(timeframe || '').toLowerCase();
    if (value === '1d' || value === '1day') return '1d';
    if (value === '1w' || value === '1week') return '1wk';
    if (['1m', '5m', '15m', '30m', '60m', '1h'].includes(value)) return value === '1h' ? '60m' : value;
    return '1d';
  }

  async function backtestCandidate(row) {
    setStatus(`Running linked backtest for ${row.symbol}...`);
    const tradeIdea = row.parsed?.trade_idea || {};
    const result = await post('/api/backtest/run', {
      symbol: row.symbol,
      strategy: $('strategy')?.value || 'ema_cross',
      period: $('period')?.value || '1y',
      initial_capital: 10000,
      commission_pct: 0.1,
      slippage_pct: 0.05,
      interval: normalizeBacktestInterval(row.timeframe),
      include_trade_log: true,
      include_equity_curve: true,
      idea_id: $('ideaId')?.value || null,
      notes: `AI watchlist scanner backtest: ${textOf(tradeIdea.setup_type || row.parsed?.summary, '')}`,
    });
    setStatus(`Backtest completed for ${row.symbol}.`);
    print(result, 'backtests');
    return result;
  }

  function prefillPaperCandidate(row) {
    const tradeIdea = row.parsed?.trade_idea || {};
    const direction = String(tradeIdea.direction || '').toLowerCase();
    if ($('paperSymbol')) $('paperSymbol').value = row.symbol;
    if ($('paperAssetType')) $('paperAssetType').value = row.asset_type;
    if ($('paperSide') && ['long', 'buy'].includes(direction)) $('paperSide').value = 'buy';
    if ($('paperSide') && ['short', 'sell'].includes(direction)) $('paperSide').value = 'sell';
    if ($('paperOrderType')) $('paperOrderType').value = 'limit';
    if ($('paperIdeaId')) $('paperIdeaId').value = $('ideaId')?.value || '';
    if ($('paperNotes')) $('paperNotes').value = `AI watchlist scanner idea: ${textOf(tradeIdea.setup_type || row.parsed?.summary, '')}`;
    setStatus(`${row.symbol} copied into simulated paper ticket. Set quantity/price and review before submitting.`);
    if (typeof window.showResultPane === 'function') window.showResultPane('paper');
  }

  function setStatus(message) {
    const status = $('aiWatchlistScannerStatus');
    if (status) status.textContent = message;
  }

  function addControls() {
    const scannerButtons = document.querySelector('[data-action="scanner.scan"]')?.parentElement;
    if (!scannerButtons || $('aiWatchlistScanButton')) return;
    const maxInput = document.createElement('input');
    maxInput.id = 'aiWatchlistScanMax';
    maxInput.type = 'number';
    maxInput.min = '1';
    maxInput.max = '12';
    maxInput.value = '5';
    maxInput.title = 'Maximum symbols for AI watchlist scan';
    maxInput.className = 'level-input ai-watchlist-max';
    scannerButtons.appendChild(maxInput);
    const button = document.createElement('button');
    button.id = 'aiWatchlistScanButton';
    button.type = 'button';
    button.className = 'secondary';
    button.textContent = 'AI scan watchlist';
    button.addEventListener('click', () => scanWatchlistWithAi().catch((error) => {
      state.running = false;
      setStatus(String(error?.message || error));
      print(String(error?.message || error), 'scanner');
    }));
    scannerButtons.appendChild(button);
    const status = document.createElement('div');
    status.id = 'aiWatchlistScannerStatus';
    status.className = 'module-control-status';
    status.textContent = 'AI watchlist scan ranks possible research setups and no-trade results. Simulated/paper only.';
    scannerButtons.parentElement.appendChild(status);
  }

  function addStyles() {
    if ($('aiWatchlistScannerStyles')) return;
    const style = document.createElement('style');
    style.id = 'aiWatchlistScannerStyles';
    style.textContent = '.ai-watchlist-max{width:54px}.ai-watchlist-scanner{display:grid;gap:10px;white-space:normal}.ai-watchlist-header{display:flex;justify-content:space-between;gap:8px;align-items:flex-start}.ai-watchlist-badge{border:1px solid #334155;border-radius:999px;padding:4px 8px;background:#111827;color:#bfdbfe;font-size:12px}.ai-watchlist-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:9px}.ai-watchlist-card{border:1px solid #334155;border-radius:10px;background:#0b1220;padding:10px;display:grid;gap:8px}.ai-watchlist-card.no-trade{border-color:#f59e0b}.ai-watchlist-card.error{border-color:#ef4444}.ai-watchlist-title{display:flex;justify-content:space-between;gap:8px;align-items:flex-start}.ai-watchlist-title span{display:block;color:#94a3b8;font-size:11px}.ai-watchlist-title em{font-style:normal;border:1px solid #334155;border-radius:999px;padding:3px 7px;font-size:11px;text-transform:capitalize}.ai-watchlist-mini-grid{display:grid;grid-template-columns:1fr 1fr;gap:5px}.ai-watchlist-mini-grid div{border:1px solid #1e293b;border-radius:7px;padding:5px;background:#080d18}.ai-watchlist-mini-grid span{display:block;color:#94a3b8;font-size:10px;text-transform:uppercase;letter-spacing:.05em}.ai-watchlist-mini-grid b{font-size:11px;white-space:pre-wrap}.ai-watchlist-warning{border:1px solid #f59e0b;border-radius:8px;padding:7px;background:rgba(245,158,11,.12);font-size:12px}.ai-watchlist-actions{display:flex;gap:6px;flex-wrap:wrap}.ai-watchlist-actions button{font-size:12px;padding:5px 7px}.ai-watchlist-card details{font-size:12px}.ai-watchlist-card ul{margin:5px 0 0 18px;padding:0}';
    document.head.appendChild(style);
  }

  function bootAiWatchlistScanner() {
    if (window.workstationModuleGuard) {
      window.workstationModuleGuard.check('aiWatchlistScanner', {
        globals: ['post', 'print'],
        selectors: ['#watch', '#tf', '#resultPane-scanner'],
      });
    }
    addStyles();
    addControls();
  }

  window.scanWatchlistWithAi = scanWatchlistWithAi;
  window.renderAiWatchlistScannerResults = renderResults;

  if (window.workstationBoot) window.workstationBoot.register('ai-watchlist-scanner', bootAiWatchlistScanner);
  else if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bootAiWatchlistScanner);
  else bootAiWatchlistScanner();
})();
