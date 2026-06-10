window.journalModule = {
  filterValue(id) {
    return (document.getElementById(id)?.value || '').trim().toUpperCase();
  },
  ensureControls() {
    let controls = document.getElementById('journalFilters');
    if (!controls) {
      controls = document.createElement('span');
      controls.id = 'journalFilters';
      controls.className = 'module-control-group journal-control-group';
      const target = document.getElementById('researchToolsStrip') || document.querySelector('.bottom .tabs');
      if (target) target.appendChild(controls);
    }
    if (!controls || document.getElementById('journalSymbolFilter')) return controls;
    controls.appendChild(window.journalModule.input('journalSymbolFilter', 'journal symbol'));
    controls.appendChild(window.journalModule.input('journalTypeFilter', 'event type'));
    controls.appendChild(window.journalModule.input('journalIdeaFilter', 'idea id'));
    controls.appendChild(window.journalModule.button('Filter journal', () => window.journalModule.loadTimeline()));
    controls.appendChild(window.journalModule.button('Current symbol journal', () => window.journalModule.loadTimeline({ currentSymbol: true })));
    return controls;
  },
  input(id, placeholder) {
    const input = document.createElement('input');
    input.id = id;
    input.placeholder = placeholder;
    input.className = 'level-label-input';
    return input;
  },
  button(label, handler) {
    const button = document.createElement('button');
    button.className = 'secondary';
    button.textContent = label;
    button.onclick = handler;
    return button;
  },
  async loadTimeline(options = {}) {
    const response = await api('/api/journal?limit=100');
    const events = response.events || [];
    const symbolFilter = options.currentSymbol ? ($('symbol').value || '').trim().toUpperCase() : window.journalModule.filterValue('journalSymbolFilter');
    const typeFilter = window.journalModule.filterValue('journalTypeFilter').toLowerCase();
    const ideaFilter = window.journalModule.filterValue('journalIdeaFilter');
    const rows = events.map((event, index) => ({
      index: index + 1,
      time: event.timestamp_utc || event.timestamp || '',
      type: event.event_type || event.type || 'event',
      symbol: String(event.payload?.symbol || event.payload?.request?.symbol || event.payload?.idea?.symbol || '').toUpperCase(),
      idea_id: String(event.payload?.idea_id || event.payload?.id || event.payload?.idea?.id || '').toUpperCase(),
      summary: JSON.stringify(event.payload || event).slice(0, 220),
    })).filter((row) => {
      if (symbolFilter && row.symbol !== symbolFilter) return false;
      if (typeFilter && !String(row.type || '').toLowerCase().includes(typeFilter)) return false;
      if (ideaFilter && row.idea_id !== ideaFilter) return false;
      return true;
    });
    print({ journal_timeline: rows, filters: { symbol: symbolFilter, event_type: typeFilter, idea_id: ideaFilter }, mode: 'research_only' });
  },
  bindFilters() {
    window.workstationModuleGuard?.missing('journal', { globals: ['api', '$', 'print'], elements: ['researchToolsStrip'] });
    window.journalModule.ensureControls();
  },
};

window.journalFilterValue = window.journalModule.filterValue;
window.loadJournalTimeline = window.journalModule.loadTimeline;
if (window.workstationBoot) window.workstationBoot.register('journal-module', () => window.journalModule.bindFilters());
else setTimeout(() => window.journalModule.bindFilters(), 0);
