window.workstationModuleGuard = window.workstationModuleGuard || {};
window.workstationModuleGuard.warnings = window.workstationModuleGuard.warnings || [];

function collectMissingModuleDependencies(checks = {}) {
  const missing = [];
  (checks.globals || []).forEach((name) => {
    if (typeof window[name] === 'undefined') missing.push(`global:${name}`);
  });
  (checks.elements || []).forEach((id) => {
    if (!document.getElementById(id)) missing.push(`element:#${id}`);
  });
  (checks.selectors || []).forEach((selector) => {
    if (!document.querySelector(selector)) missing.push(`selector:${selector}`);
  });
  return missing;
}

function recordMissingModuleDependencies(moduleId, missing) {
  if (missing.length) {
    const warning = { module: moduleId, missing, at: new Date().toISOString() };
    window.workstationModuleGuard.warnings.push(warning);
    window.workstationModuleGuard.warnings = window.workstationModuleGuard.warnings.slice(-50);
    if (typeof window.print === 'function') window.print({ module_guard_warning: warning });
  }
  return missing;
}

window.workstationModuleGuard.missing = function missingModuleDependency(moduleId, checks = {}) {
  return recordMissingModuleDependencies(moduleId, collectMissingModuleDependencies(checks));
};

window.workstationModuleGuard.check = function checkModuleDependency(moduleId, checks = {}) {
  return window.workstationModuleGuard.missing(moduleId, checks);
};

window.workstationModules = window.workstationModules || {};
window.workstationModules.guard = {
  file: 'module_guard.js',
  owns: ['module dependency checks', 'missing global/UI anchor warnings', 'CSS selector checks', 'check alias', 'recent guard warning memory'],
};
