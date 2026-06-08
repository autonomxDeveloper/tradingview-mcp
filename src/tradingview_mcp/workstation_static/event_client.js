const eventApi = (() => {
  async function requestJson(url, options = {}) {
    const response = await fetch(url, options);
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    return response.json();
  }

  function normalizeSymbol(symbol) {
    return String(symbol || '').trim().toUpperCase();
  }

  function eventPayload({ source = 'manual', symbol = '', timeframe = '', kind = 'note', message = '', metadata = {} } = {}) {
    return {
      source,
      symbol: normalizeSymbol(symbol),
      timeframe: String(timeframe || '').trim(),
      kind: String(kind || 'note').trim() || 'note',
      message: String(message || '').trim(),
      metadata: metadata && typeof metadata === 'object' ? metadata : {},
    };
  }

  async function readEventStatus() {
    return requestJson('/api/events/status');
  }

  async function listEvents({ symbol = '', limit = 100 } = {}) {
    const params = new URLSearchParams();
    if (normalizeSymbol(symbol)) params.set('symbol', normalizeSymbol(symbol));
    params.set('limit', String(limit));
    return requestJson(`/api/events?${params.toString()}`);
  }

  async function createEvent(input = {}) {
    return requestJson('/api/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(eventPayload(input)),
    });
  }

  return { createEvent, eventPayload, listEvents, normalizeSymbol, readEventStatus };
})();

window.eventApi = eventApi;
