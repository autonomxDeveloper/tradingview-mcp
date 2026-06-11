(function installStockSymbolContextShim() {
  const CRYPTO_BASE_SYMBOLS = new Set(['BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'ADA', 'DOGE', 'AVAX', 'LINK', 'MATIC', 'DOT', 'LTC', 'BCH']);
  const ETF_EXCHANGE_HINTS = new Set(['SPY', 'QQQ', 'IWM', 'DIA', 'GLD', 'SLV', 'TLT', 'XLE', 'XLK', 'XLF', 'XLY', 'XLV', 'XLI', 'XLP', 'XLU', 'XLB', 'XLRE', 'XLC']);
  const STOCK_INTERVALS = new Set(['1m', '2m', '5m', '15m', '30m', '1h', '1D', '1W', '1M']);

  function element(id) {
    return document.getElementById(id);
  }

  function cleanSymbol() {
    return String(element('symbol') && element('symbol').value || '').trim().toUpperCase();
  }

  function symbolLooksCrypto(symbol) {
    const normalized = String(symbol || '').trim().toUpperCase().replace('/', '').replace('-', '');
    if (!normalized) return false;
    if (CRYPTO_BASE_SYMBOLS.has(normalized)) return true;
    return normalized.endsWith('USDT') || normalized.endsWith('USDC') || normalized.endsWith('USD') && normalized.length > 4;
  }

  function stockExchangeFor(symbol) {
    return ETF_EXCHANGE_HINTS.has(symbol) ? 'AMEX' : 'NASDAQ';
  }

  function ensureStockSafeTimeframe() {
    const timeframe = element('tf');
    if (!timeframe) return;
    if (!STOCK_INTERVALS.has(timeframe.value)) {
      timeframe.value = '1D';
    }
  }

  function normalizeMarketContext() {
    const symbol = cleanSymbol();
    const asset = element('asset');
    const exchange = element('exchange');
    if (!symbol || !asset || !exchange) return;

    if (symbolLooksCrypto(symbol)) {
      if (asset.value !== 'crypto') asset.value = 'crypto';
      if (!exchange.value || exchange.value.toUpperCase() !== 'BINANCE') exchange.value = 'BINANCE';
      return;
    }

    if (asset.value === 'crypto' || exchange.value.toUpperCase() === 'BINANCE') {
      asset.value = 'stock';
      exchange.value = stockExchangeFor(symbol);
      ensureStockSafeTimeframe();
    }
  }

  function wrapLoadMarket() {
    const original = window.loadMarket;
    if (typeof original !== 'function' || original.__stockSymbolContextShim) return;
    window.loadMarket = function stockAwareLoadMarket() {
      normalizeMarketContext();
      return original.apply(this, arguments);
    };
    window.loadMarket.__stockSymbolContextShim = true;
  }

  function installInputListeners() {
    const symbol = element('symbol');
    const asset = element('asset');
    if (symbol) {
      symbol.addEventListener('change', normalizeMarketContext);
      symbol.addEventListener('blur', normalizeMarketContext);
    }
    if (asset) asset.addEventListener('change', normalizeMarketContext);
  }

  function install() {
    wrapLoadMarket();
    installInputListeners();
    window.workstationStockSymbolContextShim = {
      normalizeMarketContext,
      symbolLooksCrypto,
      stockExchangeFor,
    };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
  else install();
})();
