function ensureAccessibilityStyles() {
  if (document.getElementById('accessibilityModuleStyles')) return;
  const style = document.createElement('style');
  style.id = 'accessibilityModuleStyles';
  style.textContent = `
    .sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}
    button:focus-visible,input:focus-visible,select:focus-visible,textarea:focus-visible,[role="tab"]:focus-visible{outline:2px solid #93c5fd;outline-offset:2px;box-shadow:0 0 0 3px rgba(37,99,235,.35)}
    [aria-pressed="true"]{border-color:#60a5fa;background:#10233f}
  `;
  document.head.appendChild(style);
}

function setAttrIfMissing(element, name, value) {
  if (element && !element.hasAttribute(name)) element.setAttribute(name, value);
}

function labelControl(id, label) {
  const element = document.getElementById(id);
  if (!element) return;
  setAttrIfMissing(element, 'aria-label', label);
}

function addLiveRegion(id, politeness = 'polite') {
  const element = document.getElementById(id);
  if (!element) return;
  setAttrIfMissing(element, 'aria-live', politeness);
  setAttrIfMissing(element, 'aria-atomic', 'false');
}

function makeButtonsExplicit() {
  document.querySelectorAll('button:not([type])').forEach((button) => button.setAttribute('type', 'button'));
}

function labelStaticControls() {
  const labels = {
    symbol: 'Symbol',
    asset: 'Asset type',
    exchange: 'Exchange',
    tf: 'Timeframe',
    levelPrice: 'Price level',
    levelLabel: 'Price level label',
    levelKind: 'Price level kind',
    noteText: 'Chart note',
    zoneLow: 'Zone low price',
    zoneHigh: 'Zone high price',
    zoneLabel: 'Zone label',
    zoneKind: 'Zone kind',
    guideStartPrice: 'Guide start price',
    guideEndPrice: 'Guide end price',
    guideLabel: 'Guide label',
    guideKind: 'Guide kind',
    layoutMode: 'Chart layout mode',
    syncSymbol: 'Synchronize chart symbols',
    syncTimeframe: 'Synchronize chart timeframes',
    layoutName: 'Layout name',
    question: 'AI analysis question',
    hypothesis: 'Research idea hypothesis',
    invalidation: 'Research idea invalidation',
    backtestPlan: 'Research idea backtest plan',
    ideaId: 'Idea ID for backtest link',
    strategy: 'Backtest strategy',
    period: 'Backtest period',
    slot2Symbol: 'Slot 2 symbol',
    slot2Tf: 'Slot 2 timeframe',
    slot3Symbol: 'Slot 3 symbol',
    slot3Tf: 'Slot 3 timeframe',
    slot4Symbol: 'Slot 4 symbol',
    slot4Tf: 'Slot 4 timeframe',
  };
  Object.entries(labels).forEach(([id, label]) => labelControl(id, label));
  setAttrIfMissing(document.getElementById('watch'), 'aria-label', 'Watchlist symbols');
  setAttrIfMissing(document.getElementById('chartGrid'), 'aria-label', 'Chart layout grid');
  setAttrIfMissing(document.getElementById('chartWrap'), 'aria-label', 'Primary chart');
}

function configureLiveRegions() {
  ['status', 'risk', 'analysis', 'output'].forEach((id) => addLiveRegion(id));
  document.querySelectorAll('.result-pane').forEach((pane) => {
    setAttrIfMissing(pane, 'aria-live', 'polite');
    setAttrIfMissing(pane, 'aria-atomic', 'false');
  });
}

function updateResultTabs() {
  document.querySelectorAll('[data-result-pane-target][role="tab"]').forEach((tab) => {
    const target = tab.getAttribute('data-result-pane-target');
    const pane = document.getElementById(`resultPane-${target}`);
    const selected = !!pane && pane.classList.contains('active-result-pane');
    tab.setAttribute('aria-selected', String(selected));
    tab.setAttribute('tabindex', selected ? '0' : '-1');
    if (pane) pane.hidden = !selected;
  });
}

function wireResultTabKeyboard() {
  const tabs = Array.from(document.querySelectorAll('[data-result-pane-target][role="tab"]'));
  tabs.forEach((tab, index) => {
    if (tab.dataset.accessibilityKeyboardBound === 'true') return;
    tab.dataset.accessibilityKeyboardBound = 'true';
    tab.addEventListener('keydown', (event) => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      let nextIndex = index;
      if (event.key === 'ArrowLeft') nextIndex = (index - 1 + tabs.length) % tabs.length;
      if (event.key === 'ArrowRight') nextIndex = (index + 1) % tabs.length;
      if (event.key === 'Home') nextIndex = 0;
      if (event.key === 'End') nextIndex = tabs.length - 1;
      tabs[nextIndex].focus();
      tabs[nextIndex].click();
    });
  });
}

function updateTogglePressedStates() {
  document.querySelectorAll('[data-action^="chart.toggle"]').forEach((button) => {
    button.setAttribute('aria-pressed', String(button.classList.contains('active')));
  });
}

function observeAccessibilityState() {
  if (window.accessibilityStateObserver) return;
  window.accessibilityStateObserver = new MutationObserver(() => {
    updateResultTabs();
    updateTogglePressedStates();
    makeButtonsExplicit();
  });
  window.accessibilityStateObserver.observe(document.body, { attributes: true, childList: true, subtree: true, attributeFilter: ['class'] });
}

function enhanceAccessibility() {
  ensureAccessibilityStyles();
  makeButtonsExplicit();
  labelStaticControls();
  configureLiveRegions();
  updateResultTabs();
  wireResultTabKeyboard();
  updateTogglePressedStates();
  observeAccessibilityState();
}

if (window.workstationBoot) window.workstationBoot.register('accessibility', enhanceAccessibility);
else enhanceAccessibility();
