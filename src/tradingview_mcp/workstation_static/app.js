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
  window.onresize = () => {
    chart.resize($('chart').clientWidth, $('chart').clientHeight);
    if (rsiChart && rsiVisible) rsiChart.resize($('rsiChart').clientWidth, $('rsiChart').clientHeight);
    if (macdChart && macdVisible) macdChart.resize($('macdChart').clientWidth, $('macdChart').clientHeight);
    if (atrChart && atrVisible) atrChart.resize($('atrChart').clientWidth, $('atrChart').clientHeight);
    renderHtmlDrawings();
  };
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

function ensureRsiChart() {
  if (rsiChart) return;
  rsiChart = LightweightCharts.createChart($('rsiChart'), chartOptions());
  rsiSeries = rsiChart.addLineSeries({ lineWidth: 2, lastValueVisible: true, priceLineVisible: false });
  rsiTopLine = rsiChart.addLineSeries({ lineWidth: 1, lastValueVisible: false, priceLineVisible: false });
  rsiBottomLine = rsiChart.addLineSeries({ lineWidth: 1, lastValueVisible: false, priceLineVisible: false });
}

function ensureMacdChart() {
  if (macdChart) return;
  macdChart = LightweightCharts.createChart($('macdChart'), chartOptions());
  macdHistogram = macdChart.addHistogramSeries({ priceLineVisible: false, lastValueVisible: false });
  macdSeries = macdChart.addLineSeries({ lineWidth: 2, lastValueVisible: true, priceLineVisible: false });
  macdSignalSeries = macdChart.addLineSeries({ lineWidth: 1, lastValueVisible: true, priceLineVisible: false });
}

function ensureAtrChart() {
  if (atrChart) return;
  atrChart = LightweightCharts.createChart($('atrChart'), chartOptions());
  atrSeries = atrChart.addLineSeries({ lineWidth: 2, lastValueVisible: true, priceLineVisible: false });
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
      if (symbol.includes('USDT')) { $('asset').value = 'crypto'; $('exchange').value = 'BINANCE'; }
      else { $('asset').value = 'stock'; $('exchange').value = 'NASDAQ'; }
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

function emaSeries(values, period) {
  const result = [];
  const k = 2 / (period + 1);
  let ema = null;
  values.forEach((point, index) => {
    ema = ema === null ? point.value : point.value * k + ema * (1 - k);
    if (index >= period - 1) result.push({ time: point.time, value: +ema.toFixed(6) });
  });
  return result;
}

function relativeStrengthIndex(period = 14) {
  const points = [];
  if (currentBars.length <= period) return points;
  let gain = 0, loss = 0;
  for (let i = 1; i <= period; i += 1) {
    const change = currentBars[i].close - currentBars[i - 1].close;
    if (change >= 0) gain += change;
    else loss -= change;
  }
  let avgGain = gain / period, avgLoss = loss / period;
  for (let i = period + 1; i < currentBars.length; i += 1) {
    const change = currentBars[i].close - currentBars[i - 1].close;
    avgGain = (avgGain * (period - 1) + Math.max(change, 0)) / period;
    avgLoss = (avgLoss * (period - 1) + Math.max(-change, 0)) / period;
    const value = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
    points.push({ time: currentBars[i].time, value: +value.toFixed(4) });
  }
  return points;
}

function macdValues() {
  const closes = currentBars.map((bar) => ({ time: bar.time, value: bar.close }));
  const fast = emaSeries(closes, 12);
  const slow = emaSeries(closes, 26);
  const slowByTime = new Map(slow.map((point) => [point.time, point.value]));
  const macd = fast.filter((point) => slowByTime.has(point.time)).map((point) => ({ time: point.time, value: +(point.value - slowByTime.get(point.time)).toFixed(6) }));
  const signal = emaSeries(macd, 9);
  const signalByTime = new Map(signal.map((point) => [point.time, point.value]));
  const histogram = macd.filter((point) => signalByTime.has(point.time)).map((point) => ({ time: point.time, value: +(point.value - signalByTime.get(point.time)).toFixed(6) }));
  return { macd, signal, histogram };
}

function averageTrueRange(period = 14) {
  const points = [];
  if (currentBars.length <= period) return points;
  const ranges = [];
  for (let i = 1; i < currentBars.length; i += 1) {
    const bar = currentBars[i];
    const previous = currentBars[i - 1];
    ranges.push({ time: bar.time, value: Math.max(bar.high - bar.low, Math.abs(bar.high - previous.close), Math.abs(bar.low - previous.close)) });
  }
  let atr = ranges.slice(0, period).reduce((sum, point) => sum + point.value, 0) / period;
  for (let i = period; i < ranges.length; i += 1) {
    atr = (atr * (period - 1) + ranges[i].value) / period;
    points.push({ time: ranges[i].time, value: +atr.toFixed(6) });
  }
  return points;
}

function toggleRsiPane() { rsiVisible = !rsiVisible; setPaneVisibility('rsiWrap', rsiVisible); if (rsiVisible) { ensureRsiChart(); renderRsiPane(); rsiChart.resize($('rsiChart').clientWidth, $('rsiChart').clientHeight); rsiChart.timeScale().fitContent(); } }
function toggleMacdPane() { macdVisible = !macdVisible; setPaneVisibility('macdWrap', macdVisible); if (macdVisible) { ensureMacdChart(); renderMacdPane(); macdChart.resize($('macdChart').clientWidth, $('macdChart').clientHeight); macdChart.timeScale().fitContent(); } }
function toggleAtrPane() { atrVisible = !atrVisible; setPaneVisibility('atrWrap', atrVisible); if (atrVisible) { ensureAtrChart(); renderAtrPane(); atrChart.resize($('atrChart').clientWidth, $('atrChart').clientHeight); atrChart.timeScale().fitContent(); } }
function setPaneVisibility(id, visible) { const pane = $(id); if (pane) pane.style.display = visible ? 'block' : 'none'; }

function renderRsiPane() { if (!rsiVisible) return; ensureRsiChart(); const values = relativeStrengthIndex(14); const last = values[values.length - 1]; rsiSeries.setData(values); rsiTopLine.setData(values.map((point) => ({ time: point.time, value: 70 }))); rsiBottomLine.setData(values.map((point) => ({ time: point.time, value: 30 }))); $('rsiLegend').textContent = last ? `RSI 14 ${last.value.toFixed(2)}` : 'RSI 14'; }
function renderMacdPane() { if (!macdVisible) return; ensureMacdChart(); const values = macdValues(); const lastMacd = values.macd[values.macd.length - 1]; const lastSignal = values.signal[values.signal.length - 1]; macdSeries.setData(values.macd); macdSignalSeries.setData(values.signal); macdHistogram.setData(values.histogram); $('macdLegend').textContent = lastMacd && lastSignal ? `MACD ${lastMacd.value.toFixed(4)} Signal ${lastSignal.value.toFixed(4)}` : 'MACD 12 26 9'; }
function renderAtrPane() { if (!atrVisible) return; ensureAtrChart(); const values = averageTrueRange(14); const last = values[values.length - 1]; atrSeries.setData(values); $('atrLegend').textContent = last ? `ATR 14 ${last.value.toFixed(4)}` : 'ATR 14'; }

function ensureOverlay(name) { if (!overlaySeries[name]) overlaySeries[name] = chart.addLineSeries({ lineWidth: 2, lastValueVisible: false, priceLineVisible: false }); return overlaySeries[name]; }
function applyOverlayData() { Object.entries(overlayState).forEach(([name, enabled]) => { if (!enabled) { if (overlaySeries[name]) overlaySeries[name].setData([]); return; } const series = ensureOverlay(name); if (name === 'sma20') series.setData(movingAverage(20)); if (name === 'sma50') series.setData(movingAverage(50)); if (name === 'ema21') series.setData(exponentialMovingAverage(21)); }); }
function toggleOverlay(name) { overlayState[name] = !overlayState[name]; applyOverlayData(); }
function toggleVolume() { volumeVisible = !volumeVisible; volume.applyOptions({ visible: volumeVisible }); }
function drawingStorageKey() { return `workstation-drawings:${$('symbol').value.toUpperCase()}:${$('tf').value}`; }
function emptyDrawings() { return { levels: [], notes: [], zones: [], guides: [] }; }
function levelColor(kind) { if (kind === 'support' || kind === 'demand') return '#22c55e'; if (kind === 'resistance' || kind === 'supply') return '#ef4444'; if (kind === 'alert') return '#f59e0b'; return '#60a5fa'; }

function addLevel(price, label, kind = 'level') { const cleanPrice = Number(price); if (!Number.isFinite(cleanPrice) || cleanPrice <= 0) { print('Enter a positive price level.'); return; } const cleanKind = ['level', 'support', 'resistance', 'alert'].includes(kind) ? kind : 'level'; drawings.levels.push({ price: cleanPrice, label: (label || cleanKind).trim() || cleanKind, kind: cleanKind }); persistDrawings(); renderDrawings(); }
function addLevelFromInput() { addLevel($('levelPrice').value, $('levelLabel').value, $('levelKind').value); }
function addLevelFromLastClose() { if (!currentBars.length) return; const last = currentBars[currentBars.length - 1]; addLevel(last.close, $('levelLabel').value || 'last close', $('levelKind').value); }
function addNoteAtLastClose() { if (!currentBars.length) return; const text = ($('noteText').value || '').trim(); if (!text) { print('Enter note text first.'); return; } const last = currentBars[currentBars.length - 1]; drawings.notes.push({ time: last.time, price: last.close, text }); persistDrawings(); renderDrawings(); }
function addZoneFromInput() { if (!currentBars.length) return; const low = Number($('zoneLow').value), high = Number($('zoneHigh').value); if (!Number.isFinite(low) || !Number.isFinite(high) || low <= 0 || high <= 0 || low === high) { print('Enter two positive, different zone prices.'); return; } const last = currentBars[currentBars.length - 1], visibleStart = currentBars[Math.max(0, currentBars.length - 60)] || currentBars[0], kind = $('zoneKind').value || 'zone', label = ($('zoneLabel').value || kind).trim() || kind; drawings.zones.push({ startTime: visibleStart.time, endTime: last.time, low: Math.min(low, high), high: Math.max(low, high), label, kind }); persistDrawings(); renderDrawings(); }
function addGuideFromInput() { if (!currentBars.length) return; const startPrice = Number($('guideStartPrice').value), endPrice = Number($('guideEndPrice').value); if (!Number.isFinite(startPrice) || !Number.isFinite(endPrice) || startPrice <= 0 || endPrice <= 0) { print('Enter positive guide start and end prices.'); return; } const last = currentBars[currentBars.length - 1], visibleStart = currentBars[Math.max(0, currentBars.length - 60)] || currentBars[0], kind = $('guideKind').value || 'guide', label = ($('guideLabel').value || kind).trim() || kind; drawings.guides.push({ startTime: visibleStart.time, endTime: last.time, startPrice, endPrice, label, kind }); persistDrawings(); renderDrawings(); }

function persistDrawings() { localStorage.setItem(drawingStorageKey(), JSON.stringify(drawings)); }
function restoreDrawings() { try { const loaded = JSON.parse(localStorage.getItem(drawingStorageKey()) || 'null'); drawings = Array.isArray(loaded) ? { levels: loaded, notes: [], zones: [], guides: [] } : { ...emptyDrawings(), ...(loaded || {}) }; } catch (_) { drawings = emptyDrawings(); } renderDrawings(); }
function renderDrawings() { renderLevels(); renderHtmlDrawings(); }
function renderLevels() { priceLineHandles.forEach((handle) => candles.removePriceLine(handle)); priceLineHandles = []; drawings.levels.forEach((level) => { const handle = candles.createPriceLine({ price: level.price, color: levelColor(level.kind), lineWidth: 2, lineStyle: LightweightCharts.LineStyle.Solid, axisLabelVisible: true, title: level.label }); priceLineHandles.push(handle); }); }
function renderHtmlDrawings() { renderZones(); renderGuides(); renderNotes(); }

function renderZones() { const overlay = $('zonesOverlay'); if (!overlay || !chart || !candles) return; overlay.innerHTML = ''; drawings.zones.forEach((zone) => { const x1 = chart.timeScale().timeToCoordinate(zone.startTime), x2 = chart.timeScale().timeToCoordinate(zone.endTime), yHigh = candles.priceToCoordinate(zone.high), yLow = candles.priceToCoordinate(zone.low); if (x1 === null || x2 === null || yHigh === null || yLow === null) return; const el = document.createElement('div'); el.className = `chart-zone ${zone.kind || 'zone'}`; el.style.left = `${Math.max(0, Math.min(x1, x2))}px`; el.style.top = `${Math.max(0, Math.min(yHigh, yLow))}px`; el.style.width = `${Math.max(8, Math.abs(x2 - x1))}px`; el.style.height = `${Math.max(6, Math.abs(yLow - yHigh))}px`; const label = document.createElement('div'); label.className = 'chart-zone-label'; label.textContent = zone.label || zone.kind || 'zone'; el.appendChild(label); overlay.appendChild(el); }); }
function guideColor(kind) { if (kind === 'support') return '#22c55e'; if (kind === 'resistance') return '#ef4444'; return '#60a5fa'; }
function renderGuides() { const overlay = $('guidesOverlay'); if (!overlay || !chart || !candles) return; overlay.setAttribute('width', String($('chartWrap').clientWidth)); overlay.setAttribute('height', String($('chartWrap').clientHeight)); overlay.style.position = 'absolute'; overlay.style.inset = '0'; overlay.style.pointerEvents = 'none'; overlay.style.zIndex = '4'; overlay.innerHTML = ''; drawings.guides.forEach((guide) => { const x1 = chart.timeScale().timeToCoordinate(guide.startTime), x2 = chart.timeScale().timeToCoordinate(guide.endTime), y1 = candles.priceToCoordinate(guide.startPrice), y2 = candles.priceToCoordinate(guide.endPrice); if (x1 === null || x2 === null || y1 === null || y2 === null) return; const path = document.createElementNS('http://www.w3.org/2000/svg', 'line'); path.setAttribute('x1', String(x1)); path.setAttribute('y1', String(y1)); path.setAttribute('x2', String(x2)); path.setAttribute('y2', String(y2)); path.setAttribute('stroke', guideColor(guide.kind)); path.setAttribute('stroke-width', '2'); overlay.appendChild(path); const label = document.createElementNS('http://www.w3.org/2000/svg', 'text'); label.setAttribute('x', String((x1 + x2) / 2)); label.setAttribute('y', String((y1 + y2) / 2 - 5)); label.setAttribute('fill', '#e5e7eb'); label.setAttribute('font-size', '11'); label.textContent = guide.label || guide.kind || 'guide'; overlay.appendChild(label); }); }
function renderNotes() { const overlay = $('notesOverlay'); if (!overlay || !chart || !candles) return; overlay.innerHTML = ''; drawings.notes.forEach((note) => { const x = chart.timeScale().timeToCoordinate(note.time), y = candles.priceToCoordinate(note.price); if (x === null || y === null) return; const el = document.createElement('div'); el.className = 'chart-note'; el.textContent = note.text; el.style.left = `${Math.max(0, x)}px`; el.style.top = `${Math.max(0, y - 36)}px`; overlay.appendChild(el); }); }
function clearDrawings() { drawings = emptyDrawings(); persistDrawings(); renderDrawings(); }
function exportDrawings() { print({ symbol: $('symbol').value.toUpperCase(), timeframe: $('tf').value, drawings }); }
function importDrawings() { const raw = prompt('Paste exported drawings JSON'); if (!raw) return; try { const payload = JSON.parse(raw); drawings = { ...emptyDrawings(), ...(payload.drawings || payload) }; persistDrawings(); renderDrawings(); print('Drawings imported.'); } catch (error) { print(`Could not import drawings: ${error.message}`); } }
function clearLevels() { drawings.levels = []; persistDrawings(); renderDrawings(); }
function fitChart() { chart.timeScale().fitContent(); renderHtmlDrawings(); if (rsiChart && rsiVisible) rsiChart.timeScale().fitContent(); if (macdChart && macdVisible) macdChart.timeScale().fitContent(); if (atrChart && atrVisible) atrChart.timeScale().fitContent(); }
function updateChartMeta() { const metadata = lastPayload?.metadata || {}; const source = metadata.source || lastPayload?.source || 'unknown source'; const cache = metadata.cache_status ? ` · ${metadata.cache_status}${metadata.stale ? ' stale' : ''}` : ''; $('chartMeta').textContent = `${$('symbol').value.toUpperCase()} · ${$('tf').value} · ${source}${cache}`; }
function updateLegend(param) { if (!currentBars.length) { $('legend').textContent = 'No chart data loaded.'; return; } let bar = currentBars[currentBars.length - 1]; if (param && param.time) { const match = currentBars.find((candidate) => candidate.time === param.time); if (match) bar = match; } const change = bar.close - bar.open, changePct = bar.open ? (change / bar.open) * 100 : 0, klass = change >= 0 ? 'up' : 'down'; $('legend').innerHTML = `<strong>${$('symbol').value.toUpperCase()}</strong> O ${fmt(bar.open)} H ${fmt(bar.high)} L ${fmt(bar.low)} C ${fmt(bar.close)} <span class="${klass}">${fmt(change)} (${changePct.toFixed(2)}%)</span> Vol ${fmtVolume(bar.volume)}`; }
function fmt(value) { if (!Number.isFinite(value)) return '-'; return Math.abs(value) >= 1000 ? value.toFixed(2) : value.toPrecision(6).replace(/0+$/, '').replace(/\.$/, ''); }
function fmtVolume(value) { if (!Number.isFinite(value)) return '-'; if (value >= 1000000000) return (value / 1000000000).toFixed(2) + 'B'; if (value >= 1000000) return (value / 1000000).toFixed(2) + 'M'; if (value >= 1000) return (value / 1000).toFixed(2) + 'K'; return String(value); }

function layoutStorageKey(name) { return `workstation-layout:${(name || 'default').trim() || 'default'}`; }
function currentLayoutName() { return ($('layoutName')?.value || 'default').trim() || 'default'; }
function currentLayoutState() { return { symbol: $('symbol').value, asset: $('asset').value, exchange: $('exchange').value, timeframe: $('tf').value, volumeVisible, rsiVisible, macdVisible, atrVisible, overlayState: { ...overlayState } }; }
function saveLayout() { const name = currentLayoutName(); localStorage.setItem(layoutStorageKey(name), JSON.stringify(currentLayoutState())); print(`Layout saved: ${name}`); }
async function loadLayout() { const name = currentLayoutName(); const raw = localStorage.getItem(layoutStorageKey(name)); if (!raw) { print(`No saved layout named: ${name}`); return; } try { const state = JSON.parse(raw); applyLayoutState(state); print(`Layout loaded: ${name}`); } catch (error) { print(`Could not load layout: ${error.message}`); } }
function resetLayout() { overlayState = { sma20: false, sma50: false, ema21: false }; volumeVisible = true; rsiVisible = false; macdVisible = false; atrVisible = false; setPaneVisibility('rsiWrap', false); setPaneVisibility('macdWrap', false); setPaneVisibility('atrWrap', false); if (volume) volume.applyOptions({ visible: true }); applyOverlayData(); print('Layout reset.'); }
function applyLayoutState(state) { if (state.symbol) $('symbol').value = state.symbol; if (state.asset) $('asset').value = state.asset; if (state.exchange) $('exchange').value = state.exchange; if (state.timeframe) $('tf').value = state.timeframe; overlayState = { sma20: false, sma50: false, ema21: false, ...(state.overlayState || {}) }; volumeVisible = state.volumeVisible !== false; rsiVisible = !!state.rsiVisible; macdVisible = !!state.macdVisible; atrVisible = !!state.atrVisible; setPaneVisibility('rsiWrap', rsiVisible); setPaneVisibility('macdWrap', macdVisible); setPaneVisibility('atrWrap', atrVisible); if (volume) volume.applyOptions({ visible: volumeVisible }); loadMarket(); }

async function analyze() { print('Analyzing...', 'analysis'); const response = await post('/api/ai/analyze', { symbol: $('symbol').value, asset_type: $('asset').value, exchange: $('exchange').value, timeframe: $('tf').value, question: $('question').value }); print(response.analysis?.content || response, 'analysis'); }
async function runBacktest() { const response = await post('/api/backtest/run', { symbol: $('symbol').value, strategy: $('strategy').value, period: $('period').value, include_trade_log: true, include_equity_curve: true, idea_id: $('ideaId').value || null }); print(response); }
async function compareStrategies() { print(await api(`/api/backtest/compare?symbol=${encodeURIComponent($('symbol').value)}&period=${$('period').value}`)); }
async function loadBacktests() { print(await api(`/api/backtests?symbol=${encodeURIComponent($('symbol').value)}&limit=100`)); }
async function saveIdea() { const body = { symbol: $('symbol').value, asset_type: activeIsCrypto() ? 'crypto' : 'stock', timeframe: $('tf').value, bias: 'unknown', hypothesis: $('hypothesis').value, invalidation: $('invalidation').value, backtest_plan: $('backtestPlan').value, source: 'workstation' }; print(await post('/api/ideas', body)); }
async function loadIdeas() { print(await api('/api/ideas?limit=100')); }
function showPayload() { print(lastPayload || 'No payload'); }
async function loadJournal() { print(await api('/api/journal?limit=100')); }

boot().catch((error) => print(error.message));
