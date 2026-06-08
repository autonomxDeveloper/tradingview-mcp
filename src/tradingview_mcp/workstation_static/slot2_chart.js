const slotCharts = {};
const slotCandles = {};
const emptySlotSummaryExample = 'S2: empty';

function slotIsCrypto(symbol) {
  const clean = String(symbol || '').toUpperCase();
  return clean.endsWith('USDT') || clean.endsWith('-USD');
}

function slotApiUrl(symbol, timeframe) {
  const cleanSymbol = encodeURIComponent(symbol);
  const cleanTf = encodeURIComponent(timeframe || '1D');
  if (slotIsCrypto(symbol)) {
    return `/api/crypto/candles?symbol=${cleanSymbol}&venue=binance&interval=${cleanTf.toLowerCase()}&limit=160`;
  }
  return `/api/stock/yahoo-chart?symbol=${cleanSymbol}&timeframe=${cleanTf}&limit=160`;
}

function normalizeSlotBars(payload) {
  const rawBars = payload.bars || payload.candles || [];
  return rawBars.map((bar) => ({
    time: bar.open_time ? Math.floor(bar.open_time / 1000) : bar.time,
    open: +bar.open,
    high: +bar.high,
    low: +bar.low,
    close: +bar.close,
  })).filter((bar) => Number.isFinite(bar.open) && Number.isFinite(bar.high) && Number.isFinite(bar.low) && Number.isFinite(bar.close));
}

function slotSummaryText() {
  const slots = window.workstationChartSlots || {};
  return [2, 3, 4].map((slot) => {
    const state = slots[slot] || {};
    return state.symbol ? `S${slot}: ${state.symbol} ${state.timeframe || '1D'}` : `S${slot}: empty`;
  }).join(' | ');
}

function updateSlotSummary() {
  const summary = document.getElementById('slotSummary');
  if (summary) summary.textContent = slotSummaryText();
}

function ensureSlotSummary() {
  if (document.getElementById('slotSummary')) return;
  const chartMeta = document.getElementById('chartMeta');
  const summary = document.createElement('span');
  summary.id = 'slotSummary';
  summary.className = 'slot-summary muted';
  summary.textContent = slotSummaryText();
  if (chartMeta && chartMeta.parentNode) chartMeta.parentNode.insertBefore(summary, chartMeta);
}

function ensureSecondarySlotShell(slot) {
  const cell = document.getElementById(`chartSlot${slot}`);
  if (!cell) return;
  const card = cell.querySelector('.slot-card');
  if (card && !document.getElementById(`slot${slot}Status`)) {
    const status = document.createElement('span');
    status.id = `slot${slot}Status`;
    status.textContent = 'No chart loaded.';
    card.appendChild(status);
  }
  if (!document.getElementById(`slot${slot}Chart`)) {
    const panel = document.createElement('div');
    panel.id = `slot${slot}Chart`;
    panel.className = 'slot-chart';
    cell.appendChild(panel);
  }
}

function ensureSlotShells() {
  [2, 3, 4].forEach((slot) => ensureSecondarySlotShell(slot));
  ensureSlotSummary();
  updateSlotSummary();
}

function ensureSlotChart(slot) {
  ensureSecondarySlotShell(slot);
  const panel = document.getElementById(`slot${slot}Chart`);
  if (!panel || slotCharts[slot]) return;
  slotCharts[slot] = LightweightCharts.createChart(panel, {
    layout: { background: { color: '#0b1020' }, textColor: '#cbd5e1' },
    grid: { vertLines: { color: '#1f2937' }, horzLines: { color: '#1f2937' } },
    rightPriceScale: { borderColor: '#334155' },
    timeScale: { borderColor: '#334155', timeVisible: true, secondsVisible: false },
  });
  slotCandles[slot] = slotCharts[slot].addCandlestickSeries({ priceLineVisible: true, lastValueVisible: true });
}

async function renderSlotChart(slot) {
  ensureSecondarySlotShell(slot);
  const state = (window.workstationChartSlots || {})[slot] || {};
  const symbol = (state.symbol || document.getElementById(`slot${slot}Symbol`)?.value || '').trim().toUpperCase();
  const timeframe = (state.timeframe || document.getElementById(`slot${slot}Tf`)?.value || '1D').trim() || '1D';
  const status = document.getElementById(`slot${slot}Status`);
  updateSlotSummary();
  if (!symbol) {
    if (status) status.textContent = 'Set a symbol first.';
    return;
  }
  if (status) status.textContent = `Loading ${symbol} ${timeframe}...`;
  const response = await fetch(slotApiUrl(symbol, timeframe));
  if (!response.ok) throw new Error(response.status + ' ' + response.statusText);
  const payload = await response.json();
  const bars = normalizeSlotBars(payload);
  ensureSlotChart(slot);
  if (slotCandles[slot]) slotCandles[slot].setData(bars);
  if (slotCharts[slot]) slotCharts[slot].timeScale().fitContent();
  if (status) status.textContent = bars.length ? `${symbol} · ${timeframe} · ${bars.length} bars` : `${symbol} · no bars`;
  updateSlotSummary();
}

function renderSlot2Chart() { return renderSlotChart(2); }

const originalSlotSetter = window.setChartSlot;
window.setChartSlot = function(slot) {
  if (originalSlotSetter) originalSlotSetter(slot);
  updateSlotSummary();
  if ([2, 3, 4].includes(Number(slot))) renderSlotChart(Number(slot)).catch((error) => {
    const status = document.getElementById(`slot${slot}Status`);
    if (status) status.textContent = error.message;
    updateSlotSummary();
  });
};

const originalApplyLayoutStateForSlots = window.applyLayoutState;
if (originalApplyLayoutStateForSlots) {
  window.applyLayoutState = function(state) {
    originalApplyLayoutStateForSlots(state);
    ensureSlotShells();
  };
}

window.addEventListener('resize', () => {
  [2, 3, 4].forEach((slot) => {
    const panel = document.getElementById(`slot${slot}Chart`);
    if (slotCharts[slot] && panel) slotCharts[slot].resize(panel.clientWidth, panel.clientHeight);
  });
});

ensureSlotShells();
