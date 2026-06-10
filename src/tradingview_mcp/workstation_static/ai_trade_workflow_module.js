(function() {
  const ACTION_BUTTON_IDS = [
    'saveAiTradeIdeaButton',
    'backtestAiTradeIdeaButton',
    'applyTradeIdeaToPaperTicket',
  ];

  let workflowState = {
    reviewed: false,
    saved: false,
    backtested: false,
  };

  function setStatus(message) {
    const status = document.getElementById('aiTradeWorkflowStatus') || document.getElementById('aiTradeIdeaStatus');
    if (status) status.textContent = message;
  }

  function actionButtons() {
    return ACTION_BUTTON_IDS
      .map((id) => document.getElementById(id))
      .filter(Boolean);
  }

  function reviewChecksComplete() {
    const safety = document.getElementById('aiTradeReviewSafety');
    const invalidation = document.getElementById('aiTradeReviewInvalidation');
    const noLive = document.getElementById('aiTradeReviewNoLive');
    return !!(safety?.checked && invalidation?.checked && noLive?.checked);
  }

  function updateActionGate() {
    workflowState.reviewed = reviewChecksComplete();
    actionButtons().forEach((button) => {
      button.disabled = !workflowState.reviewed;
      button.setAttribute('aria-disabled', String(!workflowState.reviewed));
      button.title = workflowState.reviewed ? '' : 'Complete the AI trade review checklist first.';
    });
    if (!workflowState.reviewed) {
      setStatus('Review required before saving, backtesting, or pre-filling a paper ticket.');
    } else if (workflowState.backtested) {
      setStatus('Review complete and backtest attempted. Paper ticket can be prefilled for simulation only.');
    } else if (workflowState.saved) {
      setStatus('Review complete and idea saved. Backtest before simulated paper trading.');
    } else {
      setStatus('Review complete. Save the idea, then backtest before simulated paper trading.');
    }
  }

  function markActionProgress(event) {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    if (target.id === 'saveAiTradeIdeaButton') {
      window.setTimeout(() => {
        workflowState.saved = true;
        updateActionGate();
      }, 800);
    }
    if (target.id === 'backtestAiTradeIdeaButton') {
      window.setTimeout(() => {
        workflowState.backtested = true;
        updateActionGate();
      }, 800);
    }
    if (target.id === 'applyTradeIdeaToPaperTicket' && !workflowState.backtested) {
      setStatus('Paper ticket was prefilled for simulation only. Backtesting is still recommended before submitting a simulated order.');
    }
  }

  function addReviewPanel() {
    const card = document.querySelector('#aiTradeIdeaCard .ai-trade-card');
    if (!card || document.getElementById('aiTradeReviewPanel')) return;
    workflowState = { reviewed: false, saved: false, backtested: false };
    const panel = document.createElement('div');
    panel.id = 'aiTradeReviewPanel';
    panel.className = 'ai-trade-review-panel';
    panel.innerHTML = `
      <div class="label">AI trade review gate</div>
      <label><input id="aiTradeReviewSafety" type="checkbox" /> I understand this is research-only and not financial advice.</label>
      <label><input id="aiTradeReviewInvalidation" type="checkbox" /> I reviewed entry, invalidation, risks, and no-trade conditions.</label>
      <label><input id="aiTradeReviewNoLive" type="checkbox" /> I understand this workstation submits no live broker orders.</label>
      <div id="aiTradeWorkflowStatus" class="module-control-status">Review required before workflow actions.</div>
    `;
    const actions = card.querySelector('.ai-trade-actions');
    if (actions) card.insertBefore(panel, actions);
    else card.appendChild(panel);
    panel.querySelectorAll('input[type="checkbox"]').forEach((input) => {
      input.addEventListener('change', updateActionGate);
    });
    actionButtons().forEach((button) => button.addEventListener('click', markActionProgress));
    updateActionGate();
  }

  function patchTradeIdeaRenderer() {
    if (window.__aiTradeWorkflowRendererPatched) return true;
    if (typeof window.renderTradeIdeaCard !== 'function') return false;
    const original = window.renderTradeIdeaCard;
    window.renderTradeIdeaCard = function patchedRenderTradeIdeaCard(...args) {
      const result = original.apply(this, args);
      window.setTimeout(addReviewPanel, 0);
      return result;
    };
    window.__aiTradeWorkflowRendererPatched = true;
    return true;
  }

  function addStyles() {
    if (document.getElementById('aiTradeWorkflowStyles')) return;
    const style = document.createElement('style');
    style.id = 'aiTradeWorkflowStyles';
    style.textContent = '.ai-trade-review-panel{border:1px solid #475569;border-radius:9px;background:#080d18;padding:8px;display:grid;gap:6px;font-size:12px}.ai-trade-review-panel label{display:flex;gap:7px;align-items:flex-start;line-height:1.35;color:#cbd5e1}.ai-trade-review-panel input{margin-top:2px}.ai-trade-actions button:disabled{opacity:.45;cursor:not-allowed}';
    document.head.appendChild(style);
  }

  function bootAiTradeWorkflowModule() {
    addStyles();
    if (!patchTradeIdeaRenderer()) {
      let attempts = 0;
      const timer = window.setInterval(() => {
        attempts += 1;
        if (patchTradeIdeaRenderer() || attempts > 40) window.clearInterval(timer);
      }, 100);
    }
    addReviewPanel();
  }

  window.addAiTradeReviewPanel = addReviewPanel;
  if (window.workstationBoot) window.workstationBoot.register('ai-trade-workflow', bootAiTradeWorkflowModule);
  else if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bootAiTradeWorkflowModule);
  else bootAiTradeWorkflowModule();
})();
