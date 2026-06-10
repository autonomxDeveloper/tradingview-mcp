(function() {
  let scannerRows = [];

  function watchSymbols() {
    return [...document.querySelectorAll('#watch button')].map((button) => button.textContent.trim()).filter(Boolean);
  }

  function scannerExchange(symbol) {
    return symbol.includes('USDT') ? 'BINANCE' : 'NASDAQ';
  }

  async function scanWatchlist() {
    const symbols = watchSymbols().slice(0, 8);
    print('Scanning watchlist...');
    const rows = [];
    for (const symbol of symbols) {
      try {
        const exchange = scannerExchange(symbol);
        const result = await api(`/api/technical?symbol=${encodeURIComponent(symbol)}&exchange=${exchange}&timeframe=${encodeURIComponent($('tf').value)}`);
        const sentiment = result.market_sentiment || {};
        const price = result.price_data || {};
        rows.push({
          symbol,
          exchange,
          change_percent: price.change_percent,
          rating: sentiment.overall_rating,
          signal: sentiment.buy_sell_signal,
          momentum: sentiment.momentum,
          error: result.error,
        });
      } catch (error) {
        rows.push({ symbol, error: error.message });
      }
    }
    scannerRows = rows;
    window.workstationScannerRows = rows;
    print({ scanner: rows, mode: 'research_only' });
    if (rows.length) useScannerCandidate(rows[0]);
  }

  function useScannerCandidate(row) {
    if (!row) return;
    $('symbol').value = row.symbol;
    if (row.symbol.includes('USDT')) {
      $('asset').value = 'crypto';
      $('exchange').value = 'BINANCE';
    } else {
      $('asset').value = 'stock';
      $('exchange').value = 'NASDAQ';
    }
    $('hypothesis').value = `${row.symbol} scanner candidate: ${row.signal || row.momentum || 'review'} on ${$('tf').value}.`;
    $('invalidation').value = 'Invalidate if follow-up chart review contradicts the scanner signal.';
    $('backtestPlan').value = `Backtest ${row.symbol} with multiple strategies and compare against buy-and-hold before treating this as a watchlist idea.`;
    print({ selected_scanner_candidate: row, mode: 'research_only' });
  }

  function useTopScannerCandidate() {
    const rows = scannerRows.length ? scannerRows : (window.workstationScannerRows || []);
    if (!rows.length) { print('Run scanner first.'); return; }
    useScannerCandidate(rows[0]);
    loadMarket();
  }

  window.watchSymbols = watchSymbols;
  window.scannerExchange = scannerExchange;
  window.scanWatchlist = scanWatchlist;
  window.useScannerCandidate = useScannerCandidate;
  window.useTopScannerCandidate = useTopScannerCandidate;
})();
