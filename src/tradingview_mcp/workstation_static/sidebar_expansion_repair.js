(function() {
  if (window.sidebarExpansionRepairInstalled) return;
  window.sidebarExpansionRepairInstalled = true;

  function installStyle() {
    if (document.getElementById('sidebarExpansionRepairStyles')) return;
    const style = document.createElement('style');
    style.id = 'sidebarExpansionRepairStyles';
    style.textContent = `
      :root {
        --sidebar-slide-duration: 680ms;
        --sidebar-slide-content-duration: 460ms;
        --sidebar-slide-ease: cubic-bezier(.16, 1, .3, 1);
      }

      body.tradingview-chart-first main,
      body.tradingview-chart-first aside,
      body.tradingview-chart-first .right,
      body.tradingview-chart-first .right.tradingview-right-panel {
        transition:
          grid-template-columns var(--sidebar-slide-duration) var(--sidebar-slide-ease),
          width var(--sidebar-slide-duration) var(--sidebar-slide-ease),
          min-width var(--sidebar-slide-duration) var(--sidebar-slide-ease),
          max-width var(--sidebar-slide-duration) var(--sidebar-slide-ease),
          padding var(--sidebar-slide-duration) var(--sidebar-slide-ease),
          background-color 360ms ease,
          box-shadow 360ms ease !important;
        will-change: grid-template-columns, width, min-width, max-width;
      }

      body.tradingview-chart-first aside,
      body.tradingview-chart-first .right,
      body.tradingview-chart-first .right.tradingview-right-panel {
        transform: translateZ(0);
        backface-visibility: hidden;
      }

      body.tradingview-chart-first aside > *,
      body.tradingview-chart-first .right.tradingview-right-panel > .tradingview-alerts-panel,
      body.tradingview-chart-first .right.tradingview-right-panel > .tradingview-research-stack,
      body.tradingview-chart-first .right.tradingview-right-panel .panel,
      body.tradingview-chart-first .right.tradingview-right-panel .workflow-panel {
        transition:
          opacity var(--sidebar-slide-content-duration) ease,
          visibility var(--sidebar-slide-content-duration) ease,
          transform var(--sidebar-slide-duration) var(--sidebar-slide-ease) !important;
        will-change: opacity, transform;
      }

      body.tradingview-chart-first.side-panels-collapsed:not(.watchlist-expanded) aside > *:not(.tv-left-toolbar):not(.tradingview-left-toolbar) {
        opacity: 0 !important;
        visibility: hidden !important;
        pointer-events: none !important;
        transform: translateX(-18px) scale(.985) !important;
      }

      body.tradingview-chart-first.side-panels-collapsed:not(.research-expanded) .right.tradingview-right-panel > .tradingview-alerts-panel,
      body.tradingview-chart-first.side-panels-collapsed:not(.research-expanded) .right.tradingview-right-panel > .tradingview-research-stack {
        opacity: 0 !important;
        visibility: hidden !important;
        pointer-events: none !important;
        transform: translateX(22px) scale(.985) !important;
      }

      body.tradingview-chart-first.side-panels-collapsed.watchlist-expanded main {
        grid-template-columns: minmax(280px, 320px) minmax(0, 1fr) 64px !important;
      }

      body.tradingview-chart-first.side-panels-collapsed.research-expanded main {
        grid-template-columns: 64px minmax(0, 1fr) minmax(420px, 460px) !important;
      }

      body.tradingview-chart-first.side-panels-collapsed.watchlist-expanded.research-expanded main {
        grid-template-columns: minmax(280px, 320px) minmax(0, 1fr) minmax(420px, 460px) !important;
      }

      body.tradingview-chart-first.side-panels-collapsed.watchlist-expanded aside {
        width: 320px !important;
        min-width: 280px !important;
        max-width: 320px !important;
        overflow: auto !important;
        padding: 12px !important;
        cursor: default !important;
        contain: none !important;
      }

      body.tradingview-chart-first.side-panels-collapsed.research-expanded .right,
      body.tradingview-chart-first.side-panels-collapsed.research-expanded .right.tradingview-right-panel {
        width: 460px !important;
        min-width: 420px !important;
        max-width: 460px !important;
        overflow: hidden !important;
        padding: 0 !important;
        contain: none !important;
        cursor: default !important;
        display: grid !important;
        grid-template-columns: minmax(0, 1fr) 54px !important;
        grid-template-rows: auto minmax(0, 1fr) !important;
        align-items: stretch !important;
        background: rgba(8, 13, 24, .96) !important;
      }

      body.tradingview-chart-first.side-panels-collapsed.watchlist-expanded aside::before,
      body.tradingview-chart-first.side-panels-collapsed.research-expanded .right::before {
        display: none !important;
        content: none !important;
      }

      body.tradingview-chart-first.side-panels-collapsed.watchlist-expanded aside > * {
        display: block !important;
        opacity: 1 !important;
        visibility: visible !important;
        pointer-events: auto !important;
        transform: translateX(0) scale(1) !important;
      }

      body.tradingview-chart-first.side-panels-collapsed.research-expanded .right.tradingview-right-panel > .tradingview-right-dock {
        display: flex !important;
        grid-column: 2 !important;
        grid-row: 1 / span 2 !important;
        width: 54px !important;
        min-width: 54px !important;
        height: 100% !important;
        opacity: 1 !important;
        visibility: visible !important;
        pointer-events: auto !important;
        background: rgba(255, 255, 255, .06) !important;
        border-left: 1px solid rgba(148, 163, 184, .22) !important;
      }

      body.tradingview-chart-first.side-panels-collapsed.research-expanded .right.tradingview-right-panel > .tradingview-alerts-panel {
        display: block !important;
        grid-column: 1 !important;
        grid-row: 1 !important;
        min-width: 0 !important;
        max-height: 220px !important;
        overflow: auto !important;
        opacity: 1 !important;
        visibility: visible !important;
        pointer-events: auto !important;
        transform: translateX(0) scale(1) !important;
        background: rgba(15, 23, 42, .92) !important;
        border-right: 0 !important;
        border-bottom: 1px solid rgba(148, 163, 184, .22) !important;
      }

      body.tradingview-chart-first.side-panels-collapsed.research-expanded .right.tradingview-right-panel > .tradingview-research-stack {
        display: block !important;
        grid-column: 1 !important;
        grid-row: 2 !important;
        min-width: 0 !important;
        min-height: 0 !important;
        max-height: none !important;
        height: auto !important;
        overflow: auto !important;
        padding: 12px !important;
        opacity: 1 !important;
        visibility: visible !important;
        pointer-events: auto !important;
        transform: translateX(0) scale(1) !important;
        background: rgba(8, 13, 24, .96) !important;
      }

      body.tradingview-chart-first.side-panels-collapsed.research-expanded .right.tradingview-right-panel .panel,
      body.tradingview-chart-first.side-panels-collapsed.research-expanded .right.tradingview-right-panel .workflow-panel,
      body.tradingview-chart-first.side-panels-collapsed.research-expanded .right.tradingview-right-panel textarea,
      body.tradingview-chart-first.side-panels-collapsed.research-expanded .right.tradingview-right-panel input,
      body.tradingview-chart-first.side-panels-collapsed.research-expanded .right.tradingview-right-panel select,
      body.tradingview-chart-first.side-panels-collapsed.research-expanded .right.tradingview-right-panel button,
      body.tradingview-chart-first.side-panels-collapsed.research-expanded .right.tradingview-right-panel pre {
        max-width: 100% !important;
        opacity: 1 !important;
        visibility: visible !important;
        pointer-events: auto !important;
      }

      body.tradingview-chart-first.side-panels-collapsed.research-expanded .right.tradingview-right-panel .tradingview-alert-title,
      body.tradingview-chart-first.side-panels-collapsed.research-expanded .right.tradingview-right-panel .tradingview-alert-meta {
        color: #e5e7eb !important;
      }

      body.tradingview-chart-first.side-panels-collapsed:not(.research-expanded) .right.tradingview-right-panel > .tradingview-alerts-panel,
      body.tradingview-chart-first.side-panels-collapsed:not(.research-expanded) .right.tradingview-right-panel > .tradingview-research-stack {
        display: block !important;
      }

      @media (prefers-reduced-motion: reduce) {
        body.tradingview-chart-first main,
        body.tradingview-chart-first aside,
        body.tradingview-chart-first .right,
        body.tradingview-chart-first .right.tradingview-right-panel,
        body.tradingview-chart-first aside > *,
        body.tradingview-chart-first .right.tradingview-right-panel > .tradingview-alerts-panel,
        body.tradingview-chart-first .right.tradingview-right-panel > .tradingview-research-stack,
        body.tradingview-chart-first .right.tradingview-right-panel .panel,
        body.tradingview-chart-first .right.tradingview-right-panel .workflow-panel {
          transition: none !important;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function refreshChartSurface() {
    const resize = window.resizePrimaryChartToSurface || window.scheduleChartSurfaceRefresh;
    if (typeof resize === 'function') {
      window.requestAnimationFrame(() => resize());
      window.setTimeout(() => resize(), 120);
      window.setTimeout(() => resize(), 280);
      window.setTimeout(() => resize(), 520);
      window.setTimeout(() => resize(), 760);
    }
  }

  function applyGeometry() {
    installStyle();
    const main = document.querySelector('main');
    const left = document.querySelector('aside');
    const right = document.querySelector('.right');
    const watch = document.body.classList.contains('watchlist-expanded');
    const research = document.body.classList.contains('research-expanded');

    if (main) {
      if (watch && research) main.style.gridTemplateColumns = 'minmax(280px, 320px) minmax(0, 1fr) minmax(420px, 460px)';
      else if (watch) main.style.gridTemplateColumns = 'minmax(280px, 320px) minmax(0, 1fr) 64px';
      else if (research) main.style.gridTemplateColumns = '64px minmax(0, 1fr) minmax(420px, 460px)';
      else main.style.gridTemplateColumns = '64px minmax(0, 1fr) 64px';
    }

    if (left) {
      if (watch) {
        left.style.width = '320px';
        left.style.minWidth = '280px';
        left.style.maxWidth = '320px';
        left.style.overflow = 'auto';
        left.style.padding = '12px';
      } else {
        left.style.width = '64px';
        left.style.minWidth = '64px';
        left.style.maxWidth = '64px';
        left.style.overflow = 'hidden';
        left.style.padding = '';
      }
    }

    if (right) {
      if (research) {
        right.style.width = '460px';
        right.style.minWidth = '420px';
        right.style.maxWidth = '460px';
        right.style.display = 'grid';
        right.style.gridTemplateColumns = 'minmax(0, 1fr) 54px';
        right.style.gridTemplateRows = 'auto minmax(0, 1fr)';
        right.style.overflow = 'hidden';
        right.style.padding = '0';
        right.querySelectorAll('.tradingview-alerts-panel,.tradingview-research-stack,.tradingview-right-dock').forEach((element) => {
          element.style.opacity = '1';
          element.style.visibility = 'visible';
          element.style.pointerEvents = 'auto';
        });
      } else {
        right.style.width = '64px';
        right.style.minWidth = '64px';
        right.style.maxWidth = '64px';
        right.style.overflow = 'hidden';
        right.style.padding = '';
      }
    }

    refreshChartSurface();
  }

  function bindRepairClicks() {
    if (window.sidebarExpansionRepairClicksBound) return;
    window.sidebarExpansionRepairClicksBound = true;
    document.addEventListener('click', (event) => {
      const target = event.target instanceof Element ? event.target : null;
      if (!target) return;
      if (target.closest('[data-chrome-toggle]') || target.closest('.tradingview-right-dock-button') || target.closest('.chart-tool-button')) {
        window.setTimeout(applyGeometry, 0);
        window.setTimeout(applyGeometry, 140);
        window.setTimeout(applyGeometry, 320);
        window.setTimeout(applyGeometry, 700);
      }
    }, true);
  }

  function boot() {
    installStyle();
    bindRepairClicks();
    applyGeometry();
    const observer = new MutationObserver(applyGeometry);
    observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
