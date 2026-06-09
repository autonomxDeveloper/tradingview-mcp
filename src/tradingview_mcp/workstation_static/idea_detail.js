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

const originalMeta = window.updateChartMeta;
window.updateChartMeta = function() {
  if (originalMeta) originalMeta();
  renderDataBadges();
};

const badgeStyle = document.createElement('style');
badgeStyle.textContent = '.data-badges{display:inline-flex;gap:4px;flex-wrap:wrap;margin-left:6px}.data-badge{border:1px solid #334155;border-radius:999px;background:#0b1220;color:#cbd5e1;padding:3px 7px;font-size:11px}.data-badge.ok{border-color:#22c55e}.data-badge.warn{border-color:#f59e0b;color:#fbbf24}';
document.head.appendChild(badgeStyle);
