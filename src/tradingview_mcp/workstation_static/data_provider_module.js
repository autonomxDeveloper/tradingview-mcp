(function() {
  const STORAGE_KEY = 'workstation-data-provider-state';
  const DEFAULT_STATE = {
    stockProvider: 'yahoo',
    stockFeed: 'iex',
    cryptoVenue: 'binance',
  };
  const STOCK_PROVIDER_LABELS = {
    yahoo: 'Yahoo fallback · free research mode · delayed/provider-dependent',
    alpaca_iex: 'Alpaca IEX · free live equities feed when credentials are configured',
    alpaca_sip: 'Alpaca SIP · paid/fuller-market feed when enabled on your Alpaca account',
  };
  const CRYPTO_VENUE_LABELS = {
    binance: 'Binance public REST candles · free/rate-limited',
    coinbase: 'Coinbase public REST candles · free/rate-limited',
    kraken: 'Kraken public REST candles · free/rate-limited',
  };
  const ALPACA_TIMEFRAMES = {
    '1m': '1Min',
    '5m': '5Min',
    '15m': '15Min',
    '30m': '30Min',
    '1h': '1Hour',
    '1d': '1Day',
    '1w': '1Week',
  };

  function readState() {
    try {
      return { ...DEFAULT_STATE, ...(JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') || {}) };
    } catch (_) {
      return { ...DEFAULT_STATE };
    }
  }

  function writeState(next) {
    const state = { ...readState(), ...(next || {}) };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    window.workstationDataProviders = state;
    updateControls(state);
    updateStatus('Provider settings updated. Reloading chart data...');
    if (typeof window.loadMarket === 'function') {
      window.loadMarket().catch((error) => updateStatus(`Provider reload failed: ${error.message}`, true));
    }
  }

  function currentState() {
    if (!window.workstationDataProviders) window.workstationDataProviders = readState();
    return window.workstationDataProviders;
  }

  function selectedStockProvider() {
    return currentState().stockProvider || DEFAULT_STATE.stockProvider;
  }

  function selectedStockFeed() {
    const provider = selectedStockProvider();
    if (provider === 'alpaca_sip') return 'sip';
    return currentState().stockFeed || DEFAULT_STATE.stockFeed;
  }

  function selectedCryptoVenue() {
    return currentState().cryptoVenue || DEFAULT_STATE.cryptoVenue;
  }

  function alpacaTimeframe(value) {
    return ALPACA_TIMEFRAMES[String(value || '1D').toLowerCase()] || '1Day';
  }

  function updateUrlParam(url, name, value) {
    const base = window.location.origin;
    const parsed = new URL(url, base);
    parsed.searchParams.set(name, value);
    return parsed.pathname + parsed.search;
  }

  function isChartRequest(url) {
    const text = typeof url === 'string' ? url : String(url && url.url ? url.url : url || '');
    return text.includes('/api/stock/yahoo-chart') || text.includes('/api/crypto/candles');
  }

  function rewriteChartUrl(url) {
    const text = typeof url === 'string' ? url : String(url && url.url ? url.url : url || '');
    if (text.includes('/api/crypto/candles')) {
      return updateUrlParam(text, 'venue', selectedCryptoVenue());
    }
    if (!text.includes('/api/stock/yahoo-chart')) return text;
    if (selectedStockProvider() === 'yahoo') return text;
    const parsed = new URL(text, window.location.origin);
    const symbol = parsed.searchParams.get('symbol') || '';
    const timeframe = alpacaTimeframe(parsed.searchParams.get('timeframe') || '1D');
    const limit = parsed.searchParams.get('limit') || '300';
    const feed = selectedStockFeed();
    return `/api/stock/alpaca-bars?symbol=${encodeURIComponent(symbol)}&timeframe=${encodeURIComponent(timeframe)}&limit=${encodeURIComponent(limit)}&feed=${encodeURIComponent(feed)}`;
  }

  function normalizeAlpacaBarTime(value) {
    if (Number.isFinite(value)) return value > 9999999999 ? Math.floor(value / 1000) : value;
    const parsed = Date.parse(value || '');
    return Number.isFinite(parsed) ? Math.floor(parsed / 1000) : value;
  }

  function normalizeAlpacaChartPayload(payload) {
    if (!payload || payload.error) return payload;
    const candles = (payload.bars || []).map((bar) => ({
      time: normalizeAlpacaBarTime(bar.t || bar.time),
      open: Number(bar.o ?? bar.open),
      high: Number(bar.h ?? bar.high),
      low: Number(bar.l ?? bar.low),
      close: Number(bar.c ?? bar.close),
      volume: Number(bar.v ?? bar.volume ?? 0),
    })).filter((bar) => Number.isFinite(bar.open) && Number.isFinite(bar.high) && Number.isFinite(bar.low) && Number.isFinite(bar.close));
    return {
      ...payload,
      candles,
      metadata: {
        ...(payload.metadata || {}),
        source: `alpaca_${payload.feed || selectedStockFeed()}_bars`,
        provider_mode: selectedStockProvider(),
        licensing_note: selectedStockProvider() === 'alpaca_sip' ? 'paid/fuller-market feed if enabled on Alpaca account' : 'free IEX feed when Alpaca credentials are configured',
      },
      source: `alpaca_${payload.feed || selectedStockFeed()}_bars`,
    };
  }

  function copyResponseHeaders(response) {
    const headers = new Headers(response.headers || {});
    headers.set('content-type', 'application/json');
    return headers;
  }

  function wrapFetch() {
    if (window.workstationDataProviderFetchWrapped) return;
    window.workstationDataProviderFetchWrapped = true;
    const originalFetch = window.fetch.bind(window);
    window.fetch = async function(input, init) {
      const url = typeof input === 'string' ? input : String(input && input.url ? input.url : input || '');
      if (!isChartRequest(url)) return originalFetch(input, init);
      const rewritten = rewriteChartUrl(url);
      const response = await originalFetch(rewritten, init);
      if (!url.includes('/api/stock/yahoo-chart') || selectedStockProvider() === 'yahoo') return response;
      let payload;
      try {
        payload = await response.clone().json();
      } catch (_) {
        return response;
      }
      const normalized = normalizeAlpacaChartPayload(payload);
      const errorMessage = normalized && normalized.error ? (normalized.error.message || normalized.error.code || 'provider error') : '';
      updateStatus(errorMessage ? `Alpaca provider warning: ${errorMessage}` : providerStatusText(), !!errorMessage);
      return new Response(JSON.stringify(normalized), {
        status: response.status,
        statusText: response.statusText,
        headers: copyResponseHeaders(response),
      });
    };
  }

  function providerStatusText() {
    const state = currentState();
    return `Stocks: ${STOCK_PROVIDER_LABELS[state.stockProvider] || state.stockProvider}; Crypto: ${CRYPTO_VENUE_LABELS[state.cryptoVenue] || state.cryptoVenue}`;
  }

  function updateStatus(message, isError) {
    const status = document.getElementById('dataProviderStatus');
    if (!status) return;
    status.textContent = message || providerStatusText();
    status.classList.toggle('provider-error', !!isError);
  }

  function updateControls(state = currentState()) {
    const stockSelect = document.getElementById('stockDataProvider');
    const cryptoSelect = document.getElementById('cryptoDataVenue');
    if (stockSelect) stockSelect.value = state.stockProvider || DEFAULT_STATE.stockProvider;
    if (cryptoSelect) cryptoSelect.value = state.cryptoVenue || DEFAULT_STATE.cryptoVenue;
    updateStatus(providerStatusText());
  }

  function addControls() {
    const topbar = document.querySelector('.topbar');
    if (!topbar || document.getElementById('dataProviderControls')) return;
    const group = document.createElement('div');
    group.id = 'dataProviderControls';
    group.className = 'data-provider-controls';
    group.innerHTML = `
      <label class="data-provider-field">Stock data
        <select id="stockDataProvider" aria-label="Stock data provider">
          <option value="yahoo">Yahoo fallback</option>
          <option value="alpaca_iex">Alpaca IEX free</option>
          <option value="alpaca_sip">Alpaca SIP paid</option>
        </select>
      </label>
      <label class="data-provider-field">Crypto venue
        <select id="cryptoDataVenue" aria-label="Crypto data venue">
          <option value="binance">Binance</option>
          <option value="coinbase">Coinbase</option>
          <option value="kraken">Kraken</option>
        </select>
      </label>
      <span id="dataProviderStatus" class="data-provider-status muted" aria-live="polite"></span>
    `;
    const loadButton = topbar.querySelector('[data-action="market.load"]');
    topbar.insertBefore(group, loadButton || null);
    document.getElementById('stockDataProvider')?.addEventListener('change', (event) => writeState({ stockProvider: event.target.value, stockFeed: event.target.value === 'alpaca_sip' ? 'sip' : 'iex' }));
    document.getElementById('cryptoDataVenue')?.addEventListener('change', (event) => writeState({ cryptoVenue: event.target.value }));
    updateControls();
  }

  function addStyles() {
    if (document.getElementById('dataProviderStyles')) return;
    const style = document.createElement('style');
    style.id = 'dataProviderStyles';
    style.textContent = `
      .data-provider-controls{display:flex;gap:6px;align-items:center;flex-wrap:wrap;border:1px solid #1e293b;border-radius:9px;background:#0b1220;padding:5px 7px}
      .data-provider-field{display:inline-flex;gap:5px;align-items:center;font-size:12px;color:#cbd5e1}
      .data-provider-field select{height:30px;font-size:12px;padding:4px 7px}
      .data-provider-status{max-width:360px;line-height:1.25}
      .data-provider-status.provider-error{color:#fca5a5}
    `;
    document.head.appendChild(style);
  }

  function initDataProviders() {
    window.workstationDataProviders = readState();
    addStyles();
    addControls();
    wrapFetch();
    updateStatus(providerStatusText());
  }

  if (window.workstationBoot) window.workstationBoot.register('data-providers', initDataProviders);
  else initDataProviders();
})();
