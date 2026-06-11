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
function exponentialMovingAverage(period) { const points = []; const k = 2 / period + 1; let ema = null; currentBars.forEach((bar, index) => { ema = ema === null ? bar.close : bar.close * k + ema * (1 - k); if (index >= period - 1) points.push({ time: bar.time, value: +ema.toFixed(6) }); }); return points; }
function emaSeries(values, period) { const result = []; const k = 2 / (period + 1); let ema = null; values.forEach((point, index) => { ema = ema === null ? point.value : point.value * k + ema * (1 - k); if (index >= period - 1) result.push({ time: point.time, value: +ema.toFixed(6) }); }); return result; }
function relativeStrengthIndex(period = 14) { const points = []; if (currentBars.length <= period) return points; let gain = 0, loss = 0; for (let i = 1; i <= period; i += 1) { const change = currentBars[i].close - currentBars[i - 1].close; if (change >= 0) gain += change; else loss -= change; } let avgGain = gain / period, avgLoss = loss / period; for (let i = period + 1; i < currentBars.length; i += 1) { const change = currentBars[i].close - currentBars[i - 1].close; avgGain = (avgGain * (period - 1) + Math.max(change, 0)) / period; avgLoss = (avgLoss * (period - 1) + Math.max(-change, 0)) / period; const value = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss); points.push({ time: currentBars[i].time, value: +value.toFixed(4) }); } return points; }
function macdValues() { const closes = currentBars.map((bar) => ({ time: bar.time, value: bar.close })); const fast = emaSeries(closes, 12); const slow = emaSeries(closes, 26); const slowByTime = new Map(slow.map((point) => [point.time, point.value])); const macd = fast.filter((point) => slowByTime.has(point.time)).map((point) => ({ time: point.time, value: +(point.value - slowByTime.get(point.time)).toFixed(6) })); const signal = emaSeries(macd, 9); const signalByTime = new Map(signal.map((point) => [point.time, point.value])); const histogram = macd.filter((point) => signalByTime.has(point.time)).map((point) => ({ time: point.time, value: +(point.value - signalByTime.get(point.time)).toFixed(6) })); return { macd, signal, histogram }; }
function averageTrueRange(period = 14) { const points = []; if (currentBars.length <= period) return points; const ranges = []; for (let i = 1; i < currentBars.length; i += 1) { const bar = currentBars[i]; const previous = currentBars[i - 1]; ranges.push({ time: bar.time, value: Math.max(bar.high - bar.low, Math.abs(bar.high - previous.close), Math.abs(bar.low - previous.close)) }); } let atr = ranges.slice(0, period).reduce((sum, point) => sum + point.value, 0) / period; for (let i = period; i < ranges.length; i += 1) { atr = (atr * (period - 1) + ranges[i].value) / period; points.push({ time: ranges[i].time, value: +atr.toFixed(6) }); } return points; }

function toggleRsiPane() { rsiVisible = !rsiVisible; setPaneVisibility('rsiWrap', rsiVisible); if (rsiVisible) { ensureRsiChart(); renderRsiPane(); rsiChart.resize($('rsiChart').clientWidth, $('rsiChart').clientHeight); rsiChart.timeScale().fitContent(); } }
function toggleMacdPane() { macdVisible = !macdVisible; setPaneVisibility('macdWrap', macdVisible); if (macdVisible) { ensureMacdChart(); renderMacdPane(); macdChart.resize($('macdChart').clientWidth, $('macdChart').clientHeight); macdChart.timeScale().fitContent(); } }
function toggleAtrPane() { atrVisible = !atrVisible; setPaneVisibility('atrWrap', atrVisible); if (atrVisible) { ensureAtrChart(); renderAtrPane(); atrChart.resize($('atrChart').clientWidth, $('atrChart').clientHeight); atrChart.timeScale().fitContent(); } }
function setPaneVisibility(id, visible) { const pane = $(id); if (pane) pane.style.display = visible ? 'block' : 'none'; }
function renderRsiPane() { if (!rsiVisible) return; ensureRsiChart(); const values = relativeStrengthIndex(14); const last = values[values.length - 1]; rsiSeries.setData(values); rsiTopLine.setData(values.map((point) => ({ time: point.time, value: 70 }))); rsiBottomLine.setData(values.map((point) => ({ time: point.time, value: 30 }))); $('rsiLegend').textContent = last ? `RSI 14 ${last.value.toFixed(2)}` : 'RSI 14'; }
function renderMacdPane() { if (!macdVisible) return; ensureMacdChart(); const values = macdValues(); const lastMacd = values.macd[values.macd.length - 1]; const lastSignal = values.signal[values.signal.length - 1]; macdSeries.setData(values.macd); macdSignalSeries.setData(values.signal); macdHistogram.setData(values.histogram.map((point) => ({ time: point.time, value: point.value, color: point.value >= 0 ? '#22c55e' : '#ef4444' }))); $('macdLegend').textContent = lastMacd ? `MACD ${lastMacd.value.toFixed(4)} Signal ${lastSignal ? lastSignal.value.toFixed(4) : ''}` : 'MACD'; }
function renderAtrPane() { if (!atrVisible) return; ensureAtrChart(); const values = averageTrueRange(14); const last = values[values.length - 1]; atrSeries.setData(values); $('atrLegend').textContent = last ? `ATR 14 ${last.value.toFixed(4)}` : 'ATR 14'; }

function applyOverlayData() {
  if (overlayState.sma20) setOverlaySeries('sma20', movingAverage(20), { color: '#38bdf8', lineWidth: 2 }); else clearOverlaySeries('sma20');
  if (overlayState.sma50) setOverlaySeries('sma50', movingAverage(50), { color: '#f59e0b', lineWidth: 2 }); else clearOverlaySeries('sma50');
  if (overlayState.ema21) setOverlaySeries('ema21', exponentialMovingAverage(21), { color: '#a855f7', lineWidth: 2 }); else clearOverlaySeries('ema21');
}
function setOverlaySeries(key, data, options) { if (!overlaySeries[key]) overlaySeries[key] = chart.addLineSeries({ priceLineVisible: false, lastValueVisible: false, ...options }); overlaySeries[key].setData(data); }
function clearOverlaySeries(key) { if (overlaySeries[key]) { chart.removeSeries(overlaySeries[key]); delete overlaySeries[key]; } }
function toggleOverlay(key) { overlayState[key] = !overlayState[key]; applyOverlayData(); }
function toggleVolume() { volumeVisible = !volumeVisible; volume.setData(volumeVisible ? currentBars.map((bar) => ({ time: bar.time, value: bar.volume })) : []); }
function fitChart() { if (chart) chart.timeScale().fitContent(); if (rsiChart && rsiVisible) rsiChart.timeScale().fitContent(); if (macdChart && macdVisible) macdChart.timeScale().fitContent(); if (atrChart && atrVisible) atrChart.timeScale().fitContent(); }
function visibleRangeFromDays(days) { if (!chart || !currentBars.length) return; const last = currentBars[currentBars.length - 1].time; chart.timeScale().setVisibleRange({ from: last - days * 86400, to: last }); }

function initDateRangeBar() {
  const rangeButtons = document.querySelectorAll('[data-chart-range-days]');
  rangeButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const value = button.getAttribute('data-chart-range-days');
      if (value === 'all') { fitChart(); return; }
      const days = Number(value || '0');
      if (Number.isFinite(days) && days > 0) visibleRangeFromDays(days);
    });
  });
}

function formatChartDate(time) {
  if (!time) return 'n/a';
  const milliseconds = Number(time) > 100000000000 ? Number(time) : Number(time) * 1000;
  return new Date(milliseconds).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function updateDateRangeBar() {
  const label = $('chartRangeMeta');
  if (!label) return;
  if (!currentBars.length) {
    label.textContent = 'No loaded chart history.';
    return;
  }
  const history = (lastPayload && lastPayload.history) || {};
  const first = history.first_open_time ? Math.floor(Number(history.first_open_time) / 1000) : currentBars[0].time;
  const last = history.last_open_time ? Math.floor(Number(history.last_open_time) / 1000) : currentBars[currentBars.length - 1].time;
  const count = history.bars_count || currentBars.length;
  const suffix = history.history_complete ? 'full venue history loaded' : 'loaded window';
  label.textContent = `${count} candles · ${formatChartDate(first)} → ${formatChartDate(last)} · ${suffix}`;
}

function updateChartMeta() {
  const symbol = $('symbol').value.toUpperCase();
  const tf = $('tf').value;
  const slotText = currentBars.length ? `${symbol} ${tf}` : `${symbol} ${tf}`;
  $('slot1').textContent = 'S1: ' + slotText;
}

function updateLegend(param) {
  if (!currentBars.length) { $('legend').textContent = 'No chart data loaded.'; return; }
  let bar = currentBars[currentBars.length - 1];
  if (param && param.time) { const found = currentBars.find((item) => item.time === param.time); if (found) bar = found; }
  const delta = bar.close - bar.open;
  const pct = bar.open ? delta / bar.open * 100 : 0;
  $('legend').innerHTML = `<b>${$('symbol').value.toUpperCase()}</b> O ${bar.open.toFixed(2)} H ${bar.high.toFixed(2)} L ${bar.low.toFixed(2)} C ${bar.close.toFixed(2)} <span style="color:${delta >= 0 ? '#22c55e' : '#ef4444'}">${delta.toFixed(2)} (${pct.toFixed(2)}%)</span> Vol ${formatVolume(bar.volume)}`;
}
function formatVolume(value) { const number = Number(value || 0); if (number >= 1e9) return (number / 1e9).toFixed(2) + 'B'; if (number >= 1e6) return (number / 1e6).toFixed(2) + 'M'; if (number >= 1e3) return (number / 1e3).toFixed(2) + 'K'; return number.toFixed(0); }

async function saveDrawings() { const payload = { symbol: $('symbol').value, timeframe: $('tf').value, drawings }; const result = await post('/api/drawings', payload); print(result); }
async function restoreDrawings() { const result = await api(`/api/drawings?symbol=${encodeURIComponent($('symbol').value)}&timeframe=${encodeURIComponent($('tf').value)}`); drawings = result.drawings || { levels: [], notes: [], zones: [], guides: [] }; renderDrawings(); }
function renderDrawings() { priceLineHandles.forEach((handle) => { try { candles.removePriceLine(handle); } catch (err) {} }); priceLineHandles = []; (drawings.levels || []).forEach((level) => { const handle = candles.createPriceLine({ price: Number(level.price), color: level.color || '#38bdf8', lineWidth: 1, lineStyle: LightweightCharts.LineStyle.Dashed, axisLabelVisible: true, title: level.label || 'level' }); priceLineHandles.push(handle); }); }
function addLevelFromLastClose() { if (!currentBars.length) return; const last = currentBars[currentBars.length - 1]; drawings.levels = drawings.levels || []; drawings.levels.push({ price: last.close, label: prompt('Level label', 'manual level') || 'manual level', color: '#38bdf8' }); renderDrawings(); }

function requestBody() { return { symbol: $('symbol').value, asset_type: $('asset').value, exchange: $('exchange').value, timeframe: $('tf').value, question: $('question').value }; }
function chartContext() { return { symbol: $('symbol').value, timeframe: $('tf').value, bars: currentBars.slice(-120), first_bar: currentBars[0] || null, bars_count: currentBars.length, history: lastPayload && lastPayload.history ? lastPayload.history : null, drawings, overlays: overlayState, indicators: { volumeVisible, rsiVisible, macdVisible, atrVisible } }; }
async function aiAnalyze() { const result = await post('/api/ai/analyze', requestBody()); print(result); await saveSnapshot({ kind: 'ai_analysis', result }); }
async function aiTradeIdea() { const result = await post('/api/ai/trade-idea', { ...requestBody(), chart_context: chartContext(), profile: $('ideaProfile').value, mode: 'research_trade_idea' }); print(result); populateIdeaDraft(result); await saveSnapshot({ kind: 'ai_trade_idea', result }); }
function populateIdeaDraft(result) { const structured = result.structured_trade_idea || {}; const trade = structured.trade_idea || {}; $('ideaHypothesis').value = structured.summary || ''; $('ideaInvalidation').value = structured.invalidation || trade.stop_or_invalidation || ''; $('ideaBacktestPlan').value = (structured.backtest_ideas || []).join('\n'); }
async function saveIdea() { const payload = { symbol: $('symbol').value, asset_type: activeIsCrypto() ? 'crypto' : 'stock', timeframe: $('tf').value, status: 'draft', bias: 'unknown', setup_type: 'manual', hypothesis: $('ideaHypothesis').value || 'Manual workstation idea', invalidation: $('ideaInvalidation').value || 'Not specified', backtest_plan: $('ideaBacktestPlan').value || 'Not specified', source: 'workstation', metadata: { chart_context: chartContext() } }; const result = await post('/api/ideas', payload); print(result); }
async function listIdeas() { const result = await api(`/api/ideas?symbol=${encodeURIComponent($('symbol').value)}&limit=20`); print(result); }
async function ideaDetail() { const result = await api(`/api/ideas?symbol=${encodeURIComponent($('symbol').value)}&limit=1`); print(result); }
async function loadIdea() { const result = await api(`/api/ideas?symbol=${encodeURIComponent($('symbol').value)}&limit=1`); const idea = (result.ideas || [])[0]; if (!idea) return print('No idea found'); $('ideaHypothesis').value = idea.hypothesis || ''; $('ideaInvalidation').value = idea.invalidation || ''; $('ideaBacktestPlan').value = idea.backtest_plan || ''; print(idea); }
async function runBacktest() { const result = await post('/api/backtest/run', { symbol: $('symbol').value, strategy: 'ema_cross', period: '1y', interval: $('tf').value.toLowerCase(), idea_id: null, notes: 'workstation run' }); print(result); }
async function compareBacktests() { const result = await api(`/api/backtest/compare?symbol=${encodeURIComponent($('symbol').value)}&period=1y&interval=${encodeURIComponent($('tf').value.toLowerCase())}`); print(result); }
async function listBacktests() { const result = await api(`/api/backtests?symbol=${encodeURIComponent($('symbol').value)}&limit=20`); print(result); }
async function listJournal() { const result = await api('/api/journal?limit=50'); print(result); }
async function timeline() { const result = await api('/api/snapshots?limit=25'); print(result); }
async function payload() { print({ request: requestBody(), chart_context: chartContext(), lastPayload }); }
async function saveSnapshot(snapshot) { await post('/api/snapshots', { snapshot }); }
async function paper() { const result = await api('/api/paper/account'); print(result); }
async function portfolio() { const marks = {}; if (currentBars.length) marks[$('symbol').value.toUpperCase()] = currentBars[currentBars.length - 1].close; const result = await post('/api/paper/marks', { marks }); print(result); }
async function modules() { const result = await api('/api/health'); print({ modules: { watchlist: result.watchlist_registry, ideas: result.ideas, backtests: result.backtests, layouts: result.layouts, drawings: result.drawings, exports: result.exports, snapshots: result.snapshots, paper_trading: result.paper_trading } }); }
async function scanner() { const result = await api('/api/watchlist'); const top = (result.symbols || []).slice(0, Number($('scanLimit').value || 5)); print({ scanner: top.map((symbol) => ({ symbol, status: 'queued_for_manual_review' })) }); }
async function diagnostics() { const health = await api('/api/health'); print({ ok: true, health, chart: { symbol: $('symbol').value, bars: currentBars.length, history: lastPayload && lastPayload.history ? lastPayload.history : null } }); }

window.addEventListener('load', boot);
