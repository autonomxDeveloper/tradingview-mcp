function showBootDiagnostics() {
  const scripts = [...document.scripts].map((script) => script.getAttribute('src')).filter(Boolean);
  const boot = window.workstationBoot || {};
  const diagnostics = {
    modules: window.workstationModules || {},
    loaded_scripts: scripts,
    boot_callbacks: Object.keys(boot.callbacks || {}),
    booted: !!boot.booted,
    guard_warnings: window.workstationModuleGuard?.warnings || [],
    legacy_binding_prune: window.workstationLegacyBindingPrune || {},
  };
  print({ boot_diagnostics: diagnostics });
}

function addBootDiagnosticsControl() {
  const controls = document.getElementById('researchToolsStrip') || document.querySelector('.bottom .tabs');
  if (!controls || document.getElementById('bootDiagnosticsButton')) return;
  const button = document.createElement('button');
  button.id = 'bootDiagnosticsButton';
  button.textContent = 'Boot diagnostics';
  button.onclick = showBootDiagnostics;
  controls.appendChild(button);
}

window.workstationModules = window.workstationModules || {};
window.workstationModules.bootDiagnostics = {
  file: 'boot_diagnostics.js',
  owns: ['boot diagnostics view', 'loaded script listing', 'recent guard warning view', 'legacy binding metrics view'],
};

if (window.registerWorkbenchBoot) window.registerWorkbenchBoot('boot-diagnostics', addBootDiagnosticsControl);
else setTimeout(addBootDiagnosticsControl, 0);
