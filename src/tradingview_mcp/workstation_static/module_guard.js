window.workstationModuleGuard = window.workstationModuleGuard || {};
window.workstationModuleGuard.warnings = window.workstationModuleGuard.warnings || [];

window.workstationModuleGuard.missing = function missingModuleDependency(moduleId, checks = {}) {
  const missing = [];
  (checks.globals || []).forEach((name) => {
    if (typeof window[name] === 'undefined') missing.push(`global:${name}`);
  });
  (checks.elements || []).forEach((id) => {
    if (!document.getElementById(id)) missing.push(`element:#${id}`);
  });
  if (missing.length) {
    const warning = { module: moduleId, missing, at: new Date().toISOString() };
    window.workstationModuleGuard.warnings.push(warning);
    window.workstationModuleGuard.warnings = window.workstationModuleGuard.warnings.slice(-50);
    if (typeof window.print === 'function') window.print({ module_guard_warning: warning });
  }
  return missing;
};

window.workstationModules = window.workstationModules || {};
window.workstationModules.guard = {
  file: 'module_guard.js',
  owns: ['module dependency checks', 'missing global/UI anchor warnings', 'recent guard warning memory'],
};
