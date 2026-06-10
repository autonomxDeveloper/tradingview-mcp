function moduleControlPresence() {
  const selectors = {
    ideas: ['ideaStatusControls', 'ideaLifecycleControls'],
    journal: ['journalFilters', 'journalSymbolFilter', 'journalTypeFilter', 'journalIdeaFilter'],
    drawings: ['drawingControls', 'drawingSyncStatus'],
    snapshots: ['snapshotControls'],
    exports: ['exportControls'],
    watchlist: ['watchlistControls', 'watchlistSymbolInput'],
    boot: ['bootDiagnosticsButton', 'moduleRegistryButton'],
  };
  return Object.fromEntries(Object.entries(selectors).map(([module, ids]) => [
    module,
    ids.map((id) => ({ id, present: !!document.getElementById(id) })),
  ]));
}

function compactModuleOwnership() {
  const modules = window.workstationModules || {};
  return Object.fromEntries(Object.entries(modules).map(([name, meta]) => [
    name,
    { file: meta.file || '', owns: meta.owns || [] },
  ]));
}

function showBootDiagnostics() {
  const scripts = [...document.scripts].map((script) => script.getAttribute('src')).filter(Boolean);
  const boot = window.workstationBoot || {};
  const guardWarnings = window.workstationModuleGuard?.warnings || [];
  const diagnostics = {
    summary: {
      module_count: Object.keys(window.workstationModules || {}).length,
      script_count: scripts.length,
      boot_callback_count: Object.keys(boot.callbacks || {}).length,
      guard_warning_count: guardWarnings.length,
      legacy_prune_modules: Object.keys(window.workstationLegacyBindingPrune?.metrics || {}).length,
    },
    module_ownership: compactModuleOwnership(),
    module_controls: moduleControlPresence(),
    boot_callbacks: Object.keys(boot.callbacks || {}),
    booted: !!boot.booted,
    recent_guard_warnings: guardWarnings.slice(-10),
    legacy_binding_metrics: window.workstationLegacyBindingPrune?.metrics || {},
    loaded_scripts: scripts,
  };
  print({ boot_diagnostics: diagnostics });
}

function addBootDiagnosticsControl() {
  const controls = document.getElementById('researchToolsStrip') || document.querySelector('.bottom .tabs');
  if (!controls || document.getElementById('bootDiagnosticsButton')) return;
  const button = document.createElement('button');
  button.id = 'bootDiagnosticsButton';
  button.className = 'secondary';
  button.textContent = 'Boot diagnostics';
  button.onclick = showBootDiagnostics;
  controls.appendChild(button);
}

window.workstationModules = window.workstationModules || {};
window.workstationModules.bootDiagnostics = {
  file: 'boot_diagnostics.js',
  owns: ['compact boot diagnostics', 'module control presence', 'guard warning summary', 'legacy binding metrics view'],
};

if (window.registerWorkbenchBoot) window.registerWorkbenchBoot('boot-diagnostics', addBootDiagnosticsControl);
else setTimeout(addBootDiagnosticsControl, 0);
