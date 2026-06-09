window.workstationModules = {
  ideas: {
    file: 'idea_detail.js',
    owns: ['idea lifecycle', 'status filters', 'portfolio research', 'journal timeline', 'watchlist controls'],
  },
  drawings: {
    file: 'idea_detail.js',
    owns: ['server drawing sync', 'drawing load/save/clear controls'],
  },
  snapshots: {
    file: 'snapshot_browser.js',
    owns: ['snapshot API save/list/load', 'journal fallback'],
  },
  exports: {
    file: 'export_preview.js',
    owns: ['packet build', 'validation', 'file export', 'download cards', 'copy actions'],
  },
  layout: {
    file: 'inline layout adapter',
    owns: ['chart grid mode', 'slot state', 'layout state adapter'],
  },
  cleanup: {
    file: 'workspace_cleanup.js',
    owns: ['research tools strip', 'control grouping'],
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

addModuleRegistryButton();
