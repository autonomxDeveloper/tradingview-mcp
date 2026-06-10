window.workstationPortfolioModule = window.workstationPortfolioModule || {};

window.workstationPortfolioModule.load = async function loadPortfolioResearch() {
  const positions = await api('/api/alpaca/positions');
  const ideas = await api('/api/ideas?limit=200');
  const ideaRows = ideas.ideas || [];
  const rawPositions = positions.positions || positions || [];
  if (positions.error) {
    print({ portfolio_error: positions.error, note: 'Read-only portfolio panel needs Alpaca credentials.' });
    return;
  }
  const rows = (Array.isArray(rawPositions) ? rawPositions : []).map((position) => {
    const symbol = String(position.symbol || '').toUpperCase();
    const linked = ideaRows.filter((idea) => String(idea.symbol || '').toUpperCase() === symbol);
    return { symbol, qty: position.qty, market_value: position.market_value, ideas: linked.length, statuses: linked.map((idea) => idea.status) };
  });
  print({ portfolio_research: rows, mode: 'read_only', actions: ['select symbol', 'loadIdeas()', 'saveIdea()'] });
};

window.workstationPortfolioModule.ensureControls = function ensurePortfolioControls() {
  const tabs = document.querySelector('.bottom .tabs');
  if (!tabs || document.getElementById('portfolioResearchButton')) return;
  const button = document.createElement('button');
  button.id = 'portfolioResearchButton';
  button.textContent = 'Portfolio';
  button.onclick = window.workstationPortfolioModule.load;
  tabs.appendChild(button);
};

window.loadPortfolioResearch = window.workstationPortfolioModule.load;

window.workstationPortfolioModule.boot = function bootPortfolioModule() {
  window.workstationModuleGuard?.check?.('portfolio', {
    globals: ['api', 'print'],
    anchors: ['.bottom .tabs'],
  });
  window.workstationPortfolioModule.ensureControls();
};

if (window.registerWorkbenchBoot) {
  window.registerWorkbenchBoot('portfolio', window.workstationPortfolioModule.boot);
} else {
  setTimeout(window.workstationPortfolioModule.boot, 0);
}
