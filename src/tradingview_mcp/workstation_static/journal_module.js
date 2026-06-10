window.journalModule = {
  filterValue(id) {
    return (document.getElementById(id)?.value || '').trim().toUpperCase();
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
    const button = document.querySelector('#journalFilters button');
    if (button) button.onclick = () => window.journalModule.loadTimeline({ currentSymbol: true });
  },
};

window.journalFilterValue = window.journalModule.filterValue;
window.loadJournalTimeline = window.journalModule.loadTimeline;
if (window.workstationBoot) window.workstationBoot.register('journal-module', () => window.journalModule.bindFilters());
else setTimeout(() => window.journalModule.bindFilters(), 0);
