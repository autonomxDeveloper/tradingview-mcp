window.workstationModuleGuard = window.workstationModuleGuard || {};

window.workstationModuleGuard.missing = function missingModuleDependency(moduleId, checks = {}) {
  const missing = [];
  (checks.globals || []).forEach((name) => {
    if (typeof window[name] === 'undefined') missing.push(`global:${name}`);
  });
  (checks.elements || []).forEach((id) => {
    if (!document.getElementById(id)) missing.push(`element:#${id}`);
  });
  if (missing.length && typeof window.print === 'function') {
    window.print({ module_guard_warning: { module: moduleId, missing } });
  }
  return missing;
};

window.workstationModules = window.workstationModules || {};
window.workstationModules.guard = {
  file: 'module_guard.js',
  owns: ['module dependency checks', 'missing global/UI anchor warnings'],
};
