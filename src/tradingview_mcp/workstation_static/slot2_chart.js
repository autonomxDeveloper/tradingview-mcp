const slotCharts = {};
const slotCandles = {};
const slotBars = {};
const secondarySlots = [2, 3, 4];
const emptySlotSummaryExample = 'S2: empty';
window.workstationActiveChartSlot = window.workstationActiveChartSlot || 1;

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
  const active = Number(window.workstationActiveChartSlot || 1);
  const primarySymbol = document.getElementById('symbol')?.value || 'main';
  const primaryTf = document.getElementById('tf')?.value || '1D';
  const summaries = [`${active === 1 ? '*' : ''}S1: ${primarySymbol} ${primaryTf}`];
  secondarySlots.forEach((slot) => {
    const state = slots[slot] || {};
    summaries.push(state.symbol ? `${active === slot ? '*' : ''}S${slot}: ${state.symbol} ${state.timeframe || '1D'}` : `${active === slot ? '*' : ''}S${slot}: empty`);
  });
  return summaries.join(' | ');
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

function setActiveChartSlot(slot) {
  const normalized = [1, 2, 3, 4].includes(Number(slot)) ? Number(slot) : 1;
  window.workstationActiveChartSlot = normalized;
  [1, 2, 3, 4].forEach((candidate) => {
    const cell = candidate === 1 ? document.getElementById('chartWrap') : document.getElementById(`chartSlot${candidate}`);
    if (!cell) return;
    const active = candidate === normalized;
    cell.classList.toggle('active-chart-cell', active);
    cell.setAttribute('aria-selected', active ? 'true' : 'false');
  });
  updateSlotSummary();
}

function ensurePrimarySlotShell() {
  const primary = document.getElementById('chartWrap');
  if (!primary) return;
  primary.dataset.chartSlot = '1';
  primary.setAttribute('role', 'button');
  primary.setAttribute('tabindex', '0');
  primary.setAttribute('aria-label', 'Activate primary chart slot');
}

function ensureSecondarySlotShell(slot) {
  const cell = document.getElementById(`chartSlot${slot}`);
  if (!cell) return;
  cell.dataset.chartSlot = String(slot);
  cell.setAttribute('role', 'button');
  cell.setAttribute('tabindex', '0');
  cell.setAttribute('aria-label', `Activate chart slot ${slot}`);
  cell.classList.add('secondary-chart-cell');
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
  ensurePrimarySlotShell();
  secondarySlots.forEach((slot) => ensureSecondarySlotShell(slot));
  ensureSlotSummary();
  setActiveChartSlot(window.workstationActiveChartSlot || 1);
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

function updateSecondarySlotInputs(slot, state) {
  const symbolInput = document.getElementById(`slot${slot}Symbol`);
  const tfInput = document.getElementById(`slot${slot}Tf`);
  if (symbolInput) symbolInput.value = state.symbol || '';
  if (tfInput) tfInput.value = state.timeframe || '';
  if (window.renderChartSlot) window.renderChartSlot(slot);
}

function applySecondarySlotSync(sourceSlot) {
  const source = (window.workstationChartSlots || {})[sourceSlot] || {};
  if (!source.symbol && !source.timeframe) return [];
  const changed = [];
  secondarySlots.forEach((slot) => {
    if (slot === sourceSlot) return;
    const current = (window.workstationChartSlots || {})[slot] || {};
    const next = { ...current };
    if (window.workstationSyncSymbol && source.symbol) next.symbol = source.symbol;
    if (window.workstationSyncTimeframe && source.timeframe) next.timeframe = source.timeframe;
    if (next.symbol !== current.symbol || next.timeframe !== current.timeframe) {
      window.workstationChartSlots[slot] = next;
      updateSecondarySlotInputs(slot, next);
      changed.push(slot);
    }
  });
  return changed;
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
  slotBars[slot] = bars;
  ensureSlotChart(slot);
  if (slotCandles[slot]) slotCandles[slot].setData(bars);
  if (slotCharts[slot]) slotCharts[slot].timeScale().fitContent();
  if (status) status.textContent = bars.length ? `${symbol} · ${timeframe} · ${bars.length} bars` : `${symbol} · no bars`;
  updateSlotSummary();
}

function renderSlot2Chart() { return renderSlotChart(2); }

function bindSlotActivation() {
  if (window.workstationSlotActivationBound) return;
  window.workstationSlotActivationBound = true;
  document.addEventListener('click', (event) => {
    const cell = event.target.closest('[data-chart-slot]');
    if (!cell) return;
    setActiveChartSlot(cell.dataset.chartSlot);
  });
  document.addEventListener('keydown', (event) => {
    if (!['Enter', ' '].includes(event.key)) return;
    const cell = event.target.closest('[data-chart-slot]');
    if (!cell) return;
    event.preventDefault();
    setActiveChartSlot(cell.dataset.chartSlot);
  });
}

const originalSlotSetter = window.setChartSlot;
window.setChartSlot = function(slot) {
  if (originalSlotSetter) originalSlotSetter(slot);
  const normalized = Number(slot);
  setActiveChartSlot(normalized);
  const changedSlots = secondarySlots.includes(normalized) ? applySecondarySlotSync(normalized) : [];
  [normalized, ...changedSlots].filter((candidate, index, all) => secondarySlots.includes(candidate) && all.indexOf(candidate) === index).forEach((candidate) => {
    renderSlotChart(candidate).catch((error) => {
      const status = document.getElementById(`slot${candidate}Status`);
      if (status) status.textContent = error.message;
      updateSlotSummary();
    });
  });
};

const originalApplyLayoutStateForSlots = window.applyLayoutState;
if (originalApplyLayoutStateForSlots) {
  window.applyLayoutState = function(state) {
    originalApplyLayoutStateForSlots(state);
    ensureSlotShells();
    secondarySlots.forEach((slot) => {
      const slotState = (window.workstationChartSlots || {})[slot] || {};
      if (slotState.symbol) renderSlotChart(slot).catch((error) => {
        const status = document.getElementById(`slot${slot}Status`);
        if (status) status.textContent = error.message;
      });
    });
  };
}

window.addEventListener('resize', () => {
  secondarySlots.forEach((slot) => {
    const panel = document.getElementById(`slot${slot}Chart`);
    if (slotCharts[slot] && panel) slotCharts[slot].resize(panel.clientWidth, panel.clientHeight);
  });
});

function renderAiSection(title, value) {
  const card = document.createElement('div');
  card.className = 'ai-card';
  const heading = document.createElement('b');
  heading.textContent = title;
  card.appendChild(heading);
  const body = document.createElement('ul');
  const items = Array.isArray(value) ? value : [value || 'None provided.'];
  items.forEach((item) => {
    const li = document.createElement('li');
    li.textContent = typeof item === 'string' ? item : JSON.stringify(item);
    body.appendChild(li);
  });
  card.appendChild(body);
  return card;
}

function renderStructuredAnalysis(payload) {
  if (!payload || !payload.parsed) return false;
  const target = document.getElementById('analysis');
  if (!target) return false;
  target.textContent = '';
  target.classList.add('ai-card-grid');
  [['Summary', payload.summary], ['Trend', payload.trend], ['Key levels', payload.key_levels], ['Risks', payload.risks], ['Invalidation', payload.invalidation], ['Backtest ideas', payload.backtest_ideas], ['Confidence', payload.confidence]].forEach(([title, value]) => target.appendChild(renderAiSection(title, value)));
  return true;
}

const baseAnalyze = window.analyze;
window.analyze = async function() {
  const target = document.getElementById('analysis');
  if (target) {
    target.classList.remove('ai-card-grid');
    target.textContent = 'Analyzing...';
  }
  const response = await post('/api/ai/analyze', { symbol: $('symbol').value, asset_type: $('asset').value, exchange: $('exchange').value, timeframe: $('tf').value, question: $('question').value });
  if (!renderStructuredAnalysis(response.structured_analysis)) print(response.analysis?.content || response, 'analysis');
};

const style = document.createElement('style');
style.textContent = '.ai-card-grid{display:grid;gap:8px;white-space:normal}.ai-card{border:1px solid #334155;border-radius:10px;background:#0b1220;padding:9px}.ai-card b{color:#bfdbfe}.ai-card ul{margin:6px 0 0 18px;padding:0}.ai-card li{margin:3px 0}.chart-cell.active-chart-cell{border-color:#60a5fa;box-shadow:0 0 0 1px rgba(96,165,250,.35) inset}.secondary-chart-cell .slot-card{max-width:210px}.slot-summary{margin-right:8px}';
document.head.appendChild(style);

ensureSlotShells();
bindSlotActivation();
