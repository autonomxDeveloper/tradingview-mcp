let slot2Chart = null;
let slot2Candles = null;

function slot2IsCrypto(symbol) {
  const clean = String(symbol || '').toUpperCase();
  return clean.endsWith('USDT') || clean.endsWith('-USD');
}

function slot2ApiUrl(symbol, timeframe) {
  const cleanSymbol = encodeURIComponent(symbol);
  const cleanTf = encodeURIComponent(timeframe || '1D');
  if (slot2IsCrypto(symbol)) {
    return `/api/crypto/candles?symbol=${cleanSymbol}&venue=binance&interval=${cleanTf.toLowerCase()}&limit=160`;
  }
  return `/api/stock/yahoo-chart?symbol=${cleanSymbol}&timeframe=${cleanTf}&limit=160`;
}

function normalizeSlot2Bars(payload) {
  const rawBars = payload.bars || payload.candles || [];
  return rawBars.map((bar) => ({
    time: bar.open_time ? Math.floor(bar.open_time / 1000) : bar.time,
    open: +bar.open,
    high: +bar.high,
    low: +bar.low,
    close: +bar.close,
  })).filter((bar) => Number.isFinite(bar.open) && Number.isFinite(bar.high) && Number.isFinite(bar.low) && Number.isFinite(bar.close));
}

function ensureSlot2Chart() {
  const panel = document.getElementById('slot2Chart');
  if (!panel || slot2Chart) return;
  slot2Chart = LightweightCharts.createChart(panel, {
    layout: { background: { color: '#0b1020' }, textColor: '#cbd5e1' },
    grid: { vertLines: { color: '#1f2937' }, horzLines: { color: '#1f2937' } },
    rightPriceScale: { borderColor: '#334155' },
    timeScale: { borderColor: '#334155', timeVisible: true, secondsVisible: false },
  });
  slot2Candles = slot2Chart.addCandlestickSeries({ priceLineVisible: true, lastValueVisible: true });
}

async function renderSlot2Chart() {
  const state = (window.workstationChartSlots || {})[2] || {};
  const symbol = (state.symbol || document.getElementById('slot2Symbol')?.value || '').trim().toUpperCase();
  const timeframe = (state.timeframe || document.getElementById('slot2Tf')?.value || '1D').trim() || '1D';
  const status = document.getElementById('slot2Status');
  if (!symbol) {
    if (status) status.textContent = 'Set a symbol first.';
    return;
  }
  if (status) status.textContent = `Loading ${symbol} ${timeframe}...`;
  const response = await fetch(slot2ApiUrl(symbol, timeframe));
  if (!response.ok) throw new Error(response.status + ' ' + response.statusText);
  const payload = await response.json();
  const bars = normalizeSlot2Bars(payload);
  ensureSlot2Chart();
  if (slot2Candles) slot2Candles.setData(bars);
  if (slot2Chart) slot2Chart.timeScale().fitContent();
  if (status) status.textContent = bars.length ? `${symbol} · ${timeframe} · ${bars.length} bars` : `${symbol} · no bars`;
}

const originalSlotSetter = window.setChartSlot;
window.setChartSlot = function(slot) {
  if (originalSlotSetter) originalSlotSetter(slot);
  if (slot === 2) renderSlot2Chart().catch((error) => {
    const status = document.getElementById('slot2Status');
    if (status) status.textContent = error.message;
  });
};

window.addEventListener('resize', () => {
  const panel = document.getElementById('slot2Chart');
  if (slot2Chart && panel) slot2Chart.resize(panel.clientWidth, panel.clientHeight);
});
