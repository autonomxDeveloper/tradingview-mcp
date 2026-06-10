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

window.workstationIdeaModule.bindStatusControls = function bindStatusControls() {
  const controls = document.getElementById('ideaStatusControls');
  if (!controls) return;
  const buttons = controls.querySelectorAll('button');
  if (buttons[0]) buttons[0].onclick = window.loadIdeas;
  if (buttons[1]) buttons[1].onclick = window.showIdeaDashboard;
};

window.workstationIdeaModule.bindLifecycleControls = function bindLifecycleControls() {
  const controls = document.getElementById('ideaLifecycleControls');
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
  owns: ['idea dashboard helpers', 'idea control binding', 'legacy idea API compatibility'],
});

if (window.registerWorkbenchBoot) {
  window.registerWorkbenchBoot('ideas', window.workstationIdeaModule.boot);
} else {
  setTimeout(window.workstationIdeaModule.boot, 0);
}
