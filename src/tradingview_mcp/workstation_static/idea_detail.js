let workstationIdeas = [];
let workstationSelectedIdea = null;

async function loadIdeas() {
  const statusFilter = document.getElementById('ideaStatusFilter')?.value || '';
  const query = statusFilter ? `?status=${encodeURIComponent(statusFilter)}&limit=100` : '?limit=100';
  const response = await api('/api/ideas' + query);
  workstationIdeas = response.ideas || [];
  const rows = workstationIdeas.map((idea, index) => ({ index: index + 1, id: idea.id, symbol: idea.symbol, timeframe: idea.timeframe, status: idea.status, hypothesis: idea.hypothesis }));
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
  try { const response = await api(`/api/backtests?idea_id=${encodeURIComponent(idea.id)}&limit=20`); backtests = response.records || []; } catch (_) { backtests = []; }
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

function journalFilterValue(id) { return (document.getElementById(id)?.value || '').trim().toUpperCase(); }

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

function watchlistSymbols() { return [...document.querySelectorAll('#watch button')].map((button) => button.textContent.trim()).filter(Boolean); }

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

function currentSessionSnapshot() {
  return {
    symbol: $('symbol').value,
    timeframe: $('tf').value,
    asset_type: $('asset').value,
    exchange: $('exchange').value,
    layout: window.currentLayoutState ? window.currentLayoutState() : {},
    drawings,
    idea_id: $('ideaId').value || workstationSelectedIdea?.id || '',
    hypothesis: $('hypothesis').value,
    invalidation: $('invalidation').value,
    backtest_plan: $('backtestPlan').value,
    analysis: document.getElementById('analysis')?.textContent || '',
    output: document.getElementById('output')?.textContent || '',
  };
}

async function saveSessionSnapshot() {
  const snapshot = currentSessionSnapshot();
  await post('/api/journal', { event_type: 'research_session_snapshot', payload: snapshot });
  print({ session_snapshot_saved: { symbol: snapshot.symbol, timeframe: snapshot.timeframe, idea_id: snapshot.idea_id } });
}

async function loadLatestSessionSnapshot() {
  const response = await api('/api/journal?limit=300');
  const events = response.events || [];
  const event = [...events].reverse().find((row) => row.event_type === 'research_session_snapshot');
  if (!event) { print('No session snapshot found.'); return; }
  const snapshot = event.payload || {};
  $('symbol').value = snapshot.symbol || $('symbol').value;
  $('tf').value = snapshot.timeframe || $('tf').value;
  $('asset').value = snapshot.asset_type || $('asset').value;
  $('exchange').value = snapshot.exchange || $('exchange').value;
  $('ideaId').value = snapshot.idea_id || '';
  $('hypothesis').value = snapshot.hypothesis || '';
  $('invalidation').value = snapshot.invalidation || '';
  $('backtestPlan').value = snapshot.backtest_plan || '';
  if (window.applyLayoutState) window.applyLayoutState(snapshot.layout || {});
  drawings = { ...emptyDrawings(), ...(snapshot.drawings || {}) };
  localStorage.setItem(drawingStorageKey(), JSON.stringify(drawings));
  renderDrawings();
  print({ session_snapshot_loaded: { symbol: snapshot.symbol, timeframe: snapshot.timeframe, idea_id: snapshot.idea_id } });
  loadMarket();
}

function markdownForPacket(packet) {
  return `# Research packet: ${packet.snapshot.symbol} ${packet.snapshot.timeframe}\n\n` +
    `Generated: ${packet.generated_at_utc}\n\n` +
    `## Chart metadata\n- Asset: ${packet.snapshot.asset_type}\n- Exchange: ${packet.snapshot.exchange}\n- Source: ${packet.chart_metadata.source || 'unknown'}\n- Freshness: ${packet.chart_metadata.freshness || 'unknown'}\n\n` +
    `## Idea\n- ID: ${packet.snapshot.idea_id || 'none'}\n- Hypothesis: ${packet.snapshot.hypothesis || 'none'}\n- Invalidation: ${packet.snapshot.invalidation || 'none'}\n- Backtest plan: ${packet.snapshot.backtest_plan || 'none'}\n\n` +
    `## AI analysis\n${packet.snapshot.analysis || 'No analysis captured.'}\n\n` +
    `## Backtests\n${packet.backtests.map((record) => `- ${record.id || 'record'} ${record.strategy || ''} ${record.symbol || ''}`).join('\n') || 'No linked backtests.'}\n\n` +
    `## Recent journal\n${packet.journal.map((row) => `- ${row.event_type || row.type}: ${JSON.stringify(row.payload || {}).slice(0, 160)}`).join('\n') || 'No journal rows.'}\n`;
}

async function exportResearchPacket() {
  const snapshot = currentSessionSnapshot();
  const journalResponse = await api('/api/journal?limit=30');
  const ideaResponse = await api(`/api/ideas?symbol=${encodeURIComponent(snapshot.symbol)}&limit=20`);
  const backtestQuery = snapshot.idea_id ? `/api/backtests?idea_id=${encodeURIComponent(snapshot.idea_id)}&limit=20` : `/api/backtests?symbol=${encodeURIComponent(snapshot.symbol)}&limit=20`;
  const backtestResponse = await api(backtestQuery);
  const metadata = lastPayload?.metadata || {};
  const packet = {
    generated_at_utc: new Date().toISOString(),
    mode: 'research_only',
    snapshot,
    chart_metadata: { text: document.getElementById('chartMeta')?.textContent || '', source: metadata.source || lastPayload?.source || '', freshness: metadata.stale ? 'stale' : 'fresh' },
    ideas: ideaResponse.ideas || [],
    backtests: backtestResponse.records || [],
    journal: journalResponse.events || [],
  };
  const markdown = markdownForPacket(packet);
  await post('/api/journal', { event_type: 'research_packet_exported', payload: { symbol: snapshot.symbol, timeframe: snapshot.timeframe, idea_id: snapshot.idea_id } });
  const saved = await post('/api/exports', { name: `${snapshot.symbol}-${snapshot.timeframe}`, packet, markdown });
  const exportInfo = saved.export || {};
  print({ research_packet_json: packet, research_packet_markdown: markdown, saved_export: exportInfo, download_links: { json: `/api/exports/download/${exportInfo.json_file || ''}`, markdown: `/api/exports/download/${exportInfo.markdown_file || ''}` } });
}

async function listExportFiles() {
  const response = await api('/api/exports');
  print({ exports: response.exports || [] });
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
window.updateChartMeta = function() { if (originalMeta) originalMeta(); if (window.renderDataBadges) window.renderDataBadges(); };

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

addExtraButtons();
