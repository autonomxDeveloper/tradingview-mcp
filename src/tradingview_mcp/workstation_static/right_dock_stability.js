(function installRightDockStability() {
  function installLayeringStylesheet() {
    if (document.getElementById('rightDockLayeringStylesheet')) return;
    const link = document.createElement('link');
    link.id = 'rightDockLayeringStylesheet';
    link.rel = 'stylesheet';
    link.href = '/static/right_dock_layering.css';
    document.head.appendChild(link);
  }

  function refreshChartSurface() {
    const resize = window.resizePrimaryChartToSurface || window.scheduleChartSurfaceRefresh;
    if (typeof resize === 'function') {
      window.requestAnimationFrame(() => resize());
      window.setTimeout(() => resize(), 180);
    }
  }

  function syncChromeLabels() {
    if (typeof window.updateWorkstationChromeLabels === 'function') {
      window.updateWorkstationChromeLabels();
      return;
    }
    document.querySelectorAll('[data-chrome-toggle="watchlist"]').forEach((button) => {
      const expanded = document.body.classList.contains('watchlist-expanded');
      button.setAttribute('aria-expanded', String(expanded));
    });
    document.querySelectorAll('[data-chrome-toggle="research"], .tradingview-right-dock-button').forEach((button) => {
      const expanded = document.body.classList.contains('research-expanded');
      button.setAttribute('aria-expanded', String(expanded));
    });
  }

  function setWatchlistPanelOpen(open) {
    const preserveRightPanel = document.body.classList.contains('research-expanded');
    document.body.classList.toggle('watchlist-expanded', Boolean(open));
    document.body.classList.toggle('research-expanded', preserveRightPanel);
    document.querySelectorAll('[data-chrome-toggle="watchlist"]').forEach((button) => {
      button.setAttribute('aria-expanded', String(Boolean(open)));
    });
    syncChromeLabels();
    refreshChartSurface();
  }

  function setRightPanelOpen(open) {
    const preserveWatchlistPanel = document.body.classList.contains('watchlist-expanded');
    document.body.classList.toggle('research-expanded', Boolean(open));
    document.body.classList.toggle('watchlist-expanded', preserveWatchlistPanel);
    document.querySelectorAll('[data-chrome-toggle="research"], .tradingview-right-dock-button').forEach((button) => {
      button.setAttribute('aria-expanded', String(Boolean(open)));
    });
    syncChromeLabels();
    refreshChartSurface();
  }

  function toggleWatchlistPanel() {
    setWatchlistPanelOpen(!document.body.classList.contains('watchlist-expanded'));
  }

  function toggleRightPanel() {
    setRightPanelOpen(!document.body.classList.contains('research-expanded'));
  }

  function activateDataAction(action) {
    if (!action) return false;
    const escaped = String(action).replace(/"/g, '\\"');
    const target = document.querySelector(`[data-action="${escaped}"]`);
    if (!target) return false;
    target.click();
    return true;
  }

  function setActiveDockButton(button) {
    document.querySelectorAll('.tradingview-right-dock-button.active').forEach((active) => active.classList.remove('active'));
    button.classList.add('active');
  }

  function handleIndependentSidebarToggle(target, event) {
    const chartTool = target.closest('.chart-tool-button');
    const chartAction = chartTool && chartTool.dataset.chartToolAction;
    const chromeToggle = target.closest('[data-chrome-toggle]');
    const chromeAction = chromeToggle && chromeToggle.dataset.chromeToggle;

    if (chartAction === 'watchlist' || chromeAction === 'watchlist') {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      toggleWatchlistPanel();
      return true;
    }

    if (!target.closest('.tradingview-right-dock-button') && (chartAction === 'research' || chromeAction === 'research')) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      toggleRightPanel();
      return true;
    }

    return false;
  }

  installLayeringStylesheet();

  document.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;

    const dockButton = target.closest('.tradingview-right-dock-button');
    if (dockButton) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      setRightPanelOpen(true);
      setActiveDockButton(dockButton);
      activateDataAction(dockButton.dataset.rightDockAction || '');
      return;
    }

    if (handleIndependentSidebarToggle(target, event)) return;

    const rightPanel = target.closest('.right.tradingview-right-panel');
    if (!rightPanel) return;

    if (target.closest('.tradingview-alerts-panel') || target.closest('.tradingview-research-stack')) {
      event.stopPropagation();
      return;
    }

    if (document.body.classList.contains('side-panels-collapsed')) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      setRightPanelOpen(true);
    }
  }, true);

  window.setTradingViewRightPanelOpen = setRightPanelOpen;
  window.setTradingViewWatchlistPanelOpen = setWatchlistPanelOpen;
  window.installRightDockLayeringStylesheet = installLayeringStylesheet;
})();
