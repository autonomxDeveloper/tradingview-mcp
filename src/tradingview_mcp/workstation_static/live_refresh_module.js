(function() {
  const defaultIntervalMs = 15000;
  const intervalOptions = [5000, 15000, 30000, 60000];
  const secondarySlots = [2, 3, 4];
  const state = {
    enabled: false,
    intervalMs: defaultIntervalMs,
    timer: null,
    inflight: false,
    lastRefreshAt: null,
    lastError: null,
  };

  function $(id) { return document.getElementById(id); }

  function formatTime(value) {
    if (!value) return 'never';
    return new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }

  function statusText() {
    if (state.inflight) return `Live ${state.enabled ? 'on' : 'off'} · refreshing...`;
    if (state.lastError) return `Live ${state.enabled ? 'on' : 'off'} · ${state.lastError}`;
    return `Live ${state.enabled ? 'on' : 'off'} · ${state.intervalMs / 1000}s · updated ${formatTime(state.lastRefreshAt)}`;
  }

  function renderLiveRefreshState() {
    const toggle = $('liveRefreshToggle');
    const interval = $('liveRefreshInterval');
    const status = $('liveRefreshStatus');
    if (toggle) {
      toggle.checked = state.enabled;
      toggle.setAttribute('aria-checked', state.enabled ? 'true' : 'false');
    }
    if (interval) interval.value = String(state.intervalMs);
    if (status) status.textContent = statusText();
  }

  function clearLiveTimer() {
    if (!state.timer) return;
    clearInterval(state.timer);
    state.timer = null;
  }

  function scheduleLiveTimer() {
    clearLiveTimer();
    if (!state.enabled) return;
    state.timer = setInterval(() => refreshLiveChart({ passive: true }), state.intervalMs);
  }

  function withQuietDefaultOutput(callback) {
    const activePrint = window.print;
    if (typeof activePrint !== 'function') return callback();
    window.print = function(value, target = 'output') {
      if (target && target !== 'output') return activePrint(value, target);
      return undefined;
    };
    return Promise.resolve(callback()).finally(() => { window.print = activePrint; });
  }

  async function refreshSecondaryCharts() {
    if (typeof window.renderSlotChart !== 'function') return;
    const slots = window.workstationChartSlots || {};
    await Promise.allSettled(secondarySlots.map((slot) => {
      const slotState = slots[slot] || {};
      if (!slotState.symbol) return Promise.resolve();
      return window.renderSlotChart(slot);
    }));
  }

  async function refreshLiveChart(options = {}) {
    if (state.inflight || typeof window.loadMarket !== 'function') return;
    state.inflight = true;
    state.lastError = null;
    renderLiveRefreshState();
    try {
      const run = async () => {
        await window.loadMarket({ source: 'live-refresh' });
        await refreshSecondaryCharts();
      };
      if (options.passive) await withQuietDefaultOutput(run);
      else await run();
      state.lastRefreshAt = Date.now();
    } catch (error) {
      state.lastError = error && error.message ? error.message : String(error);
    } finally {
      state.inflight = false;
      renderLiveRefreshState();
    }
  }

  function setLiveRefresh(enabled) {
    state.enabled = !!enabled;
    scheduleLiveTimer();
    renderLiveRefreshState();
    if (state.enabled) refreshLiveChart({ passive: true });
  }

  function setLiveRefreshInterval(value) {
    const parsed = Number(value);
    state.intervalMs = intervalOptions.includes(parsed) ? parsed : defaultIntervalMs;
    scheduleLiveTimer();
    renderLiveRefreshState();
  }

  function addLiveRefreshStyles() {
    if (document.getElementById('liveRefreshStyles')) return;
    const style = document.createElement('style');
    style.id = 'liveRefreshStyles';
    style.textContent = '.live-refresh-controls{display:inline-flex;align-items:center;gap:5px;padding:5px 7px;border:1px solid #334155;border-radius:7px;background:#0b1220;font-size:12px;color:#cbd5e1}.live-refresh-controls input{padding:0}.live-refresh-interval{font-size:12px;padding:5px 7px;min-height:28px}.live-refresh-status{display:inline-flex;align-items:center;min-height:24px;padding:3px 7px;border:1px solid #334155;border-radius:7px;background:#0b1220}';
    document.head.appendChild(style);
  }

  function addLiveRefreshControls() {
    if ($('liveRefreshControls')) return;
    const chartControls = document.querySelector('.chart-controls') || document.querySelector('.chartbar');
    if (!chartControls) return;
    const group = document.createElement('label');
    group.id = 'liveRefreshControls';
    group.className = 'live-refresh-controls';
    group.innerHTML = '<input id="liveRefreshToggle" type="checkbox" data-action="live.toggle" data-action-event="change" data-action-value="checked" /> <span>Live</span>';
    const interval = document.createElement('select');
    interval.id = 'liveRefreshInterval';
    interval.className = 'live-refresh-interval';
    interval.dataset.action = 'live.setInterval';
    interval.dataset.actionEvent = 'change';
    interval.dataset.actionValue = 'value';
    interval.setAttribute('aria-label', 'Live refresh interval');
    intervalOptions.forEach((option) => {
      const item = document.createElement('option');
      item.value = String(option);
      item.textContent = `${option / 1000}s`;
      interval.appendChild(item);
    });
    const status = document.createElement('span');
    status.id = 'liveRefreshStatus';
    status.className = 'live-refresh-status muted';
    status.setAttribute('aria-live', 'polite');
    chartControls.appendChild(group);
    chartControls.appendChild(interval);
    chartControls.appendChild(status);
    if (typeof window.bindWorkstationActions === 'function') window.bindWorkstationActions(chartControls);
    renderLiveRefreshState();
  }

  function wrapLoadMarketRefreshMarker() {
    if (window.workstationLiveRefreshWrapped || typeof window.loadMarket !== 'function') return;
    const baseLoadMarket = window.loadMarket;
    window.loadMarket = async function(...args) {
      const result = await baseLoadMarket.apply(this, args);
      state.lastRefreshAt = Date.now();
      state.lastError = null;
      renderLiveRefreshState();
      return result;
    };
    window.workstationLiveRefreshWrapped = true;
  }

  function bootLiveRefresh() {
    addLiveRefreshStyles();
    addLiveRefreshControls();
    wrapLoadMarketRefreshMarker();
    renderLiveRefreshState();
  }

  window.setLiveRefresh = setLiveRefresh;
  window.setLiveRefreshInterval = setLiveRefreshInterval;
  window.refreshLiveChart = refreshLiveChart;

  if (window.workstationBoot) window.workstationBoot.register('live-refresh', bootLiveRefresh);
  else if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bootLiveRefresh);
  else bootLiveRefresh();
})();
