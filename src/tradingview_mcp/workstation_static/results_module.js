const WORKSTATION_RESULT_PANES = ['general', 'payload', 'scanner', 'backtests', 'ideas', 'journal', 'diagnostics'];
const WORKSTATION_ACTION_RESULT_PANES = {
  'market.load': 'payload',
  'payload.show': 'payload',
  'scanner.scan': 'scanner',
  'scanner.useTopCandidate': 'scanner',
  'backtest.run': 'backtests',
  'backtest.compare': 'backtests',
  'backtest.list': 'backtests',
  'ideas.save': 'ideas',
  'ideas.list': 'ideas',
  'ideas.detail': 'ideas',
  'ideas.loadWorkspace': 'ideas',
  'journal.load': 'journal',
};

window.workstationResults = window.workstationResults || {
  activePane: 'general',
};

function resultPaneId(name) {
  return `resultPane-${name}`;
}

function resultTabId(name) {
  return `resultTab-${name}`;
}

function stringifyResult(value) {
  return typeof value === 'string' ? value : JSON.stringify(value, null, 2);
}

function getResultPane(name) {
  if (!WORKSTATION_RESULT_PANES.includes(name)) return null;
  return document.getElementById(resultPaneId(name));
}

function showResultPane(name) {
  const cleanName = WORKSTATION_RESULT_PANES.includes(name) ? name : 'general';
  window.workstationResults.activePane = cleanName;
  WORKSTATION_RESULT_PANES.forEach((paneName) => {
    const pane = getResultPane(paneName);
    const tab = document.getElementById(resultTabId(paneName));
    const active = paneName === cleanName;
    if (pane) pane.classList.toggle('active-result-pane', active);
    if (tab) {
      tab.classList.toggle('active', active);
      tab.setAttribute('aria-selected', active ? 'true' : 'false');
    }
  });
}

function setResultPane(name, value) {
  const pane = getResultPane(name);
  if (!pane) return false;
  pane.textContent = stringifyResult(value);
  showResultPane(name);
  return true;
}

function resolveDefaultResultPane() {
  return window.workstationResults.activePane || 'general';
}

function routePrintToResults() {
  const originalPrint = window.print;
  window.workstationOriginalPrint = window.workstationOriginalPrint || originalPrint;
  window.print = function(value, target = 'output') {
    if (target && target !== 'output') {
      const explicitTarget = document.getElementById(target);
      if (explicitTarget) {
        explicitTarget.textContent = stringifyResult(value);
        return;
      }
      if (setResultPane(target, value)) return;
    }
    const paneName = resolveDefaultResultPane();
    if (setResultPane(paneName, value)) return;
    if (typeof originalPrint === 'function') originalPrint(value, target);
  };
}

function bindResultTabs() {
  document.querySelectorAll('[data-result-pane-target]').forEach((button) => {
    button.addEventListener('click', () => showResultPane(button.dataset.resultPaneTarget));
  });
}

function bindActionPaneHints() {
  document.addEventListener('click', (event) => {
    const control = event.target.closest('[data-action]');
    if (!control) return;
    const paneName = WORKSTATION_ACTION_RESULT_PANES[control.dataset.action];
    if (paneName) showResultPane(paneName);
  }, true);
}

function addResultsStyles() {
  if (document.getElementById('resultsSurfaceStyles')) return;
  const style = document.createElement('style');
  style.id = 'resultsSurfaceStyles';
  style.textContent = `
.results-surface{display:grid;grid-template-rows:auto 1fr;min-height:0;border-top:1px solid #1e293b;background:#060a12}
.result-tabs{display:flex;gap:5px;flex-wrap:wrap;margin:0;padding:7px 0 8px}
.result-tabs button{font-size:12px;padding:5px 8px;background:#111827}
.result-tabs button.active{border-color:#60a5fa;background:#10233f;color:#dbeafe}
.result-pane-stack{min-height:0;overflow:auto;border:1px solid #1e293b;border-radius:8px;background:#050916}
.result-pane{display:none;min-height:142px;padding:9px}
.result-pane.active-result-pane{display:block}
`;
  document.head.appendChild(style);
}

function initializeResultsSurface() {
  addResultsStyles();
  bindResultTabs();
  bindActionPaneHints();
  routePrintToResults();
  showResultPane(window.workstationResults.activePane || 'general');
}

window.showResultPane = showResultPane;
window.setResultPane = setResultPane;

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeResultsSurface);
} else {
  initializeResultsSurface();
}
