// Dedicated watchlist module for server persistence and symbol loading.
window.workstationWatchlistModule = window.workstationWatchlistModule || {};

window.workstationWatchlistModule.symbols = function symbols() {
  return [...document.querySelectorAll('#watch button')].map((button) => button.textContent.trim()).filter(Boolean);
};

window.workstationWatchlistModule.render = function render(symbols) {
  const watch = document.getElementById('watch');
  if (!watch) return [];
  watch.innerHTML = '';
  (symbols || []).forEach((symbol) => {
    const button = document.createElement('button');
    button.textContent = symbol;
    button.onclick = () => window.workstationWatchlistModule.loadSymbol(symbol);
    watch.appendChild(button);
  });
  return symbols || [];
};

window.workstationWatchlistModule.loadSymbol = function loadSymbol(symbol) {
  $('symbol').value = symbol;
  if (String(symbol).includes('USDT')) { $('asset').value = 'crypto'; $('exchange').value = 'BINANCE'; }
  else { $('asset').value = 'stock'; $('exchange').value = 'NASDAQ'; }
  loadMarket();
};

window.workstationWatchlistModule.input = function input() {
  const element = document.createElement('input');
  element.id = 'watchlistSymbolInput';
  element.placeholder = 'watchlist symbol';
  element.className = 'level-label-input';
  return element;
};

window.workstationWatchlistModule.button = function button(label, handler) {
  const element = document.createElement('button');
  element.className = 'secondary';
  element.textContent = label;
  element.onclick = handler;
  return element;
};

window.workstationWatchlistModule.ensureControls = function ensureControls() {
  let controls = document.getElementById('watchlistControls');
  if (!controls) {
    controls = document.createElement('span');
    controls.id = 'watchlistControls';
    controls.className = 'module-control-group watchlist-control-group';
    const sidebar = document.querySelector('aside');
    const target = document.getElementById('watch') || sidebar;
    if (target && sidebar) sidebar.insertBefore(controls, target);
  }
  if (!controls || document.getElementById('watchlistSymbolInput')) return controls;
  controls.appendChild(window.workstationWatchlistModule.input());
  controls.appendChild(window.workstationWatchlistModule.button('Add', window.workstationWatchlistModule.add));
  controls.appendChild(window.workstationWatchlistModule.button('Remove selected', window.workstationWatchlistModule.removeSelected));
  controls.appendChild(window.workstationWatchlistModule.button('Refresh', window.workstationWatchlistModule.refresh));
  return controls;
};

window.workstationWatchlistModule.refresh = async function refresh() {
  const response = await api('/api/watchlist');
  return window.workstationWatchlistModule.render(response.symbols || []);
};

window.workstationWatchlistModule.save = async function save(symbols) {
  const clean = [...new Set((symbols || []).map((symbol) => String(symbol || '').trim().toUpperCase()).filter(Boolean))];
  await post('/api/watchlist', { symbols: clean });
  await window.workstationWatchlistModule.refresh();
  print({ watchlist_saved: clean });
};

window.workstationWatchlistModule.add = async function add() {
  const input = document.getElementById('watchlistSymbolInput');
  const symbol = (input?.value || $('symbol').value || '').trim().toUpperCase();
  if (!symbol) { print('Enter a symbol to add.'); return; }
  await window.workstationWatchlistModule.save([...window.workstationWatchlistModule.symbols(), symbol]);
  if (input) input.value = '';
};

window.workstationWatchlistModule.removeSelected = async function removeSelected() {
  const symbol = ($('symbol').value || '').trim().toUpperCase();
  if (!symbol) { print('Select a symbol to remove.'); return; }
  await window.workstationWatchlistModule.save(window.workstationWatchlistModule.symbols().filter((item) => item !== symbol));
};

window.workstationWatchlistModule.bindControls = function bindControls() {
  window.workstationModuleGuard?.missing('watchlist', { globals: ['api', 'post', '$', 'loadMarket', 'print'], elements: ['watch'] });
  window.workstationWatchlistModule.ensureControls();
};

window.watchlistSymbols = window.workstationWatchlistModule.symbols;
window.refreshWatchlist = window.workstationWatchlistModule.refresh;
window.saveWatchlistSymbols = window.workstationWatchlistModule.save;
window.addWatchlistSymbol = window.workstationWatchlistModule.add;
window.removeWatchlistSymbol = window.workstationWatchlistModule.removeSelected;
if (window.workstationBoot) window.workstationBoot.register('watchlist-module', () => window.workstationWatchlistModule.bindControls());
else window.workstationWatchlistModule.bindControls();
