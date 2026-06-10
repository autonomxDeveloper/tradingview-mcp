function pruneLegacyBindings() {
  const rebinding = [];
  if (window.workstationIdeaModule?.boot) {
    window.workstationIdeaModule.boot();
    rebinding.push('ideas');
  }
  if (window.workstationDrawingModule?.bindControls) {
    window.workstationDrawingModule.bindControls();
    rebinding.push('drawings');
  }
  if (window.workstationWatchlistModule?.bindControls) {
    window.workstationWatchlistModule.bindControls();
    rebinding.push('watchlist');
  }
  if (window.journalModule?.bindControls) {
    window.journalModule.bindControls();
    rebinding.push('journal');
  }
  if (window.exportModule?.bindControls) {
    window.exportModule.bindControls();
    rebinding.push('exports');
  }
  window.workstationLegacyBindingPrune = { rebinding, at: new Date().toISOString() };
}

window.workstationModules = window.workstationModules || {};
window.workstationModules.legacyBindingPrune = {
  file: 'legacy_binding_prune.js',
  owns: ['post-boot binding normalization', 'module-owned handler rebind pass'],
};

if (window.registerWorkbenchBoot) window.registerWorkbenchBoot('legacy-binding-prune', pruneLegacyBindings);
else setTimeout(pruneLegacyBindings, 0);
