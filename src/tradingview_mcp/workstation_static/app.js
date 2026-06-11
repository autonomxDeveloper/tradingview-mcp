let chart, candles, volume, lastPayload = null;
let rsiChart = null, rsiSeries = null, rsiTopLine = null, rsiBottomLine = null;
let macdChart = null, macdSeries = null, macdSignalSeries = null, macdHistogram = null;
let atrChart = null, atrSeries = null;
let currentBars = [];
let volumeVisible = true, rsiVisible = false, macdVisible = false, atrVisible = false;
let overlaySeries = {};
let overlayState = { sma20: false, sma50: false, ema21: false };
let drawings = { levels: [], notes: [], zones: [], guides: [] };
let priceLineHandles = [];

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
  window.workstationPrimaryChart = chart;
  window.workstationPrimaryCandles = candles;
  window.workstationPrimaryVolume = volume;
  chart.subscribeCrosshairMove((param) => updateLegend(param));
  styleIndicatorPane('rsiWrap', 'rsiChart', 'rsiLegend');
  styleIndicatorPane('macdWrap', 'macdChart', 'macdLegend');
  styleIndicatorPane('atrWrap', 'atrChart', 'atrLegend');
  window.onresize = () => resizePrimaryChartToSurface();
}

function resizePrimaryChartToSurface() {
  if (!chart || !$('chart')) return;
  chart.resize($('chart').clientWidth, $('chart').clientHeight);
  if (rsiChart && rsiVisible) rsiChart.resize($('rsiChart').clientWidth, $('rsiChart').clientHeight);
  if (macdChart && macdVisible) macdChart.resize($('macdChart').clientWidth, $('macdChart').clientHeight);
  if (atrChart && atrVisible) atrChart.resize($('atrChart').clientWidth, $('atrChart').clientHeight);
  fitChart();
}

function scheduleChartSurfaceRefresh() {
  window.requestAnimationFrame(() => {
    resizePrimaryChartToSurface();
    window.setTimeout(resizePrimaryChartToSurface, 80);
    window.setTimeout(resizePrimaryChartToSurface, 250);
  });
}

function styleIndicatorPane(wrapId, panelId, legendId) {
  const wrap = $(wrapId), panel = $(panelId), legend = $(legendId);
  if (!wrap || !panel || !legend) return;
  wrap.style.position = 'relative';
  wrap.style.height = '140px';
  wrap.style.background = '#0b1020';
  wrap.style.borderTop = '1px solid #263044';
  wrap.style.display = 'none';
  panel.style.height = '100%';
  panel.style.width = '100%';
  legend.style.position = 'absolute';
  legend.style.zIndex = '5';
  legend.style.top = '8px';
  legend.style.left = '12px';
  legend.style.padding = '4px 7px';
  legend.style.border = '1px solid #334155';
  legend.style.borderRadius = '7px';
  legend.style.background = 'rgba(8,13,24,.86)';
  legend.style.fontSize = '12px';
}

function chartOptions() {
  return {
    layout: { background: { color: '#0b1020' }, textColor: '#d1d5db' },
    grid: { vertLines: { color: '#1f2937' }, horzLines: { color: '#1f2937' } },
    rightPriceScale: { borderColor: '#334155' },
    timeScale: { borderColor: '#334155', timeVisible: true, secondsVisible: false },
  };
}

function ensureRsiChart() { if (rsiChart) return; rsiChart = LightweightCharts.createChart($('rsiChart'), chartOptions()); rsiSeries = rsiChart.addLineSeries({ lineWidth: 2, lastValueVisible: true, priceLineVisible: false }); rsiTopLine = rsiChart.addLineSeries({ lineWidth: 1, lastValueVisible: false, priceLineVisible: false }); rsiBottomLine = rsiChart.addLineSeries({ lineWidth: 1, lastValueVisible: false, priceLineVisible: false }); }
function ensureMacdChart() { if (macdChart) return; macdChart = LightweightCharts.createChart($('macdChart'), chartOptions()); macdHistogram = macdChart.addHistogramSeries({ priceLineVisible: false, lastValueVisible: false }); macdSeries = macdChart.addLineSeries({ lineWidth: 2, lastValueVisible: true, priceLineVisible: false }); macdSignalSeries = macdChart.addLineSeries({ lineWidth: 1, lastValueVisible: true, priceLineVisible: false }); }
function ensureAtrChart() { if (atrChart) return; atrChart = LightweightCharts.createChart($('atrChart'), chartOptions()); atrSeries = atrChart.addLineSeries({ lineWidth: 2, lastValueVisible: true, priceLineVisible: false }); }

async function boot() {
  initChart();
  initDateRangeBar();
  const health = await api('/api/health');
  $('status').textContent = 'LM Studio ' + health.lmstudio_base_url;
  print({ workstation: health.workstation, ideas: health.ideas, backtests: health.backtests, layouts: health.layouts }, 'risk');
  const watchlist = await api('/api/watchlist');
  $('watch').innerHTML = '';
  watchlist.symbols.forEach((symbol) => {
    const button = document.createElement('button');
    button.textContent = symbol;
    button.onclick = () => {
      $('symbol').value = symbol;
      if (symbol.includes('USDT')) { $('asset').value = 'crypto'; $('exchange').value = 'BINANCE'; }
      else { $('asset').value = 'stock'; $('exchange').value = 'NASDAQ'; }
      loadMarket();
    };
    $('watch').appendChild(button);
  });
  await loadMarket();
  scheduleChartSurfaceRefresh();
}

function activeIsCrypto() { const symbol = $('symbol').value.toUpperCase(); return $('asset').value === 'crypto' || symbol.endsWith('USDT') || symbol.endsWith('-USD'); }
function normalizeBars(rawBars) { return rawBars.filter((bar) => Number.isFinite(bar.open) && Number.isFinite(bar.high) && Number.isFinite(bar.low) && Number.isFinite(bar.close)); }
function marketCandleLimit(timeframe, isCrypto) { const tf = String(timeframe || '').toLowerCase(); if (!isCrypto) return 500; if (tf === '1d' || tf === '1w') return 5000; return 600; }

async function loadMarket() {
  const symbol = $('symbol').value.trim();
  const timeframe = $('tf').value;
  const isCrypto = activeIsCrypto();
  const candleLimit = marketCandleLimit(timeframe, isCrypto);
  if (isCrypto) {
    lastPayload = await api(`/api/crypto/candles?symbol=${encodeURIComponent(symbol)}&venue=binance&interval=${encodeURIComponent(timeframe.toLowerCase())}&limit=${candleLimit}`);
    currentBars = normalizeBars((lastPayload.bars || []).map((bar) => ({ time: bar.open_time ? Math.floor(bar.open_time / 1000) : bar.time, open: +bar.open, high: +bar.high, low: +bar.low, close: +bar.close, volume: +bar.volume })));
  } else {
    lastPayload = await api(`/api/stock/yahoo-chart?symbol=${encodeURIComponent(symbol)}&timeframe=${encodeURIComponent(timeframe)}&limit=${candleLimit}`);
    currentBars = normalizeBars((lastPayload.candles || []).map((bar) => ({ time: bar.time, open: +bar.open, high: +bar.high, low: +bar.low, close: +bar.close, volume: +bar.volume })));
  }
  renderChartSeries();
  renderRsiPane();
  renderMacdPane();
  renderAtrPane();
  restoreDrawings();
  fitChart();
  updateChartMeta();
  updateDateRangeBar();
  updateLegend();
  print(lastPayload);
  scheduleChartSurfaceRefresh();
}

function renderChartSeries() { candles.setData(currentBars.map((bar) => ({ time: bar.time, open: bar.open, high: bar.high, low: bar.low, close: bar.close }))); volume.setData(currentBars.map((bar) => ({ time: bar.time, value: bar.volume }))); applyOverlayData(); }
function movingAverage(period) { const points = []; let sum = 0; currentBars.forEach((bar, index) => { sum += bar.close; if (index >= period) sum -= currentBars[index - period].close; if (index >= period - 1) points.push({ time: bar.time, value: +(sum / period).toFixed(6) }); }); return points; }
function exponentialMovingAverage(period) { const points = []; const k = 2 / (period + 1); let ema = null; currentBars.forEach((bar, index) => { ema = ema === null ? bar.close : bar.close * k + ema * (1 - k); if (index >= period - 1) points.push({ time: bar.time, value: +ema.toFixed(6) }); }); return points; }
function emaSeries(values, period) { const result = []; const k = 2 / (period + 1); let ema = null; values.forEach((point, index) => { ema = ema === null ? point.value : point.value * k + ema * (1 - k); if (index >= period - 1) result.push({ time: point.time, value: +ema.toFixed(6) }); }); return result; }
function relativeStrengthIndex(period = 14) { const points = []; if (currentBars.length <= period) return points; let gain = 0, loss = 0; for (let i = 1; i <= period; i += 1) { const change = currentBars[i].close - currentBars[i - 1].close; if (change >= 0) gain += change; else loss -= change; } let avgGain = gain / period, avgLoss = loss / period; for (let i = period + 1; i < currentBars.length; i += 1) { const change = currentBars[i].close - currentBars[i - 1].close; avgGain = (avgGain * (period - 1) + Math.max(change, 0)) / period; avgLoss = (avgLoss * (period - 1) + Math.max(-change, 0)) / period; const value = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss); points.push({ time: currentBars[i].time, value: +value.toFixed(4) }); } return points; }
function macdValues() { const closes = currentBars.map((bar) => ({ time: bar.time, value: bar.close })); const fast = emaSeries(closes, 12); const slow = emaSeries(closes, 26); const slowByTime = new Map(slow.map((point) => [point.time, point.value])); const macd = fast.filter((point) => slowByTime.has(point.time)).map((point) => ({ time: point.time, value: +(point.value - slowByTime.get(point.time)).toFixed(6) })); const signal = emaSeries(macd, 9); const signalByTime = new Map(signal.map((point) => [point.time, point.value])); const histogram = macd.filter((point) => signalByTime.has(point.time)).map((point) => ({ time: point.time, value: +(point.value - signalByTime.get(point.time)).toFixed(6) })); return { macd, signal, histogram }; }
function averageTrueRange(period = 14) { const points = []; if (currentBars.length <= period) return points; const ranges = []; for (let i = 1; i < currentBars.length; i += 1) { const bar = currentBars[i]; const previous = currentBars[i - 1]; ranges.push({ time: bar.time, value: Math.max(bar.high - bar.low, Math.abs(bar.high - previous.close), Math.abs(bar.low - previous.close)) }); } let atr = ranges.slice(0, period).reduce((sum, point) => sum + point.value, 0) / period; for (let i = period; i < ranges.length; i += 1) { atr = (atr * (period - 1) + ranges[i].value) / period; points.push({ time: ranges[i].time, value: +atr.toFixed(6) }); } return points; }

function toggleRsiPane() { rsiVisible = !rsiVisible; setPaneVisibility('rsiWrap', rsiVisible); if (rsiVisible) { ensureRsiChart(); renderRsiPane(); rsiChart.resize($('rsiChart').clientWidth, $('rsiChart').clientHeight); rsiChart.timeScale().fitContent(); } }
function toggleMacdPane() { macdVisible = !macdVisible; setPaneVisibility('macdWrap', macdVisible); if (macdVisible) { ensureMacdChart(); renderMacdPane(); macdChart.resize($('macdChart').clientWidth, $('macdChart').clientHeight); macdChart.timeScale().fitContent(); } }
function toggleAtrPane() { atrVisible = !atrVisible; setPaneVisibility('atrWrap', atrVisible); if (atrVisible) { ensureAtrChart(); renderAtrPane(); atrChart.resize($('atrChart').clientWidth, $('atrChart').clientHeight); atrChart.timeScale().fitContent(); } }
function setPaneVisibility(id, visible) { const pane = $(id); if (pane) pane.style.display = visible ? 'block' : 'none'; }
function renderRsiPane() { if (!rsiVisible) return; ensureRsiChart(); const values = relativeStrengthIndex(14); const last = values[values.length - 1]; rsiSeries.setData(values); rsiTopLine.setData(values.map((point) => ({ time: point.time, value: 70 }))); rsiBottomLine.setData(values.map((point) => ({ time: point.time, value: 30 }))); $('rsiLegend').textContent = last ? `RSI 14 ${last.value.toFixed(2)}` : 'RSI 14'; }
function renderMacdPane() { if (!macdVisible) return; ensureMacdChart(); const values = macdValues(); const lastMacd = values.macd[values.macd.length - 1]; const lastSignal = values.signal[values.signal.length - 1]; macdSeries.setData(values.macd); macdSignalSeries.setData(values.signal); macdHistogram.setData(values.histogram.map((point) => ({ time: point.time, value: point.value, color: point.value >= 0 ? '#22c55e' : '#ef4444' }))); $('macdLegend').textContent = lastMacd ? `MACD ${lastMacd.value.toFixed(3)} / ${(lastSignal?.value || 0).toFixed(3)}` : 'MACD'; }
function renderAtrPane() { if (!atrVisible) return; ensureAtrChart(); const values = averageTrueRange(14); const last = values[values.length - 1]; atrSeries.setData(values); $('atrLegend').textContent = last ? `ATR 14 ${last.value.toFixed(2)}` : 'ATR 14'; }

function fitChart() { if (chart) chart.timeScale().fitContent(); }
function applyOverlayData() { Object.values(overlaySeries).forEach((series) => series.setData([])); if (overlayState.sma20) overlaySeries.sma20.setData(movingAverage(20)); if (overlayState.sma50) overlaySeries.sma50.setData(movingAverage(50)); if (overlayState.ema21) overlaySeries.ema21.setData(exponentialMovingAverage(21)); }
function toggleOverlay(key) { if (!overlaySeries[key]) overlaySeries[key] = chart.addLineSeries({ lineWidth: 2, lastValueVisible: false, priceLineVisible: false }); overlayState[key] = !overlayState[key]; applyOverlayData(); }
function updateLegend(param) { const point = param && param.time ? currentBars.find((bar) => bar.time === param.time) : currentBars[currentBars.length - 1]; if (!point) { $('legend').textContent = 'No chart data loaded.'; return; } const change = currentBars.length > 1 ? point.close - currentBars[0].close : 0; const pct = currentBars.length > 1 ? (change / currentBars[0].close) * 100 : 0; $('legend').textContent = `${$('symbol').value.toUpperCase()} O ${point.open.toFixed(2)} H ${point.high.toFixed(2)} L ${point.low.toFixed(2)} C ${point.close.toFixed(2)} ${change.toFixed(2)} (${pct.toFixed(2)}%) Vol ${formatVolume(point.volume)}`; }
function updateChartMeta() { const symbol = $('symbol').value.toUpperCase(); const tf = $('tf').value; const slots = window.workstationChartSlots || {}; if (slots.primary) slots.primary.textContent = `${symbol} ${tf}`; }
function formatVolume(value) { if (!Number.isFinite(value)) return '0'; if (value >= 1e9) return (value / 1e9).toFixed(2) + 'B'; if (value >= 1e6) return (value / 1e6).toFixed(2) + 'M'; if (value >= 1e3) return (value / 1e3).toFixed(2) + 'K'; return value.toFixed(0); }

function initDateRangeBar() {
  const rangeBar = $('dateRangeBar');
  if (!rangeBar) return;
  const buttons = Array.from(rangeBar.querySelectorAll('[data-chart-range]'));
  buttons.forEach((button) => {
    button.onclick = () => applyChartRange(button.dataset.chartRange || 'all');
  });
  updateDateRangeBar();
}

function updateDateRangeBar() {
  const summary = $('dateRangeSummary');
  if (!summary) return;
  if (!currentBars.length) {
    summary.textContent = 'No loaded chart history.';
    return;
  }
  const first = new Date(currentBars[0].time * 1000);
  const last = new Date(currentBars[currentBars.length - 1].time * 1000);
  const history = lastPayload && lastPayload.history ? lastPayload.history : {};
  const mode = history.history_complete ? 'full venue history loaded' : 'loaded window';
  summary.textContent = `${currentBars.length} candles · ${formatDate(first)} → ${formatDate(last)} · ${mode}`;
}

function formatDate(date) {
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function applyChartRange(range) {
  if (!chart || !currentBars.length) return;
  if (range === 'all') {
    chart.timeScale().fitContent();
    return;
  }
  const daysByRange = { '5d': 5, '1m': 31, '3m': 93, '6m': 186, ytd: null, '1y': 366, '5y': 366 * 5 };
  const last = currentBars[currentBars.length - 1].time;
  let from = null;
  if (range === 'ytd') {
    const lastDate = new Date(last * 1000);
    from = Date.UTC(lastDate.getUTCFullYear(), 0, 1) / 1000;
  } else {
    const days = daysByRange[range];
    from = days ? last - days * 86400 : null;
  }
  if (from === null) {
    chart.timeScale().fitContent();
    return;
  }
  chart.timeScale().setVisibleRange({ from, to: last });
}

function restoreDrawings() { priceLineHandles.forEach((handle) => candles.removePriceLine(handle)); priceLineHandles = []; drawings.levels.forEach((level) => { priceLineHandles.push(candles.createPriceLine({ price: +level.price, color: level.color || '#f59e0b', lineWidth: 1, lineStyle: LightweightCharts.LineStyle.Dashed, title: level.label || 'level' })); }); }

boot().catch((error) => print({ error: String(error) }));
