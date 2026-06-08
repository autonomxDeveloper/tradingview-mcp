let chart, candles, volume, lastPayload = null;
let currentBars = [];
let volumeVisible = true;
let overlaySeries = {};
let overlayState = { sma20: false, sma50: false, ema21: false };

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
    crosshair: { mode: LightweightCharts.CrosshairMode.Normal },
    rightPriceScale: { borderColor: '#334155', scaleMargins: { top: 0.08, bottom: 0.18 } },
    timeScale: { borderColor: '#334155', timeVisible: true, secondsVisible: false },
  });
  candles = chart.addCandlestickSeries({ priceLineVisible: true, lastValueVisible: true });
  volume = chart.addHistogramSeries({ priceFormat: { type: 'volume' }, priceScaleId: '', lastValueVisible: false, priceLineVisible: false });
  volume.priceScale().applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });
  chart.subscribeCrosshairMove((param) => updateLegend(param));
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

function normalizeBars(rawBars) {
  return rawBars.filter((bar) => Number.isFinite(bar.open) && Number.isFinite(bar.high) && Number.isFinite(bar.low) && Number.isFinite(bar.close));
}

async function loadMarket() {
  const symbol = $('symbol').value.trim();
  const timeframe = $('tf').value;
  if (activeIsCrypto()) {
    lastPayload = await api(`/api/crypto/candles?symbol=${encodeURIComponent(symbol)}&venue=binance&interval=${encodeURIComponent(timeframe.toLowerCase())}&limit=300`);
    currentBars = normalizeBars((lastPayload.bars || []).map((bar) => ({
      time: bar.open_time ? Math.floor(bar.open_time / 1000) : bar.time,
      open: +bar.open,
      high: +bar.high,
      low: +bar.low,
      close: +bar.close,
      volume: +bar.volume,
    })));
  } else {
    lastPayload = await api(`/api/stock/yahoo-chart?symbol=${encodeURIComponent(symbol)}&timeframe=${encodeURIComponent(timeframe)}&limit=300`);
    currentBars = normalizeBars((lastPayload.candles || []).map((bar) => ({
      time: bar.time,
      open: +bar.open,
      high: +bar.high,
      low: +bar.low,
      close: +bar.close,
      volume: +bar.volume,
    })));
  }
  renderChartSeries();
  fitChart();
  updateChartMeta();
  updateLegend();
  print(lastPayload);
}

function renderChartSeries() {
  candles.setData(currentBars.map((bar) => ({ time: bar.time, open: bar.open, high: bar.high, low: bar.low, close: bar.close })));
  volume.setData(currentBars.map((bar) => ({ time: bar.time, value: bar.volume })));
  applyOverlayData();
}

function movingAverage(period) {
  const points = [];
  let sum = 0;
  currentBars.forEach((bar, index) => {
    sum += bar.close;
    if (index >= period) sum -= currentBars[index - period].close;
    if (index >= period - 1) points.push({ time: bar.time, value: +(sum / period).toFixed(6) });
  });
  return points;
}

function exponentialMovingAverage(period) {
  const points = [];
  const k = 2 / (period + 1);
  let ema = null;
  currentBars.forEach((bar, index) => {
    ema = ema === null ? bar.close : bar.close * k + ema * (1 - k);
    if (index >= period - 1) points.push({ time: bar.time, value: +ema.toFixed(6) });
  });
  return points;
}

function ensureOverlay(name) {
  if (!overlaySeries[name]) {
    overlaySeries[name] = chart.addLineSeries({ lineWidth: 2, lastValueVisible: false, priceLineVisible: false });
  }
  return overlaySeries[name];
}

function applyOverlayData() {
  Object.entries(overlayState).forEach(([name, enabled]) => {
    if (!enabled) {
      if (overlaySeries[name]) overlaySeries[name].setData([]);
      return;
    }
    const series = ensureOverlay(name);
    if (name === 'sma20') series.setData(movingAverage(20));
    if (name === 'sma50') series.setData(movingAverage(50));
    if (name === 'ema21') series.setData(exponentialMovingAverage(21));
  });
}

function toggleOverlay(name) {
  overlayState[name] = !overlayState[name];
  applyOverlayData();
}

function toggleVolume() {
  volumeVisible = !volumeVisible;
  volume.applyOptions({ visible: volumeVisible });
}

function fitChart() {
  chart.timeScale().fitContent();
}

function updateChartMeta() {
  const metadata = lastPayload?.metadata || {};
  const source = metadata.source || lastPayload?.source || 'unknown source';
  const cache = metadata.cache_status ? ` · ${metadata.cache_status}${metadata.stale ? ' stale' : ''}` : '';
  $('chartMeta').textContent = `${$('symbol').value.toUpperCase()} · ${$('tf').value} · ${source}${cache}`;
}

function updateLegend(param) {
  if (!currentBars.length) {
    $('legend').textContent = 'No chart data loaded.';
    return;
  }
  let bar = currentBars[currentBars.length - 1];
  if (param && param.time) {
    const match = currentBars.find((candidate) => candidate.time === param.time);
    if (match) bar = match;
  }
  const change = bar.close - bar.open;
  const changePct = bar.open ? (change / bar.open) * 100 : 0;
  const klass = change >= 0 ? 'up' : 'down';
  $('legend').innerHTML = `<strong>${$('symbol').value.toUpperCase()}</strong> O ${fmt(bar.open)} H ${fmt(bar.high)} L ${fmt(bar.low)} C ${fmt(bar.close)} <span class="${klass}">${fmt(change)} (${changePct.toFixed(2)}%)</span> Vol ${fmtVolume(bar.volume)}`;
}

function fmt(value) {
  if (!Number.isFinite(value)) return '-';
  return Math.abs(value) >= 1000 ? value.toFixed(2) : value.toPrecision(6).replace(/0+$/, '').replace(/\.$/, '');
}

function fmtVolume(value) {
  if (!Number.isFinite(value)) return '-';
  if (value >= 1000000000) return (value / 1000000000).toFixed(2) + 'B';
  if (value >= 1000000) return (value / 1000000).toFixed(2) + 'M';
  if (value >= 1000) return (value / 1000).toFixed(2) + 'K';
  return String(value);
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
