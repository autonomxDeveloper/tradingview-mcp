(function installRightDockStability() {
  function installLayeringStylesheet() {
    if (document.getElementById('rightDockLayeringStylesheet')) return;
    const link = document.createElement('link');
    link.id = 'rightDockLayeringStylesheet';
    link.rel = 'stylesheet';
    link.href = '/static/right_dock_layering.css';
    document.head.appendChild(link);
  }

  function installLeftToolbarEnhancement() {
    if (!document.getElementById('tradingViewLeftToolsStylesheet')) {
      const link = document.createElement('link');
      link.id = 'tradingViewLeftToolsStylesheet';
      link.rel = 'stylesheet';
      link.href = '/static/tradingview_left_tools.css';
      document.head.appendChild(link);
    }
    if (document.getElementById('tradingViewLeftToolsScript')) return;
    const script = document.createElement('script');
    script.id = 'tradingViewLeftToolsScript';
    script.src = '/static/tradingview_left_tools.js';
    script.defer = true;
    document.body.appendChild(script);
  }

  function installAiWorkflowDock() {
    if (document.getElementById('tradingViewAiWorkflowDockScript')) return;
    const script = document.createElement('script');
    script.id = 'tradingViewAiWorkflowDockScript';
    script.src = '/static/ai_workflow_dock.js';
    script.defer = true;
    document.body.appendChild(script);
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

  function clearActiveDockButtons() {
    document.querySelectorAll('.tradingview-right-dock-button.active').forEach((active) => active.classList.remove('active'));
  }

  function stopLegacySidebarToggle(event) {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
  }

  function isInteractiveResearchControl(target) {
    return Boolean(target.closest('button, input, textarea, select, option, label, [data-action], [data-result-pane-target], a[href]'));
  }

  function selectRightDockSection(section, dockButton) {
    if (section && typeof window.selectTradingViewRightDockSection === 'function') {
      window.selectTradingViewRightDockSection(section, dockButton || null);
      return true;
    }
    if (dockButton) setActiveDockButton(dockButton);
    return false;
  }

  function handleIndependentSidebarToggle(target, event) {
    const chartTool = target.closest('.chart-tool-button');
    const chartAction = chartTool && chartTool.dataset.chartToolAction;
    const chromeToggle = target.closest('[data-chrome-toggle]');
    const chromeAction = chromeToggle && chromeToggle.dataset.chromeToggle;

    if (chartAction === 'watchlist' || chromeAction === 'watchlist') {
      stopLegacySidebarToggle(event);
      toggleWatchlistPanel();
      return true;
    }

    if (!target.closest('.tradingview-right-dock-button') && (chartAction === 'research' || chromeAction === 'research')) {
      stopLegacySidebarToggle(event);
      if (!document.body.classList.contains('research-expanded')) {
        selectRightDockSection(document.body.dataset.rightDockSection || 'research');
      }
      toggleRightPanel();
      return true;
    }

    return false;
  }

  function handleRightDockButton(target, event) {
    const dockButton = target.closest('.tradingview-right-dock-button');
    if (!dockButton) return false;
    const section = dockButton.dataset.rightDockSection || dockButton.dataset.rightDockPanel || '';
    const currentSection = document.body.dataset.rightDockSection || 'alerts';
    const wasOpen = document.body.classList.contains('research-expanded');
    stopLegacySidebarToggle(event);

    if (wasOpen && section && section === currentSection) {
      setRightPanelOpen(false);
      clearActiveDockButtons();
      return true;
    }

    setRightPanelOpen(true);
    selectRightDockSection(section || currentSection, dockButton);
    activateDataAction(dockButton.dataset.rightDockAction || '');
    return true;
  }

  function handlePanelSurfaceClick(target, event) {
    const rightPanel = target.closest('.right.tradingview-right-panel');
    if (!rightPanel) return false;

    if (target.closest('.tradingview-alerts-panel') || target.closest('.tradingview-research-stack') || target.closest('.tradingview-ai-workflow-pane')) {
      if (isInteractiveResearchControl(target)) return false;
      event.stopPropagation();
      return true;
    }

    if (document.body.classList.contains('side-panels-collapsed')) {
      stopLegacySidebarToggle(event);
      setRightPanelOpen(true);
      selectRightDockSection(document.body.dataset.rightDockSection || 'research');
      return true;
    }

    return false;
  }

  function handleSidebarPointerIntent(event) {
    const target = event.target;
    if (!(target instanceof Element)) return;
    if (target.closest('.tradingview-alerts-panel') || target.closest('.tradingview-research-stack') || target.closest('.tradingview-ai-workflow-pane')) return;
    if (target.closest('.tradingview-right-dock-button')) {
      event.stopPropagation();
      event.stopImmediatePropagation();
      return;
    }
    const chromeToggle = target.closest('[data-chrome-toggle]');
    const chartTool = target.closest('.chart-tool-button');
    const action = (chromeToggle && chromeToggle.dataset.chromeToggle) || (chartTool && chartTool.dataset.chartToolAction) || '';
    if (action === 'watchlist' || action === 'research') {
      event.stopPropagation();
      event.stopImmediatePropagation();
    }
  }

  function handleSidebarClick(event) {
    const target = event.target;
    if (!(target instanceof Element)) return;
    if (handleRightDockButton(target, event)) return;
    if (handleIndependentSidebarToggle(target, event)) return;
    handlePanelSurfaceClick(target, event);
  }

  installLayeringStylesheet();
  installLeftToolbarEnhancement();
  installAiWorkflowDock();

  document.addEventListener('pointerdown', handleSidebarPointerIntent, true);
  document.addEventListener('mousedown', handleSidebarPointerIntent, true);
  document.addEventListener('click', handleSidebarClick, true);

  window.setTradingViewRightPanelOpen = setRightPanelOpen;
  window.setTradingViewWatchlistPanelOpen = setWatchlistPanelOpen;
  window.installRightDockLayeringStylesheet = installLayeringStylesheet;
  window.installTradingViewLeftToolbarEnhancement = installLeftToolbarEnhancement;
  window.installTradingViewAiWorkflowDock = installAiWorkflowDock;
})();