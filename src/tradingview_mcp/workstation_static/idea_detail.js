let workstationIdeas = [];
let workstationSelectedIdea = null;

async function loadIdeas() {
  const statusFilter = document.getElementById('ideaStatusFilter')?.value || '';
  const query = statusFilter ? `?status=${encodeURIComponent(statusFilter)}&limit=100` : '?limit=100';
  const response = await api('/api/ideas' + query);
  workstationIdeas = response.ideas || [];
  const rows = workstationIdeas.map((idea, index) => ({
    index: index + 1,
    id: idea.id,
    symbol: idea.symbol,
    timeframe: idea.timeframe,
    status: idea.status,
    hypothesis: idea.hypothesis,
  }));
  print({ ideas: rows, dashboard: ideaStatusDashboard(workstationIdeas), hint: 'Use loadIdeaDetail(1), loadWorkspaceIdea(1), or setSelectedIdeaStatus("watching").' });
  if (workstationIdeas.length) loadIdeaDetail(1);
}

function ideaStatusDashboard(ideas = workstationIdeas) {
  const statuses = ['draft', 'watching', 'invalidated', 'backtested', 'archived'];
  const counts = Object.fromEntries(statuses.map((status) => [status, 0]));
  ideas.forEach((idea) => { counts[idea.status] = (counts[idea.status] || 0) + 1; });
  return { total: ideas.length, counts };
}

async function showIdeaDashboard() {
  const response = await api('/api/ideas?limit=500');
  const ideas = response.ideas || [];
  print({ idea_lifecycle_dashboard: ideaStatusDashboard(ideas), recent: ideas.slice(-10).map((idea) => ({ id: idea.id, symbol: idea.symbol, status: idea.status, updated_at_utc: idea.updated_at_utc })) });
}

async function loadIdeaDetail(index = 1) {
  const idea = workstationIdeas[Math.max(0, Number(index) - 1)];
  if (!idea) { print('No idea found for that index.'); return; }
  workstationSelectedIdea = idea;
  let backtests = [];
  try {
    const response = await api(`/api/backtests?idea_id=${encodeURIComponent(idea.id)}&limit=20`);
    backtests = response.records || [];
  } catch (_) { backtests = []; }
  print({ selected_idea: idea, linked_backtests: backtests, actions: ['loadWorkspaceIdea()', 'setSelectedIdeaStatus("watching")', 'runBacktest()', 'loadJournal()'] });
}

function loadWorkspaceIdea(index) {
  const idea = Number.isFinite(Number(index)) ? workstationIdeas[Math.max(0, Number(index) - 1)] : workstationSelectedIdea;
  if (!idea) { print('Load ideas first, then select an idea.'); return; }
  $('symbol').value = idea.symbol || $('symbol').value;
  $('tf').value = idea.timeframe || $('tf').value;
  $('asset').value = idea.asset_type === 'crypto' ? 'crypto' : 'stock';
  $('exchange').value = idea.asset_type === 'crypto' ? 'BINANCE' : 'NASDAQ';
  $('hypothesis').value = idea.hypothesis || '';
  $('invalidation').value = idea.invalidation || '';
  $('backtestPlan').value = idea.backtest_plan || '';
  $('ideaId').value = idea.id || '';
  print({ loaded_into_workspace: idea.id, symbol: idea.symbol });
  loadMarket();
}

async function setSelectedIdeaStatus(status) {
  const ideaId = $('ideaId').value || workstationSelectedIdea?.id;
  if (!ideaId) { print('Load or select an idea first.'); return; }
  const note = document.getElementById('ideaStatusNote')?.value || '';
  const event = await post('/api/ideas/status', { idea_id: ideaId, status, note });
  print({ lifecycle_update: event });
  await loadIdeas();
}

function ensureDataBadges() {
  let badges = document.getElementById('dataBadges');
  if (badges) return badges;
  badges = document.createElement('span');
  badges.id = 'dataBadges';
  badges.className = 'data-badges';
  const chartMeta = document.getElementById('chartMeta');
  if (chartMeta && chartMeta.parentNode) chartMeta.parentNode.insertBefore(badges, chartMeta.nextSibling);
  return badges;
}

function renderDataBadges() {
  const badges = ensureDataBadges();
  const metadata = lastPayload?.metadata || {};
  const source = metadata.source || lastPayload?.source || (activeIsCrypto() ? 'binance' : 'yahoo');
  const freshness = metadata.stale ? 'stale' : 'fresh';
  const cache = metadata.cache_status || 'request';
  const venue = activeIsCrypto() ? 'binance' : $('exchange').value;
  badges.innerHTML = `<span class="data-badge">source ${source}</span><span class="data-badge">cache ${cache}</span><span class="data-badge ${metadata.stale ? 'warn' : 'ok'}">${freshness}</span><span class="data-badge">venue ${venue}</span>`;
}

async function loadPortfolioResearch() {
  const positions = await api('/api/alpaca/positions');
  const ideas = await api('/api/ideas?limit=200');
  const ideaRows = ideas.ideas || [];
  const rawPositions = positions.positions || positions || [];
  if (positions.error) { print({ portfolio_error: positions.error, note: 'Read-only portfolio panel needs Alpaca credentials.' }); return; }
  const rows = (Array.isArray(rawPositions) ? rawPositions : []).map((position) => {
    const symbol = String(position.symbol || '').toUpperCase();
    const linked = ideaRows.filter((idea) => String(idea.symbol || '').toUpperCase() === symbol);
    return { symbol, qty: position.qty, market_value: position.market_value, ideas: linked.length, statuses: linked.map((idea) => idea.status) };
  });
  print({ portfolio_research: rows, mode: 'read_only', actions: ['select symbol', 'loadIdeas()', 'saveIdea()'] });
}

function journalFilterValue(id) {
  return (document.getElementById(id)?.value || '').trim().toUpperCase();
}

async function loadJournalTimeline(options = {}) {
  const response = await api('/api/journal?limit=100');
  const events = response.events || [];
  const symbolFilter = options.currentSymbol ? ($('symbol').value || '').trim().toUpperCase() : journalFilterValue('journalSymbolFilter');
  const typeFilter = journalFilterValue('journalTypeFilter').toLowerCase();
  const ideaFilter = journalFilterValue('journalIdeaFilter');
  const rows = events.map((event, index) => ({
    index: index + 1,
    time: event.timestamp_utc || event.timestamp || '',
    type: event.event_type || event.type || 'event',
    symbol: String(event.payload?.symbol || event.payload?.request?.symbol || '').toUpperCase(),
    idea_id: String(event.payload?.idea_id || event.payload?.id || '').toUpperCase(),
    summary: JSON.stringify(event.payload || event).slice(0, 220),
  })).filter((row) => {
    if (symbolFilter && row.symbol !== symbolFilter) return false;
    if (typeFilter && !String(row.type || '').toLowerCase().includes(typeFilter)) return false;
    if (ideaFilter && row.idea_id !== ideaFilter) return false;
    return true;
  });
  print({ journal_timeline: rows, filters: { symbol: symbolFilter, event_type: typeFilter, idea_id: ideaFilter }, mode: 'research_only' });
}

function watchlistSymbols() {
  return [...document.querySelectorAll('#watch button')].map((button) => button.textContent.trim()).filter(Boolean);
}

async function refreshWatchlist() {
  const response = await api('/api/watchlist');
  const watch = document.getElementById('watch');
  watch.innerHTML = '';
  (response.symbols || []).forEach((symbol) => {
    const button = document.createElement('button');
    button.textContent = symbol;
    button.onclick = () => {
      $('symbol').value = symbol;
      if (symbol.includes('USDT')) { $('asset').value = 'crypto'; $('exchange').value = 'BINANCE'; }
      else { $('asset').value = 'stock'; $('exchange').value = 'NASDAQ'; }
      loadMarket();
    };
    watch.appendChild(button);
  });
  return response.symbols || [];
}

async function saveWatchlistSymbols(symbols) {
  const clean = [...new Set(symbols.map((symbol) => String(symbol || '').trim().toUpperCase()).filter(Boolean))];
  await post('/api/watchlist', { symbols: clean });
  await refreshWatchlist();
  print({ watchlist_saved: clean });
}

async function addWatchlistSymbol() {
  const input = document.getElementById('watchlistSymbolInput');
  const symbol = (input?.value || $('symbol').value || '').trim().toUpperCase();
  if (!symbol) { print('Enter a symbol to add.'); return; }
  await saveWatchlistSymbols([...watchlistSymbols(), symbol]);
  if (input) input.value = '';
}

async function removeWatchlistSymbol() {
  const symbol = ($('symbol').value || '').trim().toUpperCase();
  if (!symbol) { print('Select a symbol to remove.'); return; }
  await saveWatchlistSymbols(watchlistSymbols().filter((item) => item !== symbol));
}

function addWatchlistControls() {
  const watch = document.getElementById('watch');
  if (!watch || document.getElementById('watchlistControls')) return;
  const controls = document.createElement('div');
  controls.id = 'watchlistControls';
  controls.className = 'watchlist-controls';
  controls.innerHTML = '<input id="watchlistSymbolInput" placeholder="symbol" /><button>Add</button><button>Remove selected</button><button>Refresh</button>';
  const buttons = controls.querySelectorAll('button');
  buttons[0].onclick = addWatchlistSymbol;
  buttons[1].onclick = removeWatchlistSymbol;
  buttons[2].onclick = refreshWatchlist;
  watch.parentNode.insertBefore(controls, watch);
}

function addJournalFilters() {
  const tabs = document.querySelector('.bottom .tabs');
  if (!tabs || document.getElementById('journalFilters')) return;
  const controls = document.createElement('span');
  controls.id = 'journalFilters';
  controls.className = 'journal-filters';
  controls.innerHTML = '<input id="journalSymbolFilter" placeholder="symbol" /><input id="journalTypeFilter" placeholder="event type" /><input id="journalIdeaFilter" placeholder="idea id" /><button>Current symbol</button>';
  controls.querySelector('button').onclick = () => loadJournalTimeline({ currentSymbol: true });
  tabs.appendChild(controls);
}

function addIdeaStatusFilters() {
  const tabs = document.querySelector('.bottom .tabs');
  if (!tabs || document.getElementById('ideaStatusControls')) return;
  const controls = document.createElement('span');
  controls.id = 'ideaStatusControls';
  controls.className = 'idea-status-controls';
  controls.innerHTML = '<select id="ideaStatusFilter"><option value="">all ideas</option><option>draft</option><option>watching</option><option>invalidated</option><option>backtested</option><option>archived</option></select><button>Filter ideas</button><button>Idea dashboard</button>';
  const buttons = controls.querySelectorAll('button');
  buttons[0].onclick = loadIdeas;
  buttons[1].onclick = showIdeaDashboard;
  tabs.appendChild(controls);
}

function addIdeaLifecycleControls() {
  const ideaIdInput = document.getElementById('ideaId');
  if (!ideaIdInput || document.getElementById('ideaLifecycleControls')) return;
  const controls = document.createElement('div');
  controls.id = 'ideaLifecycleControls';
  controls.className = 'idea-lifecycle-controls';
  controls.innerHTML = '<input id="ideaStatusNote" placeholder="status note" /><button>Watching</button><button>Invalidated</button><button>Backtested</button><button>Archived</button>';
  const buttons = controls.querySelectorAll('button');
  buttons[0].onclick = () => setSelectedIdeaStatus('watching');
  buttons[1].onclick = () => setSelectedIdeaStatus('invalidated');
  buttons[2].onclick = () => setSelectedIdeaStatus('backtested');
  buttons[3].onclick = () => setSelectedIdeaStatus('archived');
  ideaIdInput.parentNode.insertBefore(controls, ideaIdInput.nextSibling);
}

async function saveServerDrawings() {
  await post('/api/drawings', { symbol: $('symbol').value, timeframe: $('tf').value, drawings });
  const status = document.getElementById('drawingSyncStatus');
  if (status) status.textContent = 'drawings saved';
}

async function loadServerDrawings() {
  const response = await api(`/api/drawings?symbol=${encodeURIComponent($('symbol').value)}&timeframe=${encodeURIComponent($('tf').value)}`);
  drawings = { ...emptyDrawings(), ...(response.drawings || {}) };
  localStorage.setItem(drawingStorageKey(), JSON.stringify(drawings));
  renderDrawings();
  const status = document.getElementById('drawingSyncStatus');
  if (status) status.textContent = 'drawings loaded';
}

async function clearServerDrawings() {
  drawings = emptyDrawings();
  localStorage.setItem(drawingStorageKey(), JSON.stringify(drawings));
  renderDrawings();
  await saveServerDrawings();
  const status = document.getElementById('drawingSyncStatus');
  if (status) status.textContent = 'server drawings cleared';
}

function addDrawingControls() {
  const tabs = document.querySelector('.bottom .tabs');
  if (!tabs || document.getElementById('drawingControls')) return;
  const controls = document.createElement('span');
  controls.id = 'drawingControls';
  controls.className = 'drawing-controls';
  controls.innerHTML = '<button>Load drawings</button><button>Save drawings</button><button>Clear server drawings</button><span id="drawingSyncStatus">drawings local+server</span>';
  const buttons = controls.querySelectorAll('button');
  buttons[0].onclick = loadServerDrawings;
  buttons[1].onclick = saveServerDrawings;
  buttons[2].onclick = clearServerDrawings;
  tabs.appendChild(controls);
}

function addExtraButtons() {
  const tabs = document.querySelector('.bottom .tabs');
  if (!tabs) return;
  if (!document.getElementById('portfolioResearchButton')) {
    const button = document.createElement('button');
    button.id = 'portfolioResearchButton';
    button.textContent = 'Portfolio';
    button.onclick = loadPortfolioResearch;
    tabs.appendChild(button);
  }
  if (!document.getElementById('journalTimelineButton')) {
    const button = document.createElement('button');
    button.id = 'journalTimelineButton';
    button.textContent = 'Timeline';
    button.onclick = loadJournalTimeline;
    tabs.appendChild(button);
  }
}

const originalMeta = window.updateChartMeta;
window.updateChartMeta = function() {
  if (originalMeta) originalMeta();
  renderDataBadges();
};

const originalPersistDrawings = window.persistDrawings;
window.persistDrawings = function() {
  if (originalPersistDrawings) originalPersistDrawings();
  post('/api/drawings', { symbol: $('symbol').value, timeframe: $('tf').value, drawings })
    .then(() => { const status = document.getElementById('drawingSyncStatus'); if (status) status.textContent = 'drawings autosaved'; })
    .catch(() => { const status = document.getElementById('drawingSyncStatus'); if (status) status.textContent = 'server unavailable, local fallback'; });
};

const originalRestoreDrawings = window.restoreDrawings;
window.restoreDrawings = function() {
  if (originalRestoreDrawings) originalRestoreDrawings();
  api(`/api/drawings?symbol=${encodeURIComponent($('symbol').value)}&timeframe=${encodeURIComponent($('tf').value)}`)
    .then((response) => {
      if (response.drawings && Object.keys(response.drawings).length) {
        drawings = { ...emptyDrawings(), ...response.drawings };
        localStorage.setItem(drawingStorageKey(), JSON.stringify(drawings));
        renderDrawings();
        const status = document.getElementById('drawingSyncStatus'); if (status) status.textContent = 'drawings restored from server';
      }
    })
    .catch(() => { const status = document.getElementById('drawingSyncStatus'); if (status) status.textContent = 'using local drawings'; });
};

const badgeStyle = document.createElement('style');
badgeStyle.textContent = '.data-badges{display:inline-flex;gap:4px;flex-wrap:wrap;margin-left:6px}.data-badge{border:1px solid #334155;border-radius:999px;background:#0b1220;color:#cbd5e1;padding:3px 7px;font-size:11px}.data-badge.ok{border-color:#22c55e}.data-badge.warn{border-color:#f59e0b;color:#fbbf24}.watchlist-controls{display:grid;gap:5px;margin:0 0 8px}.watchlist-controls button,.watchlist-controls input,.journal-filters input,.journal-filters button,.idea-lifecycle-controls input,.idea-lifecycle-controls button,.idea-status-controls select,.idea-status-controls button,.drawing-controls button{font-size:12px;padding:5px 7px}.journal-filters,.idea-lifecycle-controls,.idea-status-controls,.drawing-controls{display:flex;gap:4px;flex-wrap:wrap;margin-top:6px}#drawingSyncStatus{color:#94a3b8;font-size:12px;padding:5px 0}';
document.head.appendChild(badgeStyle);
addExtraButtons();
addIdeaStatusFilters();
addJournalFilters();
addDrawingControls();
addWatchlistControls();
addIdeaLifecycleControls();
