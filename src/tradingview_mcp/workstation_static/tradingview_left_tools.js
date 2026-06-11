(function installTradingViewLeftTools() {
  const TOOL_GROUPS = [
    {
      id: 'cursor',
      icon: '⌖',
      label: 'Cursor tools',
      items: [
        { icon: '⌖', label: 'Crosshair', shortcut: 'Alt + C', action: 'chart.fit', message: 'Crosshair mode selected. Chart interactions remain read-only.' },
        { icon: '↖', label: 'Arrow cursor', shortcut: 'Alt + A', message: 'Arrow cursor selected.' },
        { icon: '✋', label: 'Pan chart', shortcut: 'Alt + P', message: 'Pan mode selected. Drag the chart to inspect candles.' },
        { icon: '⌕', label: 'Zoom in', shortcut: '+', message: 'Use the chart range selector or mouse wheel to zoom.' },
        { icon: '⌔', label: 'Zoom out', shortcut: '-', message: 'Use the chart range selector or mouse wheel to zoom out.' },
      ],
    },
    {
      id: 'lines',
      icon: '╱',
      label: 'Lines',
      items: [
        { icon: '╱', label: 'Trendline', shortcut: 'Alt + T', action: 'drawing-tools', message: 'Trendline tool selected. Use guide start/end inputs, then Add guide.' },
        { icon: '⟍', label: 'Ray', message: 'Ray tool selected. Use guide controls to create a projected line.' },
        { icon: '╱□', label: 'Info line', message: 'Info line selected. Add a guide label to annotate it.' },
        { icon: '⟋⟋', label: 'Extended line', message: 'Extended line selected. Add guide start/end prices to approximate it.' },
        { icon: '∠', label: 'Trend angle', message: 'Trend angle selected. Use guide controls to annotate an angled level.' },
        { icon: '─', label: 'Horizontal line', shortcut: 'Alt + H', action: 'drawings.addLevel', message: 'Horizontal line selected. Enter a price level, then Add level.' },
        { icon: '→', label: 'Horizontal ray', shortcut: 'Alt + J', action: 'drawings.addLastCloseLevel', message: 'Horizontal ray selected. Last close level was requested.' },
        { icon: '│', label: 'Vertical line', shortcut: 'Alt + V', message: 'Vertical line selected. This chart currently supports price drawings; time markers are planned.' },
        { icon: '✛', label: 'Crossline', shortcut: 'Alt + C', action: 'drawings.addLevel', message: 'Crossline selected. Add a horizontal price level from the Draw controls.' },
      ],
    },
    {
      id: 'channels',
      icon: '≋',
      label: 'Channels',
      items: [
        { icon: '∥', label: 'Parallel channel', message: 'Parallel channel selected. Use support/resistance zones to approximate the channel.' },
        { icon: '▱', label: 'Regression trend', message: 'Regression trend selected. Use backtest or AI analysis for regression-style review.' },
        { icon: '═', label: 'Flat top/bottom', message: 'Flat top/bottom selected. Add a supply or demand zone.' },
        { icon: '≠', label: 'Disjoint channel', message: 'Disjoint channel selected. Use guide lines and zones to approximate it.' },
      ],
    },
    {
      id: 'pitchforks',
      icon: '⋔',
      label: 'Pitchforks',
      items: [
        { icon: '⋔', label: 'Pitchfork', message: 'Pitchfork selected. Multi-anchor pitchfork drawing is queued; use guides for now.' },
        { icon: '⋕', label: 'Schiff pitchfork', message: 'Schiff pitchfork selected.' },
        { icon: '⋕', label: 'Modified Schiff pitchfork', message: 'Modified Schiff pitchfork selected.' },
        { icon: '⋔', label: 'Inside pitchfork', message: 'Inside pitchfork selected.' },
      ],
    },
    {
      id: 'fib-gann',
      icon: '⑂',
      label: 'Gann and Fibonacci',
      items: [
        { icon: '⑂', label: 'Fib retracement', message: 'Fib retracement selected. Use zones for key retracement bands.' },
        { icon: '⑂', label: 'Trend-based Fib extension', message: 'Trend-based Fib extension selected.' },
        { icon: '⑂', label: 'Fib channel', message: 'Fib channel selected.' },
        { icon: '⑂', label: 'Fib time zone', message: 'Fib time zone selected.' },
        { icon: '◰', label: 'Gann box', message: 'Gann box selected. Use a zone annotation to approximate it.' },
        { icon: '◇', label: 'Gann square fixed', message: 'Gann square fixed selected.' },
        { icon: '⌁', label: 'Gann fan', message: 'Gann fan selected.' },
      ],
    },
    {
      id: 'geometry',
      icon: '□',
      label: 'Geometry',
      items: [
        { icon: '▭', label: 'Rectangle', action: 'drawing-tools', message: 'Rectangle selected. Enter zone low/high, then Add zone.' },
        { icon: '▱', label: 'Rotated rectangle', message: 'Rotated rectangle selected.' },
        { icon: '○', label: 'Ellipse', message: 'Ellipse selected.' },
        { icon: '⌒', label: 'Arc', message: 'Arc selected.' },
        { icon: '△', label: 'Triangle', message: 'Triangle selected.' },
        { icon: '↗', label: 'Arrow marker', message: 'Arrow marker selected. Use a chart note for now.' },
        { icon: '⟲', label: 'Path', message: 'Path selected.' },
      ],
    },
    {
      id: 'annotation',
      icon: 'T',
      label: 'Text and notes',
      items: [
        { icon: 'T', label: 'Text', shortcut: 'Alt + N', action: 'drawings.addNote', message: 'Text note selected. Enter note text, then Add note.' },
        { icon: '🗨', label: 'Callout', message: 'Callout selected. Use a chart note to annotate the current view.' },
        { icon: '⇨', label: 'Price label', action: 'drawings.addLevel', message: 'Price label selected. Enter a price and label, then Add level.' },
        { icon: '⚑', label: 'Flag mark', message: 'Flag mark selected.' },
        { icon: '☺', label: 'Icon', message: 'Icon marker selected.' },
        { icon: '📷', label: 'Snapshot note', action: 'ideas.save', message: 'Snapshot note selected. Save the current idea to capture context.' },
      ],
    },
    {
      id: 'measure',
      icon: '⌁',
      label: 'Measure and zoom',
      items: [
        { icon: '⌁', label: 'Measure', shortcut: 'Shift + Click', message: 'Measure selected. Use chart crosshair values and visible range for now.' },
        { icon: '⌕', label: 'Zoom in', action: 'chart.fit', message: 'Zoom tools selected. Auto-fit requested.' },
        { icon: '⤢', label: 'Date range', message: 'Use the bottom date range buttons: 5D, 1M, 3M, 6M, YTD, 1Y, 5Y, All.' },
        { icon: '🧲', label: 'Magnet mode', message: 'Magnet mode selected. Snap-to-candle drawing is planned.' },
        { icon: '🔒', label: 'Lock drawings', message: 'Lock drawings selected. Existing drawings remain read-only until changed from controls.' },
        { icon: '👁', label: 'Hide drawings', action: 'drawings.clear', message: 'Hide drawings selected. Clear drawings was requested.' },
      ],
    },
    {
      id: 'workspace',
      icon: '☆',
      label: 'Workspace',
      items: [
        { icon: '⌬', label: 'Open watchlist', action: 'watchlist', message: 'Watchlist toggled.' },
        { icon: '⚑', label: 'Open research', action: 'research', message: 'Research panel toggled.' },
        { icon: '⌕', label: 'Run scanner', action: 'scanner.scan', message: 'Scanner requested.' },
        { icon: '☆', label: 'Ideas', action: 'ideas.list', message: 'Ideas list requested.' },
        { icon: '▣', label: 'Modules', action: 'modules.open', message: 'Modules requested.' },
        { icon: '↺', label: 'Auto-fit chart', action: 'chart.fit', message: 'Auto-fit requested.' },
      ],
    },
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

  function getLeftPanelRightEdge(centerRect) {
    if (!document.body.classList.contains('watchlist-expanded')) return centerRect.left;
    const candidates = Array.from(document.querySelectorAll('main > aside:not(.right), aside:not(.right):not(.tradingview-right-panel)'));
    return candidates.reduce((rightEdge, panel) => {
      const rect = panel.getBoundingClientRect();
      if (rect.width < 80 || rect.height < 80) return rightEdge;
      return Math.max(rightEdge, rect.right);
    }, centerRect.left);
  }

  function syncToolbarGeometry() {
    const center = document.querySelector('.center');
    if (!center) return;
    const centerRect = center.getBoundingClientRect();
    const left = Math.max(0, getLeftPanelRightEdge(centerRect));
    const top = Math.max(0, centerRect.top);
    const bottom = Math.max(0, window.innerHeight - centerRect.bottom);
    const rootStyle = document.documentElement.style;
    rootStyle.setProperty('--tv-left-toolbar-left', `${Math.round(left)}px`);
    rootStyle.setProperty('--tv-left-toolbar-top', `${Math.round(top)}px`);
    rootStyle.setProperty('--tv-left-toolbar-bottom', `${Math.round(bottom)}px`);
    const menu = document.getElementById('chartToolMenu');
    const activeButton = document.querySelector('#chartToolRail .chart-tool-button.active');
    if (menu && activeButton && !menu.hidden) positionMenuForButton(menu, activeButton);
  }

  function installGeometryObservers() {
    const scheduleSync = () => window.requestAnimationFrame(syncToolbarGeometry);
    window.addEventListener('resize', scheduleSync);
    window.addEventListener('scroll', scheduleSync, true);

    if (typeof ResizeObserver === 'function') {
      const observer = new ResizeObserver(scheduleSync);
      document.querySelectorAll('.center, main > aside:not(.right), aside:not(.right):not(.tradingview-right-panel)').forEach((node) => observer.observe(node));
    }

    if (typeof MutationObserver === 'function') {
      const observer = new MutationObserver(scheduleSync);
      observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    }
  }

  function clickAction(action) {
    if (!action) return false;
    if (action === 'watchlist') {
      if (typeof window.setTradingViewWatchlistPanelOpen === 'function') {
        window.setTradingViewWatchlistPanelOpen(!document.body.classList.contains('watchlist-expanded'));
      } else {
        document.body.classList.toggle('watchlist-expanded');
      }
      syncToolbarGeometry();
      return true;
    }
    if (action === 'research') {
      if (typeof window.setTradingViewRightPanelOpen === 'function') {
        window.setTradingViewRightPanelOpen(!document.body.classList.contains('research-expanded'));
      } else {
        document.body.classList.toggle('research-expanded');
      }
      syncToolbarGeometry();
      return true;
    }
    if (action === 'top-tools') {
      document.body.classList.toggle('top-tools-collapsed');
      return true;
    }
    if (action === 'drawing-tools') {
      document.body.classList.add('drawing-tools-expanded');
      document.body.classList.remove('top-tools-collapsed');
      return true;
    }
    const escaped = String(action).replace(/"/g, '\\"');
    const target = document.querySelector(`[data-action="${escaped}"]`);
    if (target) {
      target.click();
      return true;
    }
    return false;
  }

  function focusDrawingInputs(item) {
    if (/level|horizontal|crossline|price label/i.test(item.label)) {
      const input = document.getElementById('levelPrice');
      if (input) input.focus();
    } else if (/zone|rectangle|channel|box/i.test(item.label)) {
      const input = document.getElementById('zoneLow');
      if (input) input.focus();
    } else if (/text|note|callout|icon|flag|snapshot/i.test(item.label)) {
      const input = document.getElementById('noteText');
      if (input) input.focus();
    } else if (/trend|ray|guide|pitchfork|gann|fib/i.test(item.label)) {
      const input = document.getElementById('guideStartPrice');
      if (input) input.focus();
    }
  }

  function setStatus(text) {
    const status = document.getElementById('chartToolStatus');
    if (!status) return;
    status.textContent = text;
    status.hidden = false;
    window.clearTimeout(setStatus.timer);
    setStatus.timer = window.setTimeout(() => {
      status.hidden = true;
    }, 2400);
  }

  function closeMenu() {
    const menu = document.getElementById('chartToolMenu');
    if (menu) menu.hidden = true;
    document.querySelectorAll('.chart-tool-button.active').forEach((button) => {
      button.classList.remove('active');
      button.setAttribute('aria-expanded', 'false');
    });
  }

  function positionMenuForButton(menu, button) {
    const center = document.querySelector('.center');
    if (!center) return;
    syncToolbarGeometry();
    const centerRect = center.getBoundingClientRect();
    const buttonRect = button.getBoundingClientRect();
    const menuHeight = Math.min(menu.scrollHeight || 720, Math.min(720, window.innerHeight - 72));
    const minTop = Math.max(8, centerRect.top + 8);
    const maxTop = Math.max(minTop, centerRect.bottom - menuHeight - 8);
    const desiredTop = buttonRect.top - 8;
    menu.style.top = `${Math.max(minTop, Math.min(desiredTop, maxTop))}px`;
  }

  function buildMenuItem(item, group, menu) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'chart-tool-menu-item';
    button.dataset.leftToolItem = item.label;
    button.innerHTML = `<span class="chart-tool-menu-icon">${item.icon}</span><span class="chart-tool-menu-label"></span><span class="chart-tool-menu-shortcut"></span><span class="chart-tool-menu-star">☆</span>`;
    button.querySelector('.chart-tool-menu-label').textContent = item.label;
    button.querySelector('.chart-tool-menu-shortcut').textContent = item.shortcut || '';
    button.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      document.querySelectorAll('.chart-tool-menu-item.active').forEach((active) => active.classList.remove('active'));
      button.classList.add('active');
      clickAction(item.action || group.action || 'drawing-tools');
      focusDrawingInputs(item);
      setStatus(item.message || `${item.label} selected.`);
      refreshChartSurface();
    });
    return button;
  }

  function showMenu(group, trigger) {
    const menu = document.getElementById('chartToolMenu');
    if (!menu) return;
    if (!menu.hidden && menu.dataset.activeGroup === group.id) {
      closeMenu();
      return;
    }
    document.querySelectorAll('.chart-tool-button.active').forEach((button) => button.classList.remove('active'));
    trigger.classList.add('active');
    menu.dataset.activeGroup = group.id;
    menu.innerHTML = '';
    const wrapper = document.createElement('div');
    wrapper.className = 'chart-tool-menu-group';
    const heading = document.createElement('div');
    heading.className = 'chart-tool-menu-heading';
    heading.textContent = group.label;
    wrapper.appendChild(heading);
    group.items.forEach((item) => wrapper.appendChild(buildMenuItem(item, group, menu)));
    menu.appendChild(wrapper);
    menu.hidden = false;
    positionMenuForButton(menu, trigger);
  }

  function createRailButton(group) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'chart-tool-button has-submenu';
    button.dataset.chartToolAction = group.id;
    button.setAttribute('aria-label', group.label);
    button.setAttribute('aria-haspopup', 'menu');
    button.setAttribute('aria-expanded', 'false');
    button.title = group.label;
    button.textContent = group.icon;
    button.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      const menu = document.getElementById('chartToolMenu');
      const willOpen = !menu || menu.hidden || menu.dataset.activeGroup !== group.id;
      showMenu(group, button);
      button.setAttribute('aria-expanded', String(willOpen));
    });
    return button;
  }

  function buildRail() {
    const center = document.querySelector('.center');
    if (!center) return;
    const existing = document.getElementById('chartToolRail');
    if (existing) existing.remove();
    const existingMenu = document.getElementById('chartToolMenu');
    if (existingMenu) existingMenu.remove();
    const existingStatus = document.getElementById('chartToolStatus');
    if (existingStatus) existingStatus.remove();

    const rail = document.createElement('nav');
    rail.id = 'chartToolRail';
    rail.className = 'chart-tool-rail';
    rail.setAttribute('aria-label', 'TradingView drawing toolbar');

    const primary = document.createElement('div');
    primary.className = 'chart-tool-rail-section';
    TOOL_GROUPS.slice(0, 7).forEach((group) => primary.appendChild(createRailButton(group)));
    const secondary = document.createElement('div');
    secondary.className = 'chart-tool-rail-section';
    TOOL_GROUPS.slice(7).forEach((group) => secondary.appendChild(createRailButton(group)));
    rail.append(primary, secondary);

    const menu = document.createElement('div');
    menu.id = 'chartToolMenu';
    menu.className = 'chart-tool-menu';
    menu.hidden = true;
    menu.setAttribute('role', 'menu');

    const status = document.createElement('div');
    status.id = 'chartToolStatus';
    status.className = 'chart-tool-status';
    status.hidden = true;

    document.body.append(rail, menu, status);
    document.body.classList.add('tradingview-left-toolbar-enhanced');
    syncToolbarGeometry();
    refreshChartSurface();
  }

  ready(() => {
    buildRail();
    installGeometryObservers();
    document.addEventListener('click', (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (target.closest('#chartToolRail') || target.closest('#chartToolMenu')) return;
      closeMenu();
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') closeMenu();
    });
  });
})();