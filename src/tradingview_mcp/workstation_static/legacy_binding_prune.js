function pruneLegacyBindings() {
  const normalized = [];
  const metrics = [];
  const runModule = (name, fn, selectors = []) => {
    const before = selectors.filter((selector) => document.querySelector(selector)).length;
    fn();
    const after = selectors.filter((selector) => document.querySelector(selector)).length;
    normalized.push(name);
    metrics.push({ module: name, anchors_present_before: before, anchors_present_after: after, selectors });
  };
  if (window.workstationIdeaModule?.boot) {
    runModule('ideas', () => window.workstationIdeaModule.boot(), ['#ideaStatusFilter', '#ideaDashboardButton', '#ideaStatusNote']);
  }
  if (window.workstationDrawingModule?.bindControls) {
    runModule('drawings', () => window.workstationDrawingModule.bindControls(), ['#drawingControls', '#loadServerDrawingsButton', '#saveServerDrawingsButton']);
  }
  if (window.workstationWatchlistModule?.bindControls) {
    runModule('watchlist', () => window.workstationWatchlistModule.bindControls(), ['#watchlistControls', '#watchlistSymbolInput']);
  }
  if (window.journalModule?.bindControls) {
    runModule('journal', () => window.journalModule.bindControls(), ['#journalFilters', '#journalSymbolFilter', '#journalTypeFilter', '#journalIdeaFilter']);
  }
  if (window.exportModule?.bindControls) {
    runModule('exports', () => window.exportModule.bindControls(), ['#exportControls', '#copyPacketJsonButton', '#browseExportsButton']);
  }
  window.workstationLegacyBindingPrune = {
    normalized,
    metrics,
    count: normalized.length,
    at: new Date().toISOString(),
  };
}

window.workstationModules = window.workstationModules || {};
window.workstationModules.legacyBindingPrune = {
  file: 'legacy_binding_prune.js',
  owns: ['post-boot binding normalization', 'module-owned handler rebind pass', 'legacy binding metrics'],
};

if (window.registerWorkbenchBoot) window.registerWorkbenchBoot('legacy-binding-prune', pruneLegacyBindings);
else setTimeout(pruneLegacyBindings, 0);
