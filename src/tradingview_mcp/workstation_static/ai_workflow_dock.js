(function installAiWorkflowDockSection() {
  const RETRY_LIMIT = 24;

  function ready(fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn, { once: true });
    else fn();
  }

  function installStyles() {
    if (document.getElementById('tradingViewAiWorkflowDockStyles')) return;
    const style = document.createElement('style');
    style.id = 'tradingViewAiWorkflowDockStyles';
    style.textContent = `
      .right.tradingview-right-panel .tradingview-dock-section {
        grid-column: 1;
        grid-row: 1;
        min-width: 0;
        min-height: 0;
      }

      body.side-panels-collapsed.research-expanded .right.tradingview-right-panel .tradingview-dock-section {
        display: none !important;
      }

      body.side-panels-collapsed.research-expanded .right.tradingview-right-panel .tradingview-dock-section.active-dock-section {
        display: block !important;
      }

      .right.tradingview-right-panel .tradingview-ai-workflow-pane {
        height: 100%;
        overflow: auto;
        box-sizing: border-box;
        padding: 10px;
        background: #f5f7fb;
        border-right: 1px solid #e0e3eb;
      }

      .right.tradingview-right-panel .tradingview-ai-workflow-pane .workflow-panel {
        min-height: calc(100vh - 78px);
        box-sizing: border-box;
        margin: 0;
        border: 1px solid #d7dce5;
        border-radius: 12px;
        background: #fff !important;
        color: #131722;
      }

      .right.tradingview-right-panel .tradingview-ai-workflow-pane .workflow-panel .label {
        color: #5d6676;
      }

      .right.tradingview-right-panel .tradingview-ai-workflow-pane .workflow-list {
        gap: 10px;
      }

      .right.tradingview-right-panel .tradingview-ai-workflow-pane .workflow-list button,
      .right.tradingview-right-panel .tradingview-ai-workflow-pane .tabs button {
        min-height: 36px;
        border-color: #d7dce5;
        background: #fff;
        color: #131722;
        box-shadow: inset 0 0 0 1px #edf0f6;
      }

      .right.tradingview-right-panel .tradingview-ai-workflow-pane .workflow-list button:hover,
      .right.tradingview-right-panel .tradingview-ai-workflow-pane .tabs button:hover {
        background: #eef4ff;
        border-color: #b9cdfb;
      }

      .right.tradingview-right-panel .tradingview-research-stack {
        height: 100%;
        max-height: none !important;
        overflow: auto;
        box-sizing: border-box;
      }

      .tradingview-right-dock-button[data-right-dock-section="workflow"] {
        font-size: 18px;
      }
    `;
    document.head.appendChild(style);
  }

  function ensureWorkflowDockButton(dock) {
    let button = dock.querySelector('[data-right-dock-section="workflow"]');
    if (button) return button;

    button = document.createElement('button');
    button.type = 'button';
    button.className = 'tradingview-right-dock-button';
    button.dataset.rightDockSection = 'workflow';
    button.setAttribute('aria-label', 'AI workflow');
    button.title = 'AI workflow';
    button.textContent = 'AI';

    const reference = dock.querySelector('.tradingview-right-dock-button:nth-child(3)');
    if (reference) dock.insertBefore(button, reference);
    else dock.appendChild(button);
    return button;
  }

  function sectionForDockButton(button, index) {
    if (button.dataset.rightDockSection) return button.dataset.rightDockSection;
    if (button.dataset.rightDockPanel) return button.dataset.rightDockPanel;
    if (button.dataset.rightDockAction) return 'research';
    if (index <= 1 || button.dataset.chromeToggle === 'research') return 'alerts';
    return 'research';
  }

  function markDockButtons(dock) {
    Array.from(dock.querySelectorAll('.tradingview-right-dock-button')).forEach((button, index) => {
      button.dataset.rightDockSection = sectionForDockButton(button, index);
    });
  }

  function ensureDockSections(right) {
    const alerts = right.querySelector('.tradingview-alerts-panel');
    const stack = right.querySelector('.tradingview-research-stack');
    const workflow = stack && stack.querySelector('.workflow-panel');
    if (!alerts || !stack || !workflow) return false;

    alerts.classList.add('tradingview-dock-section');
    alerts.dataset.rightDockSection = 'alerts';

    stack.classList.add('tradingview-dock-section');
    stack.dataset.rightDockSection = 'research';

    let workflowPane = right.querySelector('.tradingview-ai-workflow-pane');
    if (!workflowPane) {
      workflowPane = document.createElement('div');
      workflowPane.className = 'tradingview-ai-workflow-pane tradingview-dock-section';
      workflowPane.dataset.rightDockSection = 'workflow';
      workflowPane.setAttribute('aria-label', 'AI workflow');
      workflowPane.appendChild(workflow);
      right.insertBefore(workflowPane, stack);
    }

    return true;
  }

  function setActiveDockButton(section, explicitButton) {
    document.querySelectorAll('.tradingview-right-dock-button.active').forEach((button) => {
      button.classList.remove('active');
    });

    const button = explicitButton || document.querySelector(`.tradingview-right-dock-button[data-right-dock-section="${section}"]`);
    if (button) button.classList.add('active');
  }

  function selectDockSection(section, explicitButton) {
    const normalized = section || 'research';
    const right = document.querySelector('.right.tradingview-right-panel');
    if (!right) return false;

    right.querySelectorAll('.tradingview-dock-section').forEach((pane) => {
      pane.classList.toggle('active-dock-section', pane.dataset.rightDockSection === normalized);
    });
    document.body.dataset.rightDockSection = normalized;
    setActiveDockButton(normalized, explicitButton || null);
    return true;
  }

  function install(attempt) {
    const right = document.querySelector('.right.tradingview-right-panel');
    const dock = right && right.querySelector('.tradingview-right-dock');
    if (!right || !dock || !ensureDockSections(right)) {
      if (attempt < RETRY_LIMIT) window.setTimeout(() => install(attempt + 1), 50);
      return;
    }

    installStyles();
    ensureWorkflowDockButton(dock);
    markDockButtons(dock);
    window.selectTradingViewRightDockSection = selectDockSection;
    selectDockSection(document.body.dataset.rightDockSection || 'alerts');
  }

  ready(() => install(0));
})();
