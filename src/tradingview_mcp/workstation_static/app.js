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
  await loadDefaultChart();
  scheduleChartSurfaceRefresh();
}

async function loadDefaultChart() {
  try {
    await loadMarket();
  } catch (error) {
    console.warn('default chart load failed, retrying AAPL stock 1D', error);
  }
  if (currentBars.length) return;
  $('symbol').value = 'AAPL';
  $('asset').value = 'stock';
  $('exchange').value = 'NASDAQ';
  $('tf').value = '1D';
  try {
    await loadMarket();
  } catch (error) {
    $('legend').textContent = `Unable to load AAPL stock chart: ${error.message}`;
    print({ error: { code: 'DEFAULT_CHART_LOAD_FAILED', message: error.message } });
  }
}

function activeIsCrypto() { const symbol = $('symbol').value.toUpperCase(); return $('asset').value === 'crypto' || symbol.endsWith('USDT') || symbol.endsWith('-USD'); }
function normalizeBars(rawBars) { return rawBars.filter((bar) => Number.isFinite(bar.open) && Number.isFinite(bar.high) && Number.isFinite(bar.low) && Number.isFinite(bar.close)); }

async function loadMarket() {
  const symbol = $('symbol').value.trim();
  const timeframe = $('tf').value;
  if (activeIsCrypto()) {
    lastPayload = await api(`/api/crypto/candles?symbol=${encodeURIComponent(symbol)}&venue=binance&interval=${encodeURIComponent(timeframe.toLowerCase())}&limit=300`);
    currentBars = normalizeBars((lastPayload.bars || []).map((bar) => ({ time: bar.open_time ? Math.floor(bar.open_time / 1000) : bar.time, open: +bar.open, high: +bar.high, low: +bar.low, close: +bar.close, volume: +bar.volume })));
  } else {
    lastPayload = await api(`/api/stock/yahoo-chart?symbol=${encodeURIComponent(symbol)}&timeframe=${encodeURIComponent(timeframe)}&limit=300`);
    currentBars = normalizeBars((lastPayload.candles || []).map((bar) => ({ time: bar.time, open: +bar.open, high: +bar.high, low: +bar.low, close: +bar.close, volume: +bar.volume })));
  }
  renderChartSeries();
  renderRsiPane();
  renderMacdPane();
  renderAtrPane();
  restoreDrawings();
  fitChart();
  updateChartMeta();
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
function renderMacdPane() { if (!macdVisible) return; ensureMacdChart(); const values = macdValues(); const lastMacd = values.macd[values.macd.length - 1]; const lastSignal = values.signal[values.signal.length - 1]; macdSeries.setData(values.macd); macdSignalSeries.setData(values.signal); macdHistogram.setData(values.histogram); $('macdLegend').textContent = lastMacd && lastSignal ? `MACD ${lastMacd.value.toFixed(4)} Signal ${lastSignal.value.toFixed(4)}` : 'MACD 12 26 9'; }
function renderAtrPane() { if (!atrVisible) return; ensureAtrChart(); const values = averageTrueRange(14); const last = values[values.length - 1]; atrSeries.setData(values); $('atrLegend').textContent = last ? `ATR 14 ${last.value.toFixed(4)}` : 'ATR 14'; }
function toggleVolume() { volumeVisible = !volumeVisible; volume.setData(volumeVisible ? currentBars.map((bar) => ({ time: bar.time, value: bar.volume })) : []); }
function toggleOverlay(kind) { overlayState[kind] = !overlayState[kind]; applyOverlayData(); }
function ensureOverlaySeries(kind) { if (!overlaySeries[kind]) overlaySeries[kind] = chart.addLineSeries({ lineWidth: 2, priceLineVisible: false, lastValueVisible: false }); return overlaySeries[kind]; }
function applyOverlayData() { if (!chart || !candles) return; const map = { sma20: movingAverage(20), sma50: movingAverage(50), ema21: exponentialMovingAverage(21) }; Object.entries(map).forEach(([kind, data]) => { if (overlayState[kind]) ensureOverlaySeries(kind).setData(data); else if (overlaySeries[kind]) overlaySeries[kind].setData([]); }); }
function fitChart() { if (chart) chart.timeScale().fitContent(); }

function updateChartMeta() { const source = activeIsCrypto() ? 'Binance crypto WebSocket' : 'Yahoo stock chart'; $('chartMeta').textContent = `${$('symbol').value.toUpperCase()} · ${$('tf').value} · ${source} · bars ${currentBars.length}`; }
function updateLegend(param) { const point = param && param.time ? currentBars.find((bar) => bar.time === param.time) : currentBars[currentBars.length - 1]; if (!point) { $('legend').textContent = 'No chart data loaded.'; return; } $('legend').textContent = `${$('symbol').value.toUpperCase()} O ${point.open.toFixed(2)} H ${point.high.toFixed(2)} L ${point.low.toFixed(2)} C ${point.close.toFixed(2)} V ${Math.round(point.volume || 0).toLocaleString()}`; }

async function analyze() { const payload = await post('/api/ai/analyze', { symbol: $('symbol').value, asset_type: $('asset').value, exchange: $('exchange').value, timeframe: $('tf').value, question: $('question').value }); print(payload); if (payload.analysis) $('ideaHypothesis').value = payload.analysis.summary || ''; }
async function backtest() { const payload = await post('/api/backtest/run', { symbol: $('symbol').value, strategy: 'ema_cross', interval: $('tf').value.toLowerCase(), period: '1y' }); print(payload); }
async function compareBacktests() { const payload = await post('/api/backtest/compare', { symbol: $('symbol').value, interval: $('tf').value.toLowerCase(), period: '1y' }); print(payload); }
async function listBacktests() { const payload = await api('/api/backtests?limit=50'); print(payload); }
async function refreshPaper() { const payload = await api('/api/paper/account'); print(payload); }
async function saveIdea() { const payload = await post('/api/ideas', { symbol: $('symbol').value, asset_type: activeIsCrypto() ? 'crypto' : 'stock', timeframe: $('tf').value, hypothesis: $('ideaHypothesis').value || 'Manual hypothesis', invalidation: $('ideaInvalidation').value || 'Define invalidation', backtest_plan: $('ideaBacktest').value || 'Run baseline comparison', risk_notes: $('ideaRisk').value || '', source: 'workstation' }); print(payload); }
async function listIdeas() { const payload = await api('/api/ideas?limit=20'); print(payload); }
async function ideaDetail(id) { const payload = await api(`/api/ideas/${id || 1}`); print(payload); }
async function loadLatestIdea() { const list = await api('/api/ideas?limit=1'); const idea = (list.ideas || [])[0]; if (!idea) return print({ note: 'No ideas saved yet' }); $('symbol').value = idea.symbol || $('symbol').value; $('asset').value = idea.asset_type || $('asset').value; $('tf').value = idea.timeframe || $('tf').value; $('ideaHypothesis').value = idea.hypothesis || ''; $('ideaInvalidation').value = idea.invalidation || ''; $('ideaBacktest').value = idea.backtest_plan || ''; $('ideaRisk').value = idea.risk_notes || ''; await loadMarket(); print({ loaded_idea: idea }); }
async function scanWatchlist() { const symbols = Array.from(document.querySelectorAll('#watch button')).map((button) => button.textContent); const payload = await post('/api/ai/watchlist-scan', { symbols, timeframe: $('tf').value, exchange: $('exchange').value }); print(payload); const first = (payload.candidates || [])[0]; if (first) { $('symbol').value = first.symbol; $('ideaHypothesis').value = first.reason || first.summary || ''; } }
async function loadJournal() { const payload = await api('/api/journal?limit=50'); print(payload); }

function restoreDrawings() { renderHtmlDrawings(); }
function renderHtmlDrawings() { clearPriceLines(); renderZones(); renderGuides(); renderNotes(); }
function clearPriceLines() { priceLineHandles.forEach((line) => candles.removePriceLine(line)); priceLineHandles = []; }
function renderZones() { const overlay = $('zonesOverlay'); if (!overlay) return; overlay.innerHTML = ''; }
function renderGuides() { const overlay = $('guidesOverlay'); if (!overlay) return; overlay.innerHTML = ''; }
function renderNotes() { const overlay = $('notesOverlay'); if (!overlay) return; overlay.innerHTML = ''; }

function addPriceLevel() { const price = Number($('levelPrice').value); if (!Number.isFinite(price)) return; priceLineHandles.push(candles.createPriceLine({ price, title: $('levelLabel').value || $('levelKind').value, color: '#2563eb' })); }
function addLastCloseLevel() { const last = currentBars[currentBars.length - 1]; if (!last) return; $('levelPrice').value = last.close; addPriceLevel(); }
function addZone() { drawings.zones.push({ low: $('zoneLow').value, high: $('zoneHigh').value, label: $('zoneLabel').value, kind: $('zoneKind').value }); renderZones(); }
function addGuide() { drawings.guides.push({ start: $('guideStartPrice').value, end: $('guideEndPrice').value, label: $('guideLabel').value, kind: $('guideKind').value }); renderGuides(); }
function addNote() { drawings.notes.push({ text: $('noteText').value }); renderNotes(); }
function clearDrawings() { drawings = { levels: [], notes: [], zones: [], guides: [] }; renderHtmlDrawings(); }
function exportDrawings() { print({ drawings }); }
function importDrawings() { try { drawings = JSON.parse(prompt('Paste drawing JSON') || '{}'); renderHtmlDrawings(); } catch (error) { print({ error: String(error) }); } }
function setLayoutMode() {}
function setLayoutSlot() {}
function listLayouts() {}
function saveLayout() {}
function loadLayout() {}
function resetLayout() {}
function deleteLayout() {}
function showPayload() { print(lastPayload || { note: 'No payload loaded yet' }); }

window.loadMarket = loadMarket;
window.analyze = analyze;
window.backtest = backtest;
window.compareBacktests = compareBacktests;
window.listBacktests = listBacktests;
window.refreshPaper = refreshPaper;
window.saveIdea = saveIdea;
window.listIdeas = listIdeas;
window.ideaDetail = ideaDetail;
window.loadLatestIdea = loadLatestIdea;
window.scanWatchlist = scanWatchlist;
window.loadJournal = loadJournal;
window.toggleOverlay = toggleOverlay;
window.toggleVolume = toggleVolume;
window.toggleRsiPane = toggleRsiPane;
window.toggleMacdPane = toggleMacdPane;
window.toggleAtrPane = toggleAtrPane;
window.fitChart = fitChart;
window.addPriceLevel = addPriceLevel;
window.addLastCloseLevel = addLastCloseLevel;
window.addZone = addZone;
window.addGuide = addGuide;
window.addNote = addNote;
window.clearDrawings = clearDrawings;
window.exportDrawings = exportDrawings;
window.importDrawings = importDrawings;
window.setLayoutMode = setLayoutMode;
window.setLayoutSlot = setLayoutSlot;
window.listLayouts = listLayouts;
window.saveLayout = saveLayout;
window.loadLayout = loadLayout;
window.resetLayout = resetLayout;
window.deleteLayout = deleteLayout;
window.showPayload = showPayload;

if (window.workstationBoot) window.workstationBoot.register('core-app', boot);
else boot();
