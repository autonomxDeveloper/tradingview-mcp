let workstationIdeas = [];
let workstationSelectedIdea = null;

async function loadIdeas() {
  const response = await api('/api/ideas?limit=100');
  workstationIdeas = response.ideas || [];
  const rows = workstationIdeas.map((idea, index) => ({
    index: index + 1,
    id: idea.id,
    symbol: idea.symbol,
    timeframe: idea.timeframe,
    status: idea.status,
    hypothesis: idea.hypothesis,
  }));
  print({ ideas: rows, hint: 'Use loadIdeaDetail(1) or loadWorkspaceIdea(1).' });
  if (workstationIdeas.length) loadIdeaDetail(1);
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
  print({ selected_idea: idea, linked_backtests: backtests, actions: ['loadWorkspaceIdea()', 'runBacktest()', 'loadJournal()'] });
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
