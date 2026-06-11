(function() {
  const QUICK_INTERVALS = [
    { label: '2h', value: '2h' },
    { label: '2W', value: '2W' },
    { label: 'D', value: '1D' },
  ];

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

  function runAction(action, arg) {
    const selector = arg
      ? `[data-action="${action}"][data-action-arg="${arg}"]`
      : `[data-action="${action}"]`;
    const target = document.querySelector(selector);
    if (target) {
      target.click();
      return true;
    }
    if (typeof window.runWorkstationAction === 'function') {
      const proxy = document.createElement('button');
      proxy.dataset.action = action;
      if (arg) proxy.dataset.actionArg = arg;
      return window.runWorkstationAction(proxy, new Event('click')) !== false;
    }
    return false;
  }

  function topButton(label, title, attrs) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'tv-compact-top-button';
    button.textContent = label;
    button.title = title || label;
    Object.entries(attrs || {}).forEach(([key, value]) => {
      if (key === 'dataset') Object.entries(value).forEach(([dataKey, dataValue]) => { button.dataset[dataKey] = dataValue; });
      else button.setAttribute(key, value);
    });
    return button;
  }

  function makeSymbolInput() {
    const input = document.createElement('input');
    input.id = 'symbol';
    input.value = 'BTCUSDT';
    input.setAttribute('aria-label', 'Symbol');
    return input;
  }

  function makeTimeframeSelect() {
    const select = document.createElement('select');
    select.id = 'tf';
    select.setAttribute('aria-label', 'Timeframe');
    ['1m', '5m', '15m', '1h', '1D', '1W'].forEach((value) => {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = value;
      if (value === '1D') option.selected = true;
      select.appendChild(option);
    });
    return select;
  }

  function makeActionButton(label, action, className) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = label;
    button.dataset.action = action;
    button.className = className || 'tv-compact-load-button';
    return button;
  }

  function setInterval(value) {
    const timeframe = document.getElementById('tf');
    if (!timeframe) return;
    const exists = Array.from(timeframe.options).some((option) => option.value === value || option.textContent === value);
    if (!exists) {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = value;
      option.dataset.compactTopInterval = 'true';
      timeframe.appendChild(option);
    }
    timeframe.value = value;
    timeframe.dispatchEvent(new Event('change', { bubbles: true }));
    runAction('market.load');
  }

  function openSideTools() {
    if (typeof window.toggleWorkstationPanel === 'function' && !document.body.classList.contains('research-expanded')) {
      window.toggleWorkstationPanel('research');
    } else {
      document.body.classList.add('research-expanded');
    }
  }

  function appendCoreToolbarItems(compact, topbar) {
    if (!compact.querySelector('#symbol')) {
      compact.appendChild(document.getElementById('symbol') || makeSymbolInput());
    }
    if (!compact.querySelector('[data-compact-action="symbolPrompt"]')) compact.appendChild(topButton('＋', 'Load or compare symbol', { dataset: { compactAction: 'symbolPrompt' } }));
    QUICK_INTERVALS.forEach((item) => {
      if (!compact.querySelector(`[data-compact-timeframe="${item.value}"]`)) {
        compact.appendChild(topButton(item.label, `Set timeframe to ${item.label}`, { dataset: { compactTimeframe: item.value } }));
      }
    });
    if (!compact.querySelector('#tf')) {
      compact.appendChild(document.getElementById('tf') || makeTimeframeSelect());
    }
    const compactActions = [
      ['▥', 'Candles / chart type', 'fit'],
      ['Indicators', 'Open indicators and chart tools', 'indicators'],
      ['⌗', 'Layout grid', 'layout'],
      ['Alert', 'Open alerts / research panel', 'alerts'],
      ['Replay', 'Open journal timeline / replay', 'replay'],
      ['↶', 'Reset chart layout', 'reset'],
      ['↷', 'Auto-fit chart', 'fit'],
    ];
    compactActions.forEach(([label, title, action]) => {
      if (!compact.querySelector(`[data-compact-action="${action}"]`) || (action === 'fit' && compact.querySelectorAll('[data-compact-action="fit"]').length < 2)) {
        compact.appendChild(topButton(label, title, { dataset: { compactAction: action } }));
      }
    });

    const load = topbar.querySelector('[data-action="market.load"]') || document.querySelector('[data-action="market.load"]');
    const analyze = topbar.querySelector('[data-action="analysis.run"]') || document.querySelector('[data-action="analysis.run"]');
    if (!compact.querySelector('[data-action="market.load"]')) {
      const loadButton = load || makeActionButton('Load', 'market.load');
      loadButton.textContent = 'Load';
      loadButton.classList.add('tv-compact-load-button');
      compact.appendChild(loadButton);
    }
    if (!compact.querySelector('[data-action="analysis.run"]')) {
      const aiButton = analyze || makeActionButton('AI', 'analysis.run', 'secondary tv-compact-load-button tv-compact-ai-button');
      aiButton.textContent = 'AI';
      aiButton.classList.add('tv-compact-load-button', 'tv-compact-ai-button');
      compact.appendChild(aiButton);
    }
  }

  function ensureCompactToolbarMarkup(topbar) {
    let compact = document.getElementById('compactTradingTopToolbar');
    if (!compact) {
      compact = document.createElement('div');
      compact.id = 'compactTradingTopToolbar';
      compact.setAttribute('aria-label', 'TradingView-style compact chart toolbar');
      topbar.prepend(compact);
    }
    appendCoreToolbarItems(compact, topbar);
    return compact;
  }

  function forceVisibleElement(element, display) {
    if (!element) return;
    element.hidden = false;
    element.removeAttribute('hidden');
    element.removeAttribute('aria-hidden');
    element.style.setProperty('display', display || 'flex', 'important');
    element.style.setProperty('visibility', 'visible', 'important');
    element.style.setProperty('opacity', '1', 'important');
  }

  function forceCompactToolbarVisible(topbar, compact) {
    forceVisibleElement(topbar, 'flex');
    forceVisibleElement(compact, 'flex');
    topbar.style.setProperty('min-height', '42px', 'important');
    topbar.style.setProperty('height', '42px', 'important');
    topbar.style.setProperty('position', 'sticky', 'important');
    topbar.style.setProperty('top', '0', 'important');
    topbar.style.setProperty('z-index', '500', 'important');
    topbar.style.setProperty('background', '#ffffff', 'important');
    topbar.style.setProperty('border-bottom', '1px solid #d9e1ec', 'important');
    compact.style.setProperty('align-items', 'center', 'important');
    compact.style.setProperty('gap', '7px', 'important');
    compact.style.setProperty('min-height', '34px', 'important');
    compact.querySelectorAll('input, select, button').forEach((control) => {
      forceVisibleElement(control, control.tagName === 'BUTTON' ? 'inline-grid' : 'inline-block');
      control.style.setProperty('pointer-events', 'auto', 'important');
    });
  }

  function bindCompactToolbar(compact) {
    if (!compact || compact.dataset.boundCompactTopToolbar === 'true') return;
    compact.dataset.boundCompactTopToolbar = 'true';
    compact.addEventListener('click', (event) => {
      const button = event.target.closest('button');
      if (!button || !compact.contains(button)) return;
      const timeframe = button.dataset.compactTimeframe;
      const action = button.dataset.compactAction;
      if (!timeframe && !action) return;
      event.preventDefault();
      event.stopPropagation();
      if (timeframe) {
        setInterval(timeframe);
        return;
      }
      if (action === 'symbolPrompt') {
        const symbol = document.getElementById('symbol');
        const next = window.prompt('Load symbol', symbol ? symbol.value : 'BTCUSDT');
        if (next && symbol) {
          symbol.value = next.trim().toUpperCase();
          runAction('market.load');
        }
      } else if (action === 'indicators' || action === 'layout') {
        openSideTools();
        const panel = document.querySelector('.side-chart-tools-panel');
        if (panel) panel.scrollIntoView({ block: 'start' });
      } else if (action === 'alerts') {
        if (typeof window.toggleWorkstationPanel === 'function' && !document.body.classList.contains('research-expanded')) window.toggleWorkstationPanel('research');
        else document.body.classList.add('research-expanded');
      } else if (action === 'replay') {
        runAction('journal.load');
      } else if (action === 'reset') {
        runAction('layout.reset');
      } else if (action === 'fit') {
        runAction('chart.fit');
      }
    });
  }

  function installCompactTopToolbar() {
    const center = document.querySelector('.center');
    let topbar = document.querySelector('.topbar');
    if (!topbar && center) {
      topbar = document.createElement('div');
      topbar.className = 'bar topbar compact-market-toolbar';
      topbar.setAttribute('aria-label', 'TradingView-style compact chart toolbar');
      center.prepend(topbar);
    }
    if (!topbar) return false;

    document.body.classList.add('top-toolbar-integrated');
    document.body.classList.add('top-tools-collapsed');
    topbar.classList.add('compact-market-toolbar');

    const compact = ensureCompactToolbarMarkup(topbar);
    forceCompactToolbarVisible(topbar, compact);
    bindCompactToolbar(compact);
    refreshChartSurface();
    return true;
  }

  function installSideToolStyles() {
    if (document.getElementById('topToolbarSidePanelStyles')) return;
    const style = document.createElement('style');
    style.id = 'topToolbarSidePanelStyles';
    style.textContent = `
      body.top-toolbar-integrated.chart-toolbar-clean .center {
        grid-template-rows: 42px minmax(0, 1fr) auto auto 96px;
      }
      body.top-toolbar-integrated .topbar {
        display: flex !important;
        visibility: visible !important;
        opacity: 1 !important;
        min-height: 42px !important;
        height: 42px !important;
        padding: 0 8px;
        overflow: hidden;
        flex-wrap: nowrap;
        position: sticky !important;
        top: 0 !important;
        z-index: 500 !important;
        background: #fff !important;
        border-bottom: 1px solid #d9e1ec !important;
      }
      body.top-toolbar-integrated.top-tools-collapsed .topbar > :not(#compactTradingTopToolbar),
      body.top-toolbar-integrated .topbar > :not(#compactTradingTopToolbar) {
        display: none !important;
      }
      #compactTradingTopToolbar {
        display: flex !important;
        visibility: visible !important;
        opacity: 1 !important;
        align-items: center;
        gap: 7px;
        width: 100%;
        min-width: 0;
        min-height: 34px;
        white-space: nowrap;
        overflow: hidden;
        pointer-events: auto !important;
      }
      #compactTradingTopToolbar #symbol {
        display: inline-block !important;
        width: 150px;
        min-width: 120px;
        height: 30px;
        border-radius: 999px;
        font-size: 15px;
        font-weight: 700;
        background: #f3f4f6;
      }
      #compactTradingTopToolbar #tf {
        display: inline-block !important;
        width: 52px;
        min-width: 52px;
        height: 30px;
        border-color: transparent;
        background: #f3f4f6;
        font-weight: 650;
      }
      .tv-compact-top-button,
      #compactTradingTopToolbar .tv-compact-load-button {
        display: inline-grid !important;
        place-items: center;
        height: 30px !important;
        min-width: 30px;
        padding: 0 8px !important;
        border: 0 !important;
        border-radius: 8px !important;
        background: transparent !important;
        color: #131722 !important;
        font-size: 14px !important;
        font-weight: 650 !important;
        white-space: nowrap;
        pointer-events: auto !important;
      }
      .tv-compact-top-button:hover,
      .tv-compact-top-button:focus-visible,
      #compactTradingTopToolbar .tv-compact-load-button:hover,
      #compactTradingTopToolbar .tv-compact-load-button:focus-visible {
        background: #f0f3f8 !important;
        outline: none;
      }
      body.chart-tools-in-side-panel .chartbar {
        display: grid;
        gap: 10px;
        padding: 0;
        background: transparent;
        border-bottom: 0;
        overflow: visible;
      }
      body.chart-tools-in-side-panel .side-chart-tools-panel .chartbar .toolbar-section {
        display: grid;
        grid-template-columns: 1fr;
        gap: 7px;
        padding: 8px 0 10px;
        border-right: 0;
        border-bottom: 1px solid #edf2f7;
      }
      body.chart-tools-in-side-panel .side-chart-tools-panel .chartbar .toolbar-section:last-child {
        border-bottom: 0;
      }
      body.chart-tools-in-side-panel .side-chart-tools-panel .toolbar-section-label {
        display: block;
        color: #6b7280;
      }
      body.chart-tools-in-side-panel .side-chart-tools-panel .chartbar button,
      body.chart-tools-in-side-panel .side-chart-tools-panel .chartbar input,
      body.chart-tools-in-side-panel .side-chart-tools-panel .chartbar select,
      body.chart-tools-in-side-panel .side-chart-tools-panel .sync-toggle {
        width: 100%;
        box-sizing: border-box;
      }
      .side-chart-tools-panel {
        margin: 0 0 10px;
        border: 1px solid #e0e3eb;
        border-radius: 10px;
        background: #fff;
        color: #131722;
        padding: 10px;
      }
      .side-chart-tools-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        margin-bottom: 6px;
      }
      .side-chart-tools-header b {
        font-size: 14px;
      }
      .side-chart-tools-note {
        margin: 0 0 8px;
        color: #6b7280;
        font-size: 12px;
        line-height: 1.35;
      }
    `;
    document.head.appendChild(style);
  }

  function moveChartToolsToSidePanel() {
    const chartbar = document.querySelector('.chartbar');
    const right = document.querySelector('.right');
    if (!chartbar || !right || chartbar.closest('.side-chart-tools-panel')) return false;

    document.body.classList.add('chart-tools-in-side-panel');

    const panel = document.createElement('section');
    panel.className = 'side-chart-tools-panel';
    panel.setAttribute('aria-label', 'Chart tools moved from top toolbar');

    const header = document.createElement('div');
    header.className = 'side-chart-tools-header';
    header.innerHTML = '<b>Chart tools</b><span class="muted">Indicators · drawings · layout</span>';

    const note = document.createElement('p');
    note.className = 'side-chart-tools-note';
    note.textContent = 'The heavy chart controls live here so the top bar stays compact like TradingView.';

    panel.append(header, note, chartbar);

    const stack = right.querySelector('.tradingview-research-stack');
    if (stack) stack.prepend(panel);
    else {
      const firstPanel = right.querySelector('.panel:not(.workflow-panel)') || right.querySelector('.panel');
      if (firstPanel) right.insertBefore(panel, firstPanel);
      else right.appendChild(panel);
    }
    refreshChartSurface();
    return true;
  }

  function install() {
    installSideToolStyles();
    if (!installCompactTopToolbar()) {
      window.requestAnimationFrame(installCompactTopToolbar);
      window.setTimeout(installCompactTopToolbar, 120);
      window.setTimeout(installCompactTopToolbar, 400);
    } else {
      window.requestAnimationFrame(installCompactTopToolbar);
      window.setTimeout(installCompactTopToolbar, 120);
    }
    if (!moveChartToolsToSidePanel()) {
      window.requestAnimationFrame(moveChartToolsToSidePanel);
      window.setTimeout(moveChartToolsToSidePanel, 120);
      window.setTimeout(moveChartToolsToSidePanel, 400);
    }
  }

  window.installTopToolbarSidePanel = install;
  ready(install);
})();