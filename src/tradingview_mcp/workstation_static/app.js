let chart, candles, volume, lastPayload = null;

function $(id) { return document.getElementById(id); }

async function api(url, opts = {}) {
  const response = await fetch(url, opts);
  if (!response.ok) throw new Error(response.status + ' ' + response.statusText);
  return response.json();
}

function post(url, body) {
  return api(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
}

function print(value, target = 'output') {
  $(target).textContent = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
}

function initChart() {
  chart = LightweightCharts.createChart($('chart'), {
    layout: { background: { color: '#0b1020' }, textColor: '#d1d5db' },
    grid: { vertLines: { color: '#1f2937' }, horzLines: { color: '#1f2937' } },
  });
  candles = chart.addCandlestickSeries();
  volume = chart.addHistogramSeries({ priceFormat: { type: 'volume' }, priceScaleId: '' });
  volume.priceScale().applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });
  window.onresize = () => chart.resize($('chart').clientWidth, $('chart').clientHeight);
}

async function boot() {
  initChart();
  const health = await api('/api/health');
  $('status').textContent = 'LM Studio ' + health.lmstudio_base_url;
  print({ workstation: health.workstation, ideas: health.ideas, backtests: health.backtests }, 'risk');
  const watchlist = await api('/api/watchlist');
  $('watch').innerHTML = '';
  watchlist.symbols.forEach((symbol) => {
    const button = document.createElement('button');
    button.textContent = symbol;
    button.onclick = () => {
      $('symbol').value = symbol;
      if (symbol.includes('USDT')) {
        $('asset').value = 'crypto';
        $('exchange').value = 'BINANCE';
      } else {
        $('asset').value = 'stock';
        $('exchange').value = 'NASDAQ';
      }
      loadMarket();
    };
    $('watch').appendChild(button);
  });
  loadMarket();
}

function activeIsCrypto() {
  const symbol = $('symbol').value.toUpperCase();
  return $('asset').value === 'crypto' || symbol.endsWith('USDT') || symbol.endsWith('-USD');
}

async function loadMarket() {
  const symbol = $('symbol').value.trim();
  const timeframe = $('tf').value;
  if (activeIsCrypto()) {
    lastPayload = await api(`/api/crypto/candles?symbol=${encodeURIComponent(symbol)}&venue=binance&interval=${encodeURIComponent(timeframe.toLowerCase())}&limit=300`);
    const bars = (lastPayload.bars || []).map((bar) => ({
      time: bar.open_time ? Math.floor(bar.open_time / 1000) : bar.time,
      open: +bar.open,
      high: +bar.high,
      low: +bar.low,
      close: +bar.close,
      volume: +bar.volume,
    }));
    candles.setData(bars);
    volume.setData(bars.map((bar) => ({ time: bar.time, value: bar.volume })));
  } else {
    lastPayload = await api(`/api/stock/yahoo-chart?symbol=${encodeURIComponent(symbol)}&timeframe=${encodeURIComponent(timeframe)}&limit=300`);
    const bars = (lastPayload.candles || []).map((bar) => ({
      time: bar.time,
      open: +bar.open,
      high: +bar.high,
      low: +bar.low,
      close: +bar.close,
      volume: +bar.volume,
    }));
    candles.setData(bars);
    volume.setData(bars.map((bar) => ({ time: bar.time, value: bar.volume })));
  }
  chart.timeScale().fitContent();
  print(lastPayload);
}

async function analyze() {
  print('Analyzing...', 'analysis');
  const response = await post('/api/ai/analyze', {
    symbol: $('symbol').value,
    asset_type: $('asset').value,
    exchange: $('exchange').value,
    timeframe: $('tf').value,
    question: $('question').value,
  });
  print(response.analysis?.content || response, 'analysis');
}

async function runBacktest() {
  const response = await post('/api/backtest/run', {
    symbol: $('symbol').value,
    strategy: $('strategy').value,
    period: $('period').value,
    include_trade_log: true,
    include_equity_curve: true,
    idea_id: $('ideaId').value || null,
  });
  print(response);
}

async function compareStrategies() {
  print(await api(`/api/backtest/compare?symbol=${encodeURIComponent($('symbol').value)}&period=${$('period').value}`));
}

async function loadBacktests() {
  print(await api(`/api/backtests?symbol=${encodeURIComponent($('symbol').value)}&limit=100`));
}

async function saveIdea() {
  const body = {
    symbol: $('symbol').value,
    asset_type: activeIsCrypto() ? 'crypto' : 'stock',
    timeframe: $('tf').value,
    bias: 'unknown',
    hypothesis: $('hypothesis').value,
    invalidation: $('invalidation').value,
    backtest_plan: $('backtestPlan').value,
    source: 'workstation',
  };
  print(await post('/api/ideas', body));
}

async function loadIdeas() {
  print(await api('/api/ideas?limit=100'));
}

function showPayload() {
  print(lastPayload || 'No payload');
}

async function loadJournal() {
  print(await api('/api/journal?limit=100'));
}

boot().catch((error) => print(error.message));
