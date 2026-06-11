(function installCryptoHistoryFetchShim() {
  const FULL_CRYPTO_HISTORY_CANDLE_LIMIT = 5000;
  const originalFetch = window.fetch ? window.fetch.bind(window) : null;

  function shouldExpandCryptoHistory(url) {
    if (!url || url.pathname !== '/api/crypto/candles') return false;
    const interval = String(url.searchParams.get('interval') || '').toLowerCase();
    if (interval !== '1d' && interval !== '1w') return false;
    const currentLimit = Number(url.searchParams.get('limit') || '0');
    return !Number.isFinite(currentLimit) || currentLimit < FULL_CRYPTO_HISTORY_CANDLE_LIMIT;
  }

  function rewriteCryptoHistoryRequest(input) {
    const rawUrl = typeof input === 'string' ? input : input && input.url;
    if (!rawUrl) return input;
    const url = new URL(rawUrl, window.location.origin);
    if (!shouldExpandCryptoHistory(url)) return input;
    url.searchParams.set('limit', String(FULL_CRYPTO_HISTORY_CANDLE_LIMIT));
    if (typeof input === 'string') return url.pathname + url.search;
    return new Request(url.pathname + url.search, input);
  }

  if (!originalFetch) return;
  window.fetch = function cryptoHistoryFetch(input, init) {
    return originalFetch(rewriteCryptoHistoryRequest(input), init);
  };
  window.workstationCryptoHistoryFetchShim = {
    FULL_CRYPTO_HISTORY_CANDLE_LIMIT,
    rewriteCryptoHistoryRequest,
  };
})();
