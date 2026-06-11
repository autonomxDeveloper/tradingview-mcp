(function() {
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

  function bindChromeControls() {
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

  window.toggleTopTools = toggleTopTools;
  window.toggleWorkstationPanel = togglePanel;

  ready(bindChromeControls);
})();
