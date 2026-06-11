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
        if (target.closest('.panel-rail-toggle')) return;
        if (!document.body.classList.contains('side-panels-collapsed')) return;
        if (document.body.classList.contains(expandedClass)) return;
        event.preventDefault();
        togglePanel(panel);
      });
    });
  }

  function bindChromeControls() {
    installCustomIntervalControl();
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
