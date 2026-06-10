(function() {
  const endpoint = 'wss://stream.binance.com:9443/ws/';
  const supportedIntervals = new Set(['1s', '1m', '3m', '5m', '15m', '30m', '1h', '2h', '4h', '6h', '8h', '12h', '1d', '3d', '1w', '1M']);
  const state = {
    enabled: false,
    socket: null,
    symbol: '',
    interval: '',
    reconnectTimer: null,
    reconnectAttempts: 0,
    seeding: false,
    lastEventAt: null,
    lastError: null,
  };

  function $(id) { return document.getElementById(id); }

  function normalizeSymbol(value) {
    return String(value || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  }

  function normalizeInterval(value) {
    const clean = String(value || '1m').trim();
    if (clean === '1D') return '1d';
    if (clean === '1W') return '1w';
    return clean.toLowerCase() === '1m' ? '1m' : clean.toLowerCase();
  }

  function activeIsCryptoSymbol() {
    const symbol = normalizeSymbol($('symbol')?.value || '');
    const asset = String($('asset')?.value || '').toLowerCase();
    return asset === 'crypto' || symbol.endsWith('USDT') || symbol.endsWith('USD');
  }

  function selectedCryptoVenue() {
    const liveState = window.workstationDataProviders || {};
    if (liveState.cryptoVenue) return liveState.cryptoVenue;
    try {
      return (JSON.parse(localStorage.getItem('workstation-data-provider-state') || '{}') || {}).cryptoVenue || 'binance';
    } catch (_) {
      return 'binance';
    }
  }

  function streamContext() {
    return {
      symbol: normalizeSymbol($('symbol')?.value || ''),
      interval: normalizeInterval($('tf')?.value || '1m'),
      venue: selectedCryptoVenue(),
    };
  }

  function formatTime(value) {
    if (!value) return 'never';
    return new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }

  function canStream(context = streamContext()) {
    if (!('WebSocket' in window)) return { ok: false, reason: 'WebSocket unavailable in this browser.' };
    if (!activeIsCryptoSymbol()) return { ok: false, reason: 'Streaming is only available for crypto symbols.' };
    if (context.venue !== 'binance') return { ok: false, reason: 'Free WebSocket streaming is currently implemented for Binance only.' };
    if (!context.symbol) return { ok: false, reason: 'Enter a crypto symbol first.' };
    if (!supportedIntervals.has(context.interval)) return { ok: false, reason: `Binance does not support ${context.interval} kline streaming.` };
    return { ok: true };
  }

  function statusText() {
    if (state.lastError) return `Stream ${state.enabled ? 'on' : 'off'} · ${state.lastError}`;
    if (state.socket && state.socket.readyState === WebSocket.OPEN) return `Stream on · ${state.symbol} ${state.interval} · ${formatTime(state.lastEventAt)}`;
    if (state.socket && state.socket.readyState === WebSocket.CONNECTING) return `Stream connecting · ${state.symbol} ${state.interval}`;
    return `Stream ${state.enabled ? 'on' : 'off'} · Binance crypto WebSocket`;
  }

  function renderState() {
    const toggle = $('cryptoStreamToggle');
    const status = $('cryptoStreamStatus');
    if (toggle) {
      toggle.checked = state.enabled;
      toggle.setAttribute('aria-checked', state.enabled ? 'true' : 'false');
    }
    if (status) {
      status.textContent = statusText();
      status.classList.toggle('stream-error', !!state.lastError);
    }
  }

  function addStyles() {
    if ($('cryptoStreamStyles')) return;
    const style = document.createElement('style');
    style.id = 'cryptoStreamStyles';
    style.textContent = '.crypto-stream-controls{display:inline-flex;align-items:center;gap:5px;padding:5px 7px;border:1px solid #334155;border-radius:7px;background:#0b1220;font-size:12px;color:#cbd5e1}.crypto-stream-controls input{padding:0}.crypto-stream-status{display:inline-flex;align-items:center;min-height:24px;padding:3px 7px;border:1px solid #334155;border-radius:7px;background:#0b1220}.crypto-stream-status.stream-error{color:#fca5a5;border-color:#7f1d1d}';
    document.head.appendChild(style);
  }

  function addControls() {
    if ($('cryptoStreamControls')) return;
    const chartControls = document.querySelector('.chart-controls') || document.querySelector('.chartbar');
    if (!chartControls) return;
    const group = document.createElement('label');
    group.id = 'cryptoStreamControls';
    group.className = 'crypto-stream-controls';
    group.innerHTML = '<input id="cryptoStreamToggle" type="checkbox" /> <span>Stream</span>';
    const status = document.createElement('span');
    status.id = 'cryptoStreamStatus';
    status.className = 'crypto-stream-status muted';
    status.setAttribute('aria-live', 'polite');
    chartControls.appendChild(group);
    chartControls.appendChild(status);
    $('cryptoStreamToggle')?.addEventListener('change', (event) => setCryptoStreaming(!!event.target.checked));
    renderState();
  }

  function clearReconnectTimer() {
    if (!state.reconnectTimer) return;
    clearTimeout(state.reconnectTimer);
    state.reconnectTimer = null;
  }

  function closeSocket() {
    clearReconnectTimer();
    if (!state.socket) return;
    const socket = state.socket;
    state.socket = null;
    socket.onopen = null;
    socket.onmessage = null;
    socket.onerror = null;
    socket.onclose = null;
    try { socket.close(); } catch (_) { /* noop */ }
  }

  function normalizeKline(kline) {
    return {
      time: Math.floor(Number(kline.t) / 1000),
      open: Number(kline.o),
      high: Number(kline.h),
      low: Number(kline.l),
      close: Number(kline.c),
      volume: Number(kline.v),
    };
  }

  function applyPrimaryKline(bar, metadata) {
    try {
      if (!Array.isArray(currentBars) || !candles || !volume) return false;
      const index = currentBars.findIndex((candidate) => candidate.time === bar.time);
      if (index >= 0) currentBars[index] = { ...currentBars[index], ...bar };
      else {
        currentBars.push(bar);
        currentBars.sort((left, right) => left.time - right.time);
        if (currentBars.length > 500) currentBars.splice(0, currentBars.length - 500);
      }
      candles.update({ time: bar.time, open: bar.open, high: bar.high, low: bar.low, close: bar.close });
      volume.update({ time: bar.time, value: bar.volume || 0 });
      lastPayload = {
        ...(lastPayload || {}),
        source: 'binance_websocket_kline',
        metadata: {
          ...((lastPayload && lastPayload.metadata) || {}),
          source: 'binance_websocket_kline',
          stream: true,
          stream_symbol: metadata.symbol,
          stream_interval: metadata.interval,
          event_time: metadata.eventTime,
          kline_closed: metadata.closed,
        },
      };
      if (typeof applyOverlayData === 'function') applyOverlayData();
      if (typeof renderRsiPane === 'function') renderRsiPane();
      if (typeof renderMacdPane === 'function') renderMacdPane();
      if (typeof renderAtrPane === 'function') renderAtrPane();
      if (typeof renderHtmlDrawings === 'function') renderHtmlDrawings();
      if (typeof updateChartMeta === 'function') updateChartMeta();
      if (typeof updateLegend === 'function') updateLegend();
      return true;
    } catch (error) {
      state.lastError = error && error.message ? error.message : String(error);
      renderState();
      return false;
    }
  }

  function handleMessage(event) {
    let payload;
    try {
      payload = JSON.parse(event.data);
    } catch (_) {
      return;
    }
    const data = payload.data || payload;
    if (!data || data.e !== 'kline' || !data.k) return;
    const bar = normalizeKline(data.k);
    if (!Number.isFinite(bar.time) || !Number.isFinite(bar.open) || !Number.isFinite(bar.high) || !Number.isFinite(bar.low) || !Number.isFinite(bar.close)) return;
    state.lastEventAt = Date.now();
    state.lastError = null;
    applyPrimaryKline(bar, {
      symbol: data.s || state.symbol,
      interval: data.k.i || state.interval,
      eventTime: data.E,
      closed: !!data.k.x,
    });
    renderState();
  }

  function scheduleReconnect() {
    clearReconnectTimer();
    if (!state.enabled) return;
    const delay = Math.min(30000, 1000 * Math.max(1, state.reconnectAttempts + 1));
    state.reconnectAttempts += 1;
    state.reconnectTimer = setTimeout(() => startCryptoStreaming({ seed: false }), delay);
  }

  async function startCryptoStreaming(options = {}) {
    const context = streamContext();
    const allowed = canStream(context);
    if (!allowed.ok) {
      state.enabled = false;
      state.lastError = allowed.reason;
      closeSocket();
      renderState();
      return false;
    }
    state.enabled = true;
    state.symbol = context.symbol;
    state.interval = context.interval;
    state.lastError = null;
    renderState();
    if (options.seed !== false && typeof window.loadMarket === 'function') {
      state.seeding = true;
      try {
        await window.loadMarket({ source: 'crypto-websocket-seed' });
      } catch (error) {
        state.lastError = `Seed load failed: ${error.message}`;
      } finally {
        state.seeding = false;
      }
    }
    if (typeof window.setLiveRefresh === 'function') window.setLiveRefresh(false);
    closeSocket();
    const streamName = `${context.symbol.toLowerCase()}@kline_${context.interval}`;
    const socket = new WebSocket(endpoint + streamName);
    state.socket = socket;
    socket.onopen = () => {
      state.reconnectAttempts = 0;
      state.lastError = null;
      renderState();
    };
    socket.onmessage = handleMessage;
    socket.onerror = () => {
      state.lastError = 'WebSocket error';
      renderState();
    };
    socket.onclose = () => {
      if (state.socket === socket) state.socket = null;
      renderState();
      scheduleReconnect();
    };
    renderState();
    return true;
  }

  function stopCryptoStreaming() {
    state.enabled = false;
    state.lastError = null;
    closeSocket();
    renderState();
  }

  function setCryptoStreaming(enabled) {
    if (enabled) return startCryptoStreaming({ seed: true });
    stopCryptoStreaming();
    return Promise.resolve(false);
  }

  function wrapContextChanges() {
    if (window.workstationCryptoStreamWrapped || typeof window.loadMarket !== 'function') return;
    const baseLoadMarket = window.loadMarket;
    window.loadMarket = async function(...args) {
      const result = await baseLoadMarket.apply(this, args);
      if (state.enabled && !state.seeding) startCryptoStreaming({ seed: false });
      return result;
    };
    window.workstationCryptoStreamWrapped = true;
  }

  function bootCryptoStreaming() {
    addStyles();
    addControls();
    wrapContextChanges();
    renderState();
  }

  window.setCryptoStreaming = setCryptoStreaming;
  window.startCryptoStreaming = startCryptoStreaming;
  window.stopCryptoStreaming = stopCryptoStreaming;

  if (window.workstationBoot) window.workstationBoot.register('crypto-streaming', bootCryptoStreaming);
  else if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bootCryptoStreaming);
  else bootCryptoStreaming();
})();
