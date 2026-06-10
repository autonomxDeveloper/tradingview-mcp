// Dedicated idea lifecycle module for the workstation.
// This module intentionally keeps the legacy global API names available.
window.workstationIdeaModule = window.workstationIdeaModule || {};

window.workstationIdeaModule.statuses = ['draft', 'watching', 'invalidated', 'backtested', 'archived'];

window.workstationIdeaModule.dashboard = function dashboard(ideas = window.workstationIdeas || []) {
  const counts = Object.fromEntries(window.workstationIdeaModule.statuses.map((status) => [status, 0]));
  ideas.forEach((idea) => { counts[idea.status] = (counts[idea.status] || 0) + 1; });
  return { total: ideas.length, counts };
};

window.workstationIdeaModule.rows = function rows(ideas = window.workstationIdeas || []) {
  return ideas.map((idea, index) => ({
    index: index + 1,
    id: idea.id,
    symbol: idea.symbol,
    timeframe: idea.timeframe,
    status: idea.status,
    hypothesis: idea.hypothesis,
  }));
};

window.workstationIdeaModule.ensureStatusControls = function ensureStatusControls() {
  const tabs = document.querySelector('.bottom .tabs');
  if (!tabs) return null;
  let controls = document.getElementById('ideaStatusControls');
  if (controls) return controls;
  controls = document.createElement('span');
  controls.id = 'ideaStatusControls';
  controls.className = 'idea-status-controls module-control-group idea-module-controls';
  controls.innerHTML = '<select id="ideaStatusFilter"><option value="">all ideas</option><option>draft</option><option>watching</option><option>invalidated</option><option>backtested</option><option>archived</option></select><button>Filter ideas</button><button>Idea dashboard</button>';
  tabs.appendChild(controls);
  return controls;
};

window.workstationIdeaModule.ensureLifecycleControls = function ensureLifecycleControls() {
  const ideaIdInput = document.getElementById('ideaId');
  if (!ideaIdInput) return null;
  let controls = document.getElementById('ideaLifecycleControls');
  if (controls) return controls;
  controls = document.createElement('div');
  controls.id = 'ideaLifecycleControls';
  controls.className = 'idea-lifecycle-controls module-control-group idea-module-controls';
  controls.innerHTML = '<input id="ideaStatusNote" placeholder="status note" /><button>Watching</button><button>Invalidated</button><button>Backtested</button><button>Archived</button>';
  ideaIdInput.parentNode.insertBefore(controls, ideaIdInput.nextSibling);
  return controls;
};

window.workstationIdeaModule.bindStatusControls = function bindStatusControls() {
  const controls = window.workstationIdeaModule.ensureStatusControls();
  if (!controls) return;
  const buttons = controls.querySelectorAll('button');
  if (buttons[0]) buttons[0].onclick = window.loadIdeas;
  if (buttons[1]) buttons[1].onclick = window.showIdeaDashboard;
};

window.workstationIdeaModule.bindLifecycleControls = function bindLifecycleControls() {
  const controls = window.workstationIdeaModule.ensureLifecycleControls();
  if (!controls) return;
  const buttons = controls.querySelectorAll('button');
  if (buttons[0]) buttons[0].onclick = () => window.setSelectedIdeaStatus('watching');
  if (buttons[1]) buttons[1].onclick = () => window.setSelectedIdeaStatus('invalidated');
  if (buttons[2]) buttons[2].onclick = () => window.setSelectedIdeaStatus('backtested');
  if (buttons[3]) buttons[3].onclick = () => window.setSelectedIdeaStatus('archived');
};

window.workstationIdeaModule.boot = function bootIdeaModule() {
  window.workstationIdeaModule.bindStatusControls();
  window.workstationIdeaModule.bindLifecycleControls();
};

window.workstationModules = window.workstationModules || [];
window.workstationModules.push({
  id: 'ideas',
  file: 'idea_module.js',
  owns: ['idea dashboard helpers', 'idea status controls', 'idea lifecycle controls', 'legacy idea API compatibility'],
});

if (window.registerWorkbenchBoot) {
  window.registerWorkbenchBoot('ideas', window.workstationIdeaModule.boot);
} else {
  setTimeout(window.workstationIdeaModule.boot, 0);
}
