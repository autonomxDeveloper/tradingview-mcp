window.workstationModules = {
  ideas: {
    file: 'idea_module.js + idea_detail.js',
    owns: ['idea lifecycle', 'status filters', 'legacy idea API compatibility'],
  },
  scanner: {
    file: 'scanner_module.js',
    owns: ['watchlist scanner', 'scanner candidate workspace load', 'research-only scanner hypotheses'],
  },
  backtests: {
    file: 'backtest_module.js',
    owns: ['run backtest action', 'strategy comparison action', 'backtest list view'],
  },
  analysis: {
    file: 'analysis_module.js',
    owns: ['AI analysis request payloads', 'analysis loading state', 'analysis response rendering'],
  },
  portfolio: {
    file: 'portfolio_module.js',
    owns: ['read-only portfolio research', 'portfolio tab action', 'portfolio-to-idea cross reference'],
  },
  dataBadges: {
    file: 'data_badge_module.js',
    owns: ['data source badges', 'freshness badges', 'legacy badge API compatibility'],
  },
  journal: {
    file: 'journal_module.js',
    owns: ['journal timeline', 'journal filters', 'current-symbol journal view'],
  },
  drawings: {
    file: 'drawing_module.js',
    owns: ['server drawing sync', 'drawing load/save/clear controls', 'localStorage fallback compatibility'],
  },
  watchlist: {
    file: 'watchlist_module.js',
    owns: ['watchlist add/remove/refresh', 'server persistence', 'symbol load behavior'],
  },
  snapshots: {
    file: 'snapshot_browser.js',
    owns: ['snapshot API save/list/load', 'journal fallback'],
  },
  exports: {
    file: 'export_module.js + export_preview.js',
    owns: ['packet build facade', 'validation', 'file export', 'download cards', 'copy actions', 'legacy export API compatibility'],
  },
  layout: {
    file: 'layout_module.js',
    owns: ['chart grid mode', 'slot state', 'layout state adapter'],
  },
  cleanup: {
    file: 'workspace_cleanup.js',
    owns: ['research tools strip', 'control grouping'],
  },
  guard: {
    file: 'module_guard.js',
    owns: ['module dependency checks', 'missing global/UI anchor warnings', 'recent guard warning memory'],
  },
  bootDiagnostics: {
    file: 'boot_diagnostics.js',
    owns: ['boot diagnostics view', 'loaded script listing', 'recent guard warning view'],
  },
  legacyBindingPrune: {
    file: 'legacy_binding_prune.js',
    owns: ['post-boot binding normalization', 'module-owned handler rebind pass'],
  },
};

function showFrontendModules() {
  print({ workstation_modules: window.workstationModules, note: 'Module registry only; behavior is unchanged.' });
}

function addModuleRegistryButton() {
  const tabs = document.querySelector('.bottom .tabs');
  if (!tabs || document.getElementById('frontendModulesButton')) return;
  const button = document.createElement('button');
  button.id = 'frontendModulesButton';
  button.textContent = 'Modules';
  button.onclick = showFrontendModules;
  tabs.appendChild(button);
}

function loadModuleScript(id, src, onload) {
  if (document.getElementById(id)) { if (onload) onload(); return; }
  const script = document.createElement('script');
  script.id = id;
  script.src = src;
  if (onload) script.onload = onload;
  document.body.appendChild(script);
}

function loadWorkstationModules() {
  addModuleRegistryButton();
  loadModuleScript('moduleGuardScript', '/static/module_guard.js');
  loadModuleScript('dataBadgeModuleScript', '/static/data_badge_module.js');
  loadModuleScript('journalModuleScript', '/static/journal_module.js');
  loadModuleScript('drawingModuleScript', '/static/drawing_module.js');
  loadModuleScript('watchlistModuleScript', '/static/watchlist_module.js');
  loadModuleScript('scannerModuleScript', '/static/scanner_module.js');
  loadModuleScript('backtestModuleScript', '/static/backtest_module.js');
  loadModuleScript('analysisModuleScript', '/static/analysis_module.js');
  loadModuleScript('layoutModuleScript', '/static/layout_module.js');
  loadModuleScript('portfolioModuleScript', '/static/portfolio_module.js');
  loadModuleScript('exportModuleScript', '/static/export_module.js');
  loadModuleScript('bootDiagnosticsScript', '/static/boot_diagnostics.js');
  loadModuleScript('legacyBindingPruneScript', '/static/legacy_binding_prune.js');
  if (window.workstationBoot) window.workstationBoot.run();
}

loadModuleScript('bootRegistryScript', '/static/boot_registry.js', loadWorkstationModules);
