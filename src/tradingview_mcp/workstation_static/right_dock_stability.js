(function installRightDockStability() {
  function refreshChartSurface() {
    const resize = window.resizePrimaryChartToSurface || window.scheduleChartSurfaceRefresh;
    if (typeof resize === 'function') {
      window.requestAnimationFrame(() => resize());
      window.setTimeout(() => resize(), 180);
    }
  }

  function setRightPanelOpen(open) {
    document.body.classList.toggle('research-expanded', Boolean(open));
    document.querySelectorAll('[data-chrome-toggle="research"], .tradingview-right-dock-button').forEach((button) => {
      button.setAttribute('aria-expanded', String(Boolean(open)));
    });
    refreshChartSurface();
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
})();
