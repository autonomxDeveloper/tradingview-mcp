(function() {
  const FULL_CRYPTO_HISTORY_CANDLE_LIMIT = 5000;
  const CUSTOM_INTERVAL_STORAGE_KEY = 'workstation-custom-intervals';
  const CRYPTO_INTERVALS = ['1s', '1m', '3m', '5m', '15m', '30m', '1h', '2h', '4h', '6h', '8h', '12h', '1D', '3D', '1W'];
  const STOCK_INTERVALS = ['1m', '2m', '5m', '15m', '30m', '1h', '1D', '1W', '1M'];
  const CHART_TOOL_ACTIONS = [
    { icon: '✛', label: 'Show tools', action: 'top-tools' },
    { icon: '⌖', label: 'Auto-fit chart', action: 'chart.fit' },
    { icon: '╱', label: 'Show drawing tools', action: 'drawing-tools' },
    { icon: '⌁', label: 'Add last close level', action: 'drawings.addLastCloseLevel' },
    { icon: '⌬', label: 'Open watchlist', action: 'watchlist' },
    { icon: '⚑', label: 'Open research', action: 'research' },
    { icon: '⌕', label: 'Run scanner', action: 'scanner.scan' },
    { icon: '⌘', label: 'Show modules', action: 'modules.open' },
    { icon: '☆', label: 'Show ideas', action: 'ideas.list' },
  ];
  const RIGHT_DOCK_ACTIONS = [
    { icon: '☰', label: 'Alerts', chromeToggle: 'research', badge: '' },
    { icon: '◷', label: 'Log', chromeToggle: 'research', badge: '9' },
    { icon: '◇', label: 'Layers', action: 'payload.show', badge: '' },
    { icon: '▱', label: 'Notes', action: 'journal.load', badge: '' },
    { icon: '◎', label: 'Scanner', action: 'scanner.scan', badge: '' },
    { icon: '▵', label: 'Ideas', action: 'ideas.list', badge: '' },
    { icon: '▣', label: 'Modules', action: 'modules.open', badge: '' },
    { icon: '?', label: 'Help', action: 'payload.show', badge: '' },
  ];
  const TRADINGVIEW_ALERT_ROWS = [
    { title: 'BTCUSDT 1D full-history loaded', meta: 'BTCUSDT · 1D · Active', status: 'active', token: '₿' },
    { title: 'BTCUSDT crossing key level', meta: 'BTCUSDT · Alert ready', status: 'active', token: '₿' },
    { title: 'RSI 14 close watch', meta: 'BTCUSDT · Research-only', status: 'stopped', token: 'R' },
    { title: 'MACD close 12 26 9', meta: 'BTCUSDT · Research-only', status: 'stopped', token: 'M' },
    { title: 'Scanner candidate review', meta: 'Watchlist · Active', status: 'active', token: 'S' },
    { title: 'Paper workflow checkpoint', meta: 'Simulated only · No live orders', status: 'expired', token: 'P' },
  ];

  function preferFullCryptoHistory() {
    const original = window.marketCandleLimit;
    window.marketCandleLimit = function(timeframe, isCrypto) {
      const tf = String(timeframe || '').toLowerCase();
      if (isCrypto && (tf === '1d' || tf === '1w')) return FULL_CRYPTO_HISTORY_CANDLE_LIMIT;
      if (typeof original === 'function') return original(timeframe, isCrypto);
      return isCrypto ? 600 : 500;
    };
  }

  function ready(fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn, { once: true });
    else fn();
  }

  function refreshChartSurface() {
    const resize = window.resizePrimaryChartToSurface || window.scheduleChartSurfaceRefresh;
    if (typeof resize === 'function') {
      window.requestAnimationFrame(() => resize());
      window.setTimeout(() => resize(), 180);
    }
  }

  function isCryptoContext() {
    const asset = document.getElementById('asset');
    const symbol = document.getElementById('symbol');
    const cleanSymbol = String(symbol && symbol.value || '').toUpperCase();
    return (asset && asset.value === 'crypto') || cleanSymbol.endsWith('USDT') || cleanSymbol.endsWith('-USD');
  }

  function intervalListForCurrentContext() {
    return isCryptoContext() ? CRYPTO_INTERVALS : STOCK_INTERVALS;
  }

  function normalizeIntervalLabel(value) {
    const raw = String(value || '').trim();
    const match = raw.match(/^(\d+)\s*(s|sec|secs|second|seconds|m|min|mins|minute|minutes|h|hr|hrs|hour|hours|d|day|days|w|week|weeks|mo|mon|month|months)$/i);
    if (!match) return '';
    const amount = Number(match[1]);
    const unit = match[2].toLowerCase();
    if (!Number.isFinite(amount) || amount <= 0) return '';
    if (['s', 'sec', 'secs', 'second', 'seconds'].includes(unit)) return `${amount}s`;
    if (['m', 'min', 'mins', 'minute', 'minutes'].includes(unit)) return `${amount}m`;
    if (['h', 'hr', 'hrs', 'hour', 'hours'].includes(unit)) return `${amount}h`;
    if (['d', 'day', 'days'].includes(unit)) return `${amount}D`;
    if (['w', 'week', 'weeks'].includes(unit)) return `${amount}W`;
    if (['mo', 'mon', 'month', 'months'].includes(unit)) return `${amount}M`;
    return '';
  }

  function supportedInterval(value) {
    const normalized = normalizeIntervalLabel(value);
    if (!normalized) return '';
    const supported = intervalListForCurrentContext();
    const match = supported.find((candidate) => candidate.toLowerCase() === normalized.toLowerCase());
    return match || '';
  }

  function loadStoredCustomIntervals() {
    try {
      const parsed = JSON.parse(localStorage.getItem(CUSTOM_INTERVAL_STORAGE_KEY) || '[]');
      return Array.isArray(parsed) ? parsed.filter((item) => typeof item === 'string') : [];
    } catch (_) {
      return [];
    }
  }

  function saveCustomInterval(value) {
    const existing = loadStoredCustomIntervals();
    const next = [value].concat(existing.filter((item) => item.toLowerCase() !== value.toLowerCase())).slice(0, 12);
    localStorage.setItem(CUSTOM_INTERVAL_STORAGE_KEY, JSON.stringify(next));
  }

  function ensureIntervalOption(value, label) {
    const select = document.getElementById('tf');
    if (!select) return;
    const exists = Array.from(select.options).some((option) => option.value.toLowerCase() === value.toLowerCase() || option.textContent.toLowerCase() === value.toLowerCase());
    if (exists) return;
    const option = document.createElement('option');
    option.value = value;
    option.textContent = label || value;
    option.dataset.customInterval = 'true';
    select.appendChild(option);
  }

  function installIntervalOptions() {
    intervalListForCurrentContext().forEach((interval) => ensureIntervalOption(interval));
    loadStoredCustomIntervals().forEach((interval) => {
      if (supportedInterval(interval)) ensureIntervalOption(interval, `${interval} custom`);
    });
  }

  function applyCustomInterval(value) {
    const interval = supportedInterval(value);
    if (!interval) {
      const supported = intervalListForCurrentContext().join(', ');
      window.alert(`Unsupported interval for the current data source. Supported intervals: ${supported}`);
      return;
    }
    ensureIntervalOption(interval, `${interval} custom`);
    saveCustomInterval(interval);
    const select = document.getElementById('tf');
    if (select) {
      select.value = interval;
      select.dispatchEvent(new Event('change', { bubbles: true }));
    }
    if (typeof window.loadMarket === 'function') window.loadMarket();
  }

  function openCustomIntervalPrompt() {
    installIntervalOptions();
    const supported = intervalListForCurrentContext().join(', ');
    const input = window.prompt(`Add custom interval. Supported for this data source: ${supported}`, '3m');
    if (input === null) return;
    applyCustomInterval(input);
  }

  function installCustomIntervalControl() {
    const toolbar = document.querySelector('.topbar');
    const timeframe = document.getElementById('tf');
    if (!toolbar || !timeframe || document.getElementById('customIntervalButton')) return;
    installIntervalOptions();
    const button = document.createElement('button');
    button.id = 'customIntervalButton';
    button.type = 'button';
    button.className = 'secondary custom-interval-button';
    button.textContent = '+ interval';
    button.title = 'Add custom chart interval';
    button.addEventListener('click', (event) => {
      event.preventDefault();
      openCustomIntervalPrompt();
    });
    timeframe.insertAdjacentElement('afterend', button);
    const asset = document.getElementById('asset');
    const symbol = document.getElementById('symbol');
    if (asset) asset.addEventListener('change', installIntervalOptions);
    if (symbol) symbol.addEventListener('change', installIntervalOptions);
  }

  function installTradingViewRightDockStyles() {
    if (document.getElementById('tradingViewRightDockStyles')) return;
    const style = document.createElement('style');
    style.id = 'tradingViewRightDockStyles';
    style.textContent = `
      body.side-panels-collapsed .right.tradingview-right-panel {
        background: #f5f7fb;
        border-left: 1px solid #d7dce5;
      }
      body.side-panels-collapsed .right.tradingview-right-panel > .tradingview-right-dock {
        display: flex !important;
        opacity: 1 !important;
        pointer-events: auto !important;
      }
      body.side-panels-collapsed .right.tradingview-right-panel > .research-rail-toggle {
        display: none !important;
      }
      body.side-panels-collapsed.research-expanded main {
        grid-template-columns: 44px minmax(0, 1fr) minmax(360px, 390px);
      }
      body.side-panels-collapsed.watchlist-expanded.research-expanded main {
        grid-template-columns: 220px minmax(0, 1fr) minmax(360px, 390px);
      }
      .right.tradingview-right-panel {
        padding: 0;
        display: grid;
        grid-template-columns: minmax(0, 1fr) 46px;
        align-items: stretch;
        background: #f5f7fb;
        border-left: 1px solid #d7dce5;
      }
      .right.tradingview-right-panel .tradingview-right-dock {
        grid-column: 2;
        grid-row: 1 / span 99;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 7px;
        width: 46px;
        min-width: 46px;
        padding: 8px 5px;
        background: #fff;
        border-left: 1px solid #d7dce5;
        box-sizing: border-box;
        z-index: 9;
      }
      .tradingview-right-dock-button {
        position: relative;
        display: grid;
        place-items: center;
        width: 34px;
        height: 34px;
        border: 0;
        border-radius: 10px;
        background: transparent;
        color: #131722;
        font-size: 20px;
        line-height: 1;
        cursor: pointer;
      }
      .tradingview-right-dock-button:hover,
      .tradingview-right-dock-button:focus-visible,
      .tradingview-right-dock-button.active {
        background: #eef1f6;
        outline: none;
      }
      .tradingview-right-dock-badge {
        position: absolute;
        top: 1px;
        right: 0;
        min-width: 15px;
        height: 15px;
        padding-inline: 3px;
        border-radius: 999px;
        background: #ff4a68;
        color: #fff;
        font-size: 10px;
        line-height: 15px;
        font-weight: 700;
      }
      .right.tradingview-right-panel .tradingview-alerts-panel,
      .right.tradingview-right-panel .tradingview-research-stack {
        grid-column: 1;
        min-width: 0;
      }
      body.side-panels-collapsed:not(.research-expanded) .right.tradingview-right-panel .tradingview-alerts-panel,
      body.side-panels-collapsed:not(.research-expanded) .right.tradingview-right-panel .tradingview-research-stack {
        display: none !important;
      }
      .tradingview-alerts-panel {
        background: #f5f7fb;
        color: #131722;
        border-right: 1px solid #e0e3eb;
        overflow: hidden;
      }
      .tradingview-alert-tabs {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 0;
        padding: 10px 10px 8px;
      }
      .tradingview-alert-tab {
        height: 38px;
        border: 0;
        background: #eceff4;
        color: #131722;
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
      }
      .tradingview-alert-tab:first-child {
        border-radius: 9px 0 0 9px;
        background: #fff;
        box-shadow: inset 0 0 0 1px #e0e3eb;
      }
      .tradingview-alert-tab:last-child {
        border-radius: 0 9px 9px 0;
      }
      .tradingview-alert-tab .count {
        display: inline-grid;
        place-items: center;
        min-width: 17px;
        height: 17px;
        margin-left: 4px;
        border-radius: 999px;
        background: #ff4a68;
        color: #fff;
        font-size: 11px;
      }
      .tradingview-alert-actions {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 6px 10px 8px;
        border-bottom: 1px solid #e0e3eb;
      }
      .tradingview-alert-action {
        display: grid;
        place-items: center;
        width: 30px;
        height: 30px;
        border: 0;
        border-radius: 8px;
        background: transparent;
        color: #131722;
        font-size: 21px;
        cursor: pointer;
      }
      .tradingview-alert-action:hover,
      .tradingview-alert-action:focus-visible {
        background: #e8edf5;
        outline: none;
      }
      .tradingview-alert-list {
        max-height: 42vh;
        overflow: auto;
        background: #fff;
      }
      .tradingview-alert-row {
        display: grid;
        grid-template-columns: 24px minmax(0, 1fr);
        gap: 8px;
        padding: 9px 10px;
        border-bottom: 1px solid #eceff4;
      }
      .tradingview-alert-symbol {
        display: grid;
        place-items: center;
        width: 22px;
        height: 22px;
        border-radius: 50%;
        color: #fff;
        background: #2962ff;
        font-size: 12px;
        font-weight: 700;
      }
      .tradingview-alert-row.status-stopped .tradingview-alert-symbol,
      .tradingview-alert-row.status-expired .tradingview-alert-symbol {
        background: #d8dde8;
        color: #667085;
      }
      .tradingview-alert-title {
        overflow: hidden;
        color: #131722;
        font-size: 14px;
        font-weight: 650;
        white-space: nowrap;
        text-overflow: ellipsis;
      }
      .tradingview-alert-meta {
        margin-top: 3px;
        overflow: hidden;
        color: #6a7383;
        font-size: 12px;
        white-space: nowrap;
        text-overflow: ellipsis;
      }
      .tradingview-alert-status-active {
        color: #089981;
      }
      .tradingview-alert-status-stopped,
      .tradingview-alert-status-expired {
        color: #ff6d00;
      }
      .tradingview-research-stack {
        max-height: 44vh;
        overflow: auto;
        padding: 8px 10px 14px;
        background: #f5f7fb;
        border-top: 1px solid #e0e3eb;
      }
      .tradingview-research-stack .panel {
        margin: 0 0 10px;
        border: 1px solid #e0e3eb;
        border-radius: 10px;
        background: #fff;
        color: #131722;
        box-shadow: none;
      }
      .tradingview-research-stack textarea,
      .tradingview-research-stack input,
      .tradingview-research-stack select,
      .tradingview-research-stack pre {
        max-width: 100%;
      }
    `;
    document.head.appendChild(style);
  }

  function createDockButton(tool) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'tradingview-right-dock-button';
    button.setAttribute('aria-label', tool.label);
    button.title = tool.label;
    button.textContent = tool.icon;
    if (tool.chromeToggle) button.dataset.chromeToggle = tool.chromeToggle;
    if (tool.action) button.dataset.rightDockAction = tool.action;
    if (tool.badge) {
      const badge = document.createElement('span');
      badge.className = 'tradingview-right-dock-badge';
      badge.textContent = tool.badge;
      button.appendChild(badge);
    }
    button.addEventListener('click', (event) => {
      if (tool.chromeToggle) return;
      event.preventDefault();
      event.stopPropagation();
      if (!document.body.classList.contains('research-expanded')) togglePanel('research');
      if (tool.action) activateDataAction(tool.action);
    });
    return button;
  }

  function createAlertRow(row) {
    const item = document.createElement('div');
    item.className = `tradingview-alert-row status-${row.status}`;
    const symbol = document.createElement('span');
    symbol.className = 'tradingview-alert-symbol';
    symbol.textContent = row.token;
    const text = document.createElement('div');
    const title = document.createElement('div');
    title.className = 'tradingview-alert-title';
    title.textContent = row.title;
    const meta = document.createElement('div');
    meta.className = 'tradingview-alert-meta';
    const status = document.createElement('span');
    status.className = `tradingview-alert-status-${row.status}`;
    status.textContent = row.status === 'active' ? 'Active' : row.status === 'expired' ? 'Stopped — Expired' : 'Stopped — Triggered';
    meta.append(row.meta.replace(row.status === 'active' ? 'Active' : 'Stopped', '').replace(/\s+$/, ''), ' · ', status);
    text.append(title, meta);
    item.append(symbol, text);
    return item;
  }

  function installTradingViewRightPanel() {
    const right = document.querySelector('.right');
    if (!right || right.dataset.tradingViewDockInstalled === 'true') return;
    right.dataset.tradingViewDockInstalled = 'true';
    right.classList.add('tradingview-right-panel');
    installTradingViewRightDockStyles();

    const dock = document.createElement('nav');
    dock.className = 'tradingview-right-dock';
    dock.setAttribute('aria-label', 'TradingView right toolbar');
    RIGHT_DOCK_ACTIONS.forEach((tool, index) => {
      const button = createDockButton(tool);
      if (index === 0) button.classList.add('active');
      dock.appendChild(button);
    });

    const alertsPanel = document.createElement('section');
    alertsPanel.className = 'tradingview-alerts-panel';
    alertsPanel.setAttribute('aria-label', 'Alerts and log');
    const tabs = document.createElement('div');
    tabs.className = 'tradingview-alert-tabs';
    tabs.innerHTML = '<button class="tradingview-alert-tab" type="button">Alerts</button><button class="tradingview-alert-tab" type="button">Log <span class="count">9</span></button>';
    const actions = document.createElement('div');
    actions.className = 'tradingview-alert-actions';
    actions.innerHTML = '<button class="tradingview-alert-action" type="button" title="Add alert">＋</button><button class="tradingview-alert-action" type="button" title="Search alerts">⌕</button><button class="tradingview-alert-action" type="button" title="Sort alerts">⇅</button><button class="tradingview-alert-action" type="button" title="More alert actions">⋯</button>';
    const list = document.createElement('div');
    list.className = 'tradingview-alert-list';
    TRADINGVIEW_ALERT_ROWS.forEach((row) => list.appendChild(createAlertRow(row)));
    alertsPanel.append(tabs, actions, list);

    const stack = document.createElement('div');
    stack.className = 'tradingview-research-stack';
    Array.from(right.children).forEach((child) => {
      if (child.classList && child.classList.contains('panel-rail-toggle')) return;
      stack.appendChild(child);
    });
    right.prepend(alertsPanel);
    right.appendChild(stack);
    right.appendChild(dock);
  }

  function updateChromeLabels() {
    const topButton = document.querySelector('[data-chrome-toggle="top-tools"]');
    if (topButton) {
      const collapsed = document.body.classList.contains('top-tools-collapsed');
      topButton.textContent = collapsed ? 'Show tools' : 'Hide tools';
      topButton.setAttribute('aria-expanded', String(!collapsed));
    }

    const watchButton = document.querySelector('[data-chrome-toggle="watchlist"]');
    if (watchButton) {
      const expanded = document.body.classList.contains('watchlist-expanded');
      watchButton.textContent = expanded ? 'Hide watchlist' : 'Watchlist';
      watchButton.setAttribute('aria-expanded', String(expanded));
    }

    const researchButton = document.querySelector('[data-chrome-toggle="research"]');
    if (researchButton) {
      const expanded = document.body.classList.contains('research-expanded');
      researchButton.textContent = expanded ? 'Hide research' : 'Research';
      researchButton.setAttribute('aria-expanded', String(expanded));
    }
  }

  function toggleTopTools() {
    document.body.classList.toggle('top-tools-collapsed');
    updateChromeLabels();
    refreshChartSurface();
  }

  function togglePanel(panel) {
    if (panel === 'watchlist') document.body.classList.toggle('watchlist-expanded');
    if (panel === 'research') document.body.classList.toggle('research-expanded');
    updateChromeLabels();
    refreshChartSurface();
  }

  function activateDataAction(action) {
    const escaped = action.replace(/"/g, '\\"');
    const target = document.querySelector(`[data-action="${escaped}"]`);
    if (target) {
      target.click();
      return true;
    }
    return false;
  }

  function showDrawingTools() {
    document.body.classList.toggle('drawing-tools-expanded');
    if (document.body.classList.contains('top-tools-collapsed')) document.body.classList.remove('top-tools-collapsed');
    updateChromeLabels();
    refreshChartSurface();
  }

  function activateChartTool(action) {
    if (action === 'top-tools') toggleTopTools();
    else if (action === 'watchlist') togglePanel('watchlist');
    else if (action === 'research') togglePanel('research');
    else if (action === 'drawing-tools') showDrawingTools();
    else activateDataAction(action);
  }

  function installChartToolRail() {
    const center = document.querySelector('.center');
    if (!center || document.getElementById('chartToolRail')) return;
    const rail = document.createElement('div');
    rail.id = 'chartToolRail';
    rail.className = 'chart-tool-rail';
    rail.setAttribute('aria-label', 'Chart tool rail');
    CHART_TOOL_ACTIONS.forEach((tool) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'chart-tool-button';
      button.dataset.chartToolAction = tool.action;
      button.setAttribute('aria-label', tool.label);
      button.title = tool.label;
      button.textContent = tool.icon;
      button.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        activateChartTool(tool.action);
      });
      rail.appendChild(button);
    });
    center.insertBefore(rail, center.firstChild);
  }

  function bindPanelSurfaceClicks() {
    [
      { selector: 'aside', panel: 'watchlist', expandedClass: 'watchlist-expanded' },
      { selector: '.right', panel: 'research', expandedClass: 'research-expanded' },
    ].forEach(({ selector, panel, expandedClass }) => {
      const surface = document.querySelector(selector);
      if (!surface || surface.dataset.chromeSurfaceBound === 'true') return;
      surface.dataset.chromeSurfaceBound = 'true';
      surface.addEventListener('click', (event) => {
        const target = event.target;
        if (!(target instanceof Element)) return;
        if (target.closest('.panel-rail-toggle') || target.closest('.tradingview-right-dock-button')) return;
        if (!document.body.classList.contains('side-panels-collapsed')) return;
        if (document.body.classList.contains(expandedClass)) return;
        event.preventDefault();
        togglePanel(panel);
      });
    });
  }

  function bindChromeControls() {
    installCustomIntervalControl();
    installTradingViewRightPanel();
    installChartToolRail();
    bindPanelSurfaceClicks();
    document.querySelectorAll('[data-chrome-toggle]').forEach((button) => {
      if (button.dataset.chromeToggleBound === 'true') return;
      button.dataset.chromeToggleBound = 'true';
      button.addEventListener('click', (event) => {
        event.preventDefault();
        const target = button.dataset.chromeToggle;
        if (target === 'top-tools') toggleTopTools();
        else togglePanel(target);
      });
    });
    updateChromeLabels();
  }

  preferFullCryptoHistory();
  window.toggleTopTools = toggleTopTools;
  window.toggleWorkstationPanel = togglePanel;
  window.activateChartTool = activateChartTool;
  window.installTradingViewRightPanel = installTradingViewRightPanel;
  window.workstationCustomIntervals = {
    normalizeIntervalLabel,
    supportedInterval,
    applyCustomInterval,
    installIntervalOptions,
    CRYPTO_INTERVALS,
    STOCK_INTERVALS,
  };

  ready(bindChromeControls);
})();
