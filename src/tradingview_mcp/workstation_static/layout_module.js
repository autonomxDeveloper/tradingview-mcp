window.workstationLayoutMode = window.workstationLayoutMode || '1';
window.workstationSyncSymbol = !!window.workstationSyncSymbol;
window.workstationSyncTimeframe = !!window.workstationSyncTimeframe;
window.workstationChartSlots = { 2: {}, 3: {}, 4: {}, ...(window.workstationChartSlots || {}) };

function setLayoutMode(mode) {
  window.workstationLayoutMode = ['1', '2', '4'].includes(String(mode)) ? String(mode) : '1';
  const grid = document.getElementById('chartGrid');
  if (grid) grid.className = `layout-grid layout-grid-${window.workstationLayoutMode}`;
  const selector = document.getElementById('layoutMode');
  if (selector) selector.value = window.workstationLayoutMode;
  setTimeout(() => window.dispatchEvent(new Event('resize')), 0);
}

function setSymbolSync(enabled) {
  window.workstationSyncSymbol = !!enabled;
  const input = document.getElementById('syncSymbol');
  if (input) input.checked = window.workstationSyncSymbol;
}

function setTimeframeSync(enabled) {
  window.workstationSyncTimeframe = !!enabled;
  const input = document.getElementById('syncTimeframe');
  if (input) input.checked = window.workstationSyncTimeframe;
}

function setChartSlot(slot) {
  const symbolInput = document.getElementById(`slot${slot}Symbol`);
  const tfInput = document.getElementById(`slot${slot}Tf`);
  const state = {
    symbol: (symbolInput?.value || '').trim().toUpperCase(),
    timeframe: (tfInput?.value || '').trim(),
  };
  window.workstationChartSlots[slot] = state;
  renderChartSlot(slot);
}

function renderChartSlot(slot) {
  const state = window.workstationChartSlots[slot] || {};
  const label = document.getElementById(`slot${slot}Label`);
  if (label) label.textContent = state.symbol ? `${state.symbol} · ${state.timeframe || 'default'}` : 'Unassigned';
}

function applyChartSlots(slots) {
  window.workstationChartSlots = { 2: {}, 3: {}, 4: {}, ...(slots || {}) };
  [2, 3, 4].forEach((slot) => {
    const state = window.workstationChartSlots[slot] || {};
    const symbolInput = document.getElementById(`slot${slot}Symbol`);
    const tfInput = document.getElementById(`slot${slot}Tf`);
    if (symbolInput) symbolInput.value = state.symbol || '';
    if (tfInput) tfInput.value = state.timeframe || '';
    renderChartSlot(slot);
  });
}

function installLayoutStateAdapter() {
  if (window.workstationLayoutAdapterInstalled) return;
  window.workstationLayoutAdapterInstalled = true;

  const originalCurrentLayoutState = window.currentLayoutState;
  window.currentLayoutState = function() {
    const state = originalCurrentLayoutState ? originalCurrentLayoutState() : {};
    return {
      ...state,
      layoutMode: window.workstationLayoutMode || '1',
      syncSymbol: !!window.workstationSyncSymbol,
      syncTimeframe: !!window.workstationSyncTimeframe,
      chartSlots: window.workstationChartSlots || {},
    };
  };

  const originalApplyLayoutState = window.applyLayoutState;
  window.applyLayoutState = function(state) {
    setLayoutMode((state && state.layoutMode) || '1');
    setSymbolSync(!!(state && state.syncSymbol));
    setTimeframeSync(!!(state && state.syncTimeframe));
    applyChartSlots(state && state.chartSlots);
    if (originalApplyLayoutState) originalApplyLayoutState(state || {});
  };

  const originalResetLayout = window.resetLayout;
  window.resetLayout = function() {
    setLayoutMode('1');
    setSymbolSync(false);
    setTimeframeSync(false);
    applyChartSlots({});
    if (originalResetLayout) originalResetLayout();
  };
}

function initLayoutModule() {
  installLayoutStateAdapter();
  setLayoutMode(window.workstationLayoutMode || '1');
  setSymbolSync(window.workstationSyncSymbol);
  setTimeframeSync(window.workstationSyncTimeframe);
  applyChartSlots(window.workstationChartSlots || {});
}

if (window.workstationBoot) window.workstationBoot.register('layout', initLayoutModule);
else setTimeout(initLayoutModule, 0);
