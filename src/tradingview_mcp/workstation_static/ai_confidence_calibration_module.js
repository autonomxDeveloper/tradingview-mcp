(function() {
  const STORAGE_KEY = 'workstation.aiConfidenceCalibration.v1';
  const MAX_EVENTS = 240;
  const state = {
    lastIdea: null,
    lastIdeaSignature: '',
    lastBacktestSignature: '',
    lastJournalSignature: '',
  };

  function $(id) { return document.getElementById(id); }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function textOf(value, fallback = '') {
    if (value === null || value === undefined || value === '') return fallback;
    if (Array.isArray(value)) return value.length ? value.join(', ') : fallback;
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  }

  function readStore() {
    try {
      const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '');
      if (parsed && Array.isArray(parsed.events)) return parsed;
    } catch (_) {}
    return { version: 1, events: [] };
  }

  function writeStore(store) {
    const normalized = { version: 1, events: (store.events || []).slice(-MAX_EVENTS) };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
    return normalized;
  }

  function currentContext() {
    if (typeof window.collectTradeIdeaContext === 'function') return window.collectTradeIdeaContext();
    return {
      chart: {
        symbol: $('symbol')?.value || '',
        asset_type: $('asset')?.value || '',
        exchange: $('exchange')?.value || '',
        timeframe: $('tf')?.value || '',
      },
      profile: $('aiTradeIdeaProfile')?.value || 'swing',
    };
  }

  function normalizeDirection(value) {
    const normalized = String(value || '').toLowerCase().replace(/\s+/g, '_');
    if (['long', 'buy', 'bullish'].includes(normalized)) return 'long';
    if (['short', 'sell', 'bearish'].includes(normalized)) return 'short';
    return 'no_trade';
  }

  function normalizeConfidence(value) {
    const normalized = String(value || '').toLowerCase();
    return ['low', 'medium', 'high'].includes(normalized) ? normalized : 'low';
  }

  function normalizeSetup(value) {
    return String(value || 'unspecified').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'unspecified';
  }

  function ideaDimensions(parsed, context = currentContext()) {
    const tradeIdea = parsed?.trade_idea || parsed?.tradeIdea || parsed?.trade_plan || {};
    return {
      symbol: String(context?.chart?.symbol || $('symbol')?.value || '').toUpperCase(),
      asset_type: String(context?.chart?.asset_type || $('asset')?.value || 'unknown').toLowerCase(),
      timeframe: String(context?.chart?.timeframe || $('tf')?.value || 'unknown').toLowerCase(),
      profile: String(context?.profile || $('aiTradeIdeaProfile')?.value || 'swing').toLowerCase(),
      setup_type: normalizeSetup(tradeIdea.setup_type || parsed?.setup_type),
      confidence: normalizeConfidence(parsed?.confidence || tradeIdea.confidence),
      direction: normalizeDirection(tradeIdea.direction || parsed?.direction),
      bias: String(tradeIdea.bias || parsed?.trend || 'unknown').toLowerCase(),
    };
  }

  function groupKey(dimensions, mode = 'setup') {
    if (!dimensions) return 'unknown';
    if (mode === 'profile_confidence') return [dimensions.profile, dimensions.confidence].join('|');
    return [dimensions.profile, dimensions.setup_type, dimensions.confidence, dimensions.direction].join('|');
  }

  function eventSignature(type, payload) {
    const stable = JSON.stringify(payload || {}).slice(0, 1000);
    let hash = 0;
    for (let index = 0; index < stable.length; index += 1) {
      hash = ((hash << 5) - hash + stable.charCodeAt(index)) | 0;
    }
    return `${type}:${hash}`;
  }

  function recordEvent(type, payload, signature) {
    const store = readStore();
    const finalSignature = signature || eventSignature(type, payload);
    if (store.events.some((event) => event.signature === finalSignature)) return null;
    const event = {
      type,
      signature: finalSignature,
      recorded_at: new Date().toISOString(),
      ...payload,
    };
    store.events.push(event);
    writeStore(store);
    renderCalibrationPanel();
    if (state.lastIdea?.parsed) renderCalibrationHint(state.lastIdea.parsed);
    return event;
  }

  function recordIdea(parsed, context = currentContext()) {
    if (!parsed || typeof parsed !== 'object') return null;
    const dimensions = ideaDimensions(parsed, context);
    const tradeIdea = parsed.trade_idea || {};
    const signature = eventSignature('idea_generated', {
      dimensions,
      summary: textOf(parsed.summary, '').slice(0, 180),
      invalidation: textOf(tradeIdea.stop_or_invalidation || parsed.invalidation, '').slice(0, 140),
    });
    if (signature === state.lastIdeaSignature) return null;
    state.lastIdeaSignature = signature;
    state.lastIdea = { parsed, context, dimensions };
    window.aiConfidenceCalibrationState.lastIdea = state.lastIdea;
    return recordEvent('idea_generated', {
      dimensions,
      group_key: groupKey(dimensions),
      profile_confidence_key: groupKey(dimensions, 'profile_confidence'),
      paper_trade_candidate: tradeIdea.paper_trade_candidate !== false && dimensions.direction !== 'no_trade',
      no_trade: dimensions.direction === 'no_trade',
      confidence: dimensions.confidence,
      setup_type: dimensions.setup_type,
      direction: dimensions.direction,
      summary: textOf(parsed.summary, '').slice(0, 260),
    }, signature);
  }

  function normalizeBacktestVerdict(value) {
    const verdict = String(value || '').toLowerCase();
    if (['supports', 'weakens', 'needs_review', 'no_trade'].includes(verdict)) return verdict;
    return 'needs_review';
  }

  function recordBacktestReview(latest) {
    if (!latest || !latest.review) return null;
    const review = latest.review;
    const dimensions = state.lastIdea?.dimensions || ideaDimensions({}, currentContext());
    const metrics = review.metrics || {};
    const verdict = normalizeBacktestVerdict(review.verdict);
    const signature = eventSignature('backtest_review', {
      dimensions,
      verdict,
      metrics,
      summary: textOf(review.summary, '').slice(0, 200),
    });
    if (signature === state.lastBacktestSignature) return null;
    state.lastBacktestSignature = signature;
    return recordEvent('backtest_review', {
      dimensions,
      group_key: groupKey(dimensions),
      profile_confidence_key: groupKey(dimensions, 'profile_confidence'),
      verdict,
      supports: verdict === 'supports',
      weakens: verdict === 'weakens' || verdict === 'no_trade',
      needs_review: verdict === 'needs_review',
      metrics,
      paper_trade_candidate: review.paper_trade_candidate === true,
      summary: textOf(review.summary, '').slice(0, 260),
    }, signature);
  }

  function normalizeJournalVerdict(value) {
    const verdict = String(value || '').toLowerCase();
    if (['followed_plan', 'needs_review', 'rule_violation', 'insufficient_context'].includes(verdict)) return verdict;
    return 'needs_review';
  }

  function recordJournalReview(coachState) {
    if (!coachState || !coachState.lastReview) return null;
    const review = coachState.lastReview;
    const dimensions = state.lastIdea?.dimensions || ideaDimensions({}, currentContext());
    const verdict = normalizeJournalVerdict(review.review_verdict || review.verdict);
    const orderId = coachState.lastContext?.reviewed_order?.id || coachState.lastContext?.reviewed_order?.order_id || '';
    const fillId = coachState.lastContext?.reviewed_fill?.id || coachState.lastContext?.reviewed_fill?.fill_id || '';
    const signature = eventSignature('journal_review', {
      dimensions,
      verdict,
      orderId,
      fillId,
      summary: textOf(review.journal_summary || review.summary, '').slice(0, 220),
    });
    if (signature === state.lastJournalSignature) return null;
    state.lastJournalSignature = signature;
    return recordEvent('journal_review', {
      dimensions,
      group_key: groupKey(dimensions),
      profile_confidence_key: groupKey(dimensions, 'profile_confidence'),
      verdict,
      followed_plan: verdict === 'followed_plan',
      rule_violation: verdict === 'rule_violation',
      needs_review: verdict === 'needs_review' || verdict === 'insufficient_context',
      summary: textOf(review.journal_summary || review.summary, '').slice(0, 260),
    }, signature);
  }

  function summarize(events = readStore().events) {
    const summary = new Map();
    for (const event of events || []) {
      const keys = [event.group_key, event.profile_confidence_key].filter(Boolean);
      for (const key of keys) {
        if (!summary.has(key)) {
          summary.set(key, {
            key,
            ideas: 0,
            candidates: 0,
            no_trades: 0,
            backtests: 0,
            supports: 0,
            weakens: 0,
            needs_review: 0,
            journals: 0,
            followed_plan: 0,
            rule_violations: 0,
            last_seen: '',
          });
        }
        const row = summary.get(key);
        if (event.type === 'idea_generated') {
          row.ideas += 1;
          if (event.paper_trade_candidate) row.candidates += 1;
          if (event.no_trade) row.no_trades += 1;
        }
        if (event.type === 'backtest_review') {
          row.backtests += 1;
          if (event.supports) row.supports += 1;
          if (event.weakens) row.weakens += 1;
          if (event.needs_review) row.needs_review += 1;
        }
        if (event.type === 'journal_review') {
          row.journals += 1;
          if (event.followed_plan) row.followed_plan += 1;
          if (event.rule_violation) row.rule_violations += 1;
          if (event.needs_review) row.needs_review += 1;
        }
        row.last_seen = event.recorded_at || row.last_seen;
      }
    }
    return summary;
  }

  function calibrationRowsFor(dimensions) {
    const rows = summarize(readStore().events);
    const exact = rows.get(groupKey(dimensions));
    const profile = rows.get(groupKey(dimensions, 'profile_confidence'));
    return { exact, profile };
  }

  function reliabilityText(row) {
    if (!row || (!row.backtests && !row.journals)) return 'No outcome history yet.';
    const parts = [];
    if (row.backtests) parts.push(`${row.supports}/${row.backtests} supportive backtests`);
    if (row.journals) parts.push(`${row.followed_plan}/${row.journals} followed-plan journal reviews`);
    if (row.rule_violations) parts.push(`${row.rule_violations} rule violation${row.rule_violations === 1 ? '' : 's'}`);
    return parts.join(' · ') || 'Outcome history is inconclusive.';
  }

  function reliabilityClass(row) {
    if (!row || (!row.backtests && !row.journals)) return 'needs_review';
    if (row.rule_violations > 0 || row.weakens > row.supports) return 'weak';
    if (row.supports >= 2 || row.followed_plan >= 2) return 'strong';
    return 'needs_review';
  }

  function renderCalibrationHint(parsed) {
    const tradeCard = document.querySelector('#aiTradeIdeaCard .ai-trade-card');
    if (!tradeCard || !parsed) return;
    const old = $('aiConfidenceCalibrationHint');
    if (old) old.remove();
    const dimensions = state.lastIdea?.parsed === parsed ? state.lastIdea.dimensions : ideaDimensions(parsed, currentContext());
    const { exact, profile } = calibrationRowsFor(dimensions);
    const best = exact && (exact.backtests || exact.journals || exact.ideas > 1) ? exact : profile;
    const css = reliabilityClass(best);
    const hint = document.createElement('div');
    hint.id = 'aiConfidenceCalibrationHint';
    hint.className = `ai-confidence-hint ${css}`;
    hint.innerHTML = `
      <div class="label">AI confidence calibration</div>
      <p><b>${escapeHtml(reliabilityText(best))}</b></p>
      <p class="muted">Matched on ${exact === best ? 'profile + setup + confidence + direction' : 'profile + confidence'} from local workstation history. Use this as process feedback, not a prediction.</p>
    `;
    const actions = tradeCard.querySelector('.ai-trade-actions');
    if (actions) tradeCard.insertBefore(hint, actions);
    else tradeCard.appendChild(hint);
  }

  function topRows(limit = 5) {
    return [...summarize(readStore().events).values()]
      .filter((row) => row.ideas || row.backtests || row.journals)
      .sort((a, b) => (b.backtests + b.journals + b.ideas) - (a.backtests + a.journals + a.ideas))
      .slice(0, limit);
  }

  function renderCalibrationPanel() {
    const panel = ensurePanel();
    const store = readStore();
    const rows = topRows(6);
    const totalBacktests = store.events.filter((event) => event.type === 'backtest_review').length;
    const totalJournals = store.events.filter((event) => event.type === 'journal_review').length;
    const totalIdeas = store.events.filter((event) => event.type === 'idea_generated').length;
    const rowHtml = rows.length ? rows.map((row) => `
      <tr>
        <td>${escapeHtml(row.key.replace(/\|/g, ' · '))}</td>
        <td>${row.ideas}</td>
        <td>${row.supports}/${row.backtests}</td>
        <td>${row.followed_plan}/${row.journals}</td>
        <td>${row.rule_violations}</td>
      </tr>
    `).join('') : '<tr><td colspan="5" class="muted">Generate trade ideas, run backtest reviews, and journal paper trades to build local calibration history.</td></tr>';
    panel.innerHTML = `
      <div class="label">AI confidence calibration</div>
      <p class="workflow-note">Local-only calibration from this browser: ${totalIdeas} ideas · ${totalBacktests} backtest reviews · ${totalJournals} journal reviews.</p>
      <table class="ai-calibration-table">
        <thead><tr><th>Group</th><th>Ideas</th><th>Support</th><th>Followed</th><th>Violations</th></tr></thead>
        <tbody>${rowHtml}</tbody>
      </table>
      <div class="ai-calibration-actions">
        <button type="button" class="secondary" id="refreshAiCalibrationButton">Refresh calibration</button>
        <button type="button" class="secondary" id="printAiCalibrationButton">Print calibration</button>
        <button type="button" class="secondary" id="clearAiCalibrationButton">Clear local history</button>
      </div>
    `;
    $('refreshAiCalibrationButton')?.addEventListener('click', () => {
      ingestLatestOutcomeExports();
      renderCalibrationPanel();
      if (state.lastIdea?.parsed) renderCalibrationHint(state.lastIdea.parsed);
    });
    $('printAiCalibrationButton')?.addEventListener('click', () => {
      if (typeof window.print === 'function') window.print({ ai_confidence_calibration: readStore(), summary: Object.fromEntries(summarize(readStore().events)) }, 'analysis');
    });
    $('clearAiCalibrationButton')?.addEventListener('click', () => {
      if (!window.confirm('Clear local AI calibration history for this browser?')) return;
      writeStore({ version: 1, events: [] });
      renderCalibrationPanel();
      if (state.lastIdea?.parsed) renderCalibrationHint(state.lastIdea.parsed);
    });
  }

  function ensurePanel() {
    let panel = $('aiConfidenceCalibrationPanel');
    if (panel) return panel;
    panel = document.createElement('div');
    panel.id = 'aiConfidenceCalibrationPanel';
    panel.className = 'ai-confidence-calibration-panel';
    const status = $('aiTradeIdeaStatus');
    if (status) status.insertAdjacentElement('afterend', panel);
    else document.querySelector('.analysis-results-panel')?.appendChild(panel) || document.body.appendChild(panel);
    return panel;
  }

  function addStyles() {
    if ($('aiConfidenceCalibrationStyles')) return;
    const style = document.createElement('style');
    style.id = 'aiConfidenceCalibrationStyles';
    style.textContent = '.ai-confidence-calibration-panel{margin-top:8px;border:1px solid #1e293b;border-radius:10px;background:#080d18;padding:8px;display:grid;gap:7px}.ai-calibration-table{width:100%;border-collapse:collapse;font-size:11px}.ai-calibration-table th,.ai-calibration-table td{border-bottom:1px solid #1e293b;padding:4px;text-align:left;vertical-align:top}.ai-calibration-actions{display:flex;gap:6px;flex-wrap:wrap}.ai-calibration-actions button{font-size:12px;padding:5px 7px}.ai-confidence-hint{border:1px solid #334155;border-radius:9px;background:#080d18;padding:8px;font-size:12px;line-height:1.45}.ai-confidence-hint p{margin:4px 0}.ai-confidence-hint.strong{border-color:#22c55e}.ai-confidence-hint.weak{border-color:#ef4444}.ai-confidence-hint.needs_review{border-color:#f59e0b}';
    document.head.appendChild(style);
  }

  function patchTradeIdeaRenderer() {
    if (window.__aiConfidenceCalibrationRendererPatched) return true;
    if (typeof window.renderTradeIdeaCard !== 'function') return false;
    const original = window.renderTradeIdeaCard;
    window.renderTradeIdeaCard = function patchedConfidenceRenderTradeIdeaCard(parsed, response, ...rest) {
      const result = original.call(this, parsed, response, ...rest);
      window.setTimeout(() => {
        recordIdea(parsed, currentContext());
        renderCalibrationHint(parsed);
      }, 0);
      return result;
    };
    window.__aiConfidenceCalibrationRendererPatched = true;
    return true;
  }

  function ingestLatestOutcomeExports() {
    try {
      if (typeof window.lastAiBacktestReview === 'function') recordBacktestReview(window.lastAiBacktestReview());
    } catch (_) {}
    try {
      recordJournalReview(window.aiTradeJournalCoachState);
    } catch (_) {}
  }

  function startOutcomePolling() {
    window.setInterval(ingestLatestOutcomeExports, 2500);
  }

  function bootAiConfidenceCalibration() {
    if (window.workstationModuleGuard) {
      window.workstationModuleGuard.check('aiConfidenceCalibration', {
        globals: ['print'],
        selectors: ['#symbol', '#asset', '#tf'],
      });
    }
    addStyles();
    renderCalibrationPanel();
    if (!patchTradeIdeaRenderer()) {
      let attempts = 0;
      const timer = window.setInterval(() => {
        attempts += 1;
        if (patchTradeIdeaRenderer() || attempts > 50) window.clearInterval(timer);
      }, 100);
    }
    startOutcomePolling();
  }

  window.aiConfidenceCalibrationState = {
    lastIdea: null,
    readStore,
    summarize: () => Object.fromEntries(summarize(readStore().events)),
    recordIdea,
    recordBacktestReview,
    recordJournalReview,
    refresh: () => {
      ingestLatestOutcomeExports();
      renderCalibrationPanel();
      if (state.lastIdea?.parsed) renderCalibrationHint(state.lastIdea.parsed);
      return readStore();
    },
  };

  if (window.workstationBoot) window.workstationBoot.register('ai-confidence-calibration', bootAiConfidenceCalibration);
  else if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bootAiConfidenceCalibration);
  else bootAiConfidenceCalibration();
})();
