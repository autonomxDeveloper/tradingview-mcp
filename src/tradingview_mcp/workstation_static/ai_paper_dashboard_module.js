(function() {
  const SECTIONS = [
    { key: 'decision', label: 'Decision', panelId: 'aiPaperTraderPanel', statusId: 'aiPaperTraderStatus', stateName: 'aiPaperTraderState' },
    { key: 'schedules', label: 'Schedules', panelId: 'aiPaperSchedulePanel', statusId: 'aiPaperScheduleStatus', stateName: 'aiPaperScheduleState' },
    { key: 'lifecycle', label: 'Lifecycle', panelId: 'aiPaperLifecyclePanel', statusId: 'aiPaperLifecycleStatus', stateName: 'aiPaperLifecycleState' },
    { key: 'replay', label: 'Replay', panelId: 'aiPaperReplayPanel', statusId: 'aiPaperReplayStatus', stateName: 'aiPaperReplayState' },
    { key: 'history', label: 'History', panelId: 'aiPaperHistoryPanel', statusId: 'aiPaperHistoryStatus', stateName: 'aiPaperHistoryState' },
    { key: 'performance', label: 'Performance', panelId: 'aiPaperPerformancePanel', statusId: 'aiPaperPerformanceStatus', stateName: 'aiPaperPerformanceState' },
    { key: 'reviewPacket', label: 'Review packet', panelId: 'aiPaperReviewPacketPanel', statusId: 'aiPaperReviewPacketStatus', stateName: 'aiPaperReviewPacketState' },
    { key: 'auditExport', label: 'Audit export', panelId: 'aiPaperAuditExportPanel', statusId: 'aiPaperAuditExportStatus', stateName: 'aiPaperAuditExportState' },
  ];

  function $(id) {
    return document.getElementById(id);
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function textOf(value, fallback = '-') {
    if (value === null || value === undefined || value === '') return fallback;
    if (Array.isArray(value)) return value.length ? value.join(', ') : fallback;
    if (typeof value === 'object') return JSON.stringify(value, null, 2);
    return String(value);
  }

  function statusText(section) {
    const status = $(section.statusId);
    if (status && status.textContent.trim()) return status.textContent.trim();
    const panel = $(section.panelId);
    if (!panel) return 'not loaded yet';
    const state = window[section.stateName];
    if (!state) return 'panel ready';
    if (section.key === 'schedules') return `${(state.schedules || []).length} schedule(s)`;
    if (section.key === 'decision') return state.lastDecisionResponse ? 'decision available' : 'awaiting decision';
    if (section.key === 'auditExport') return state.lastExport ? 'export ready' : 'awaiting export';
    return 'panel ready';
  }

  function renderDashboard() {
    const target = $('aiPaperDashboardCards');
    if (!target) return;
    target.innerHTML = SECTIONS.map((section) => {
      const loaded = !!$(section.panelId);
      return `
        <button type="button" class="secondary ai-paper-dashboard-card" data-action="aiPaperDashboard.focus" data-action-arg="${escapeHtml(section.panelId)}">
          <span class="ai-paper-dashboard-label">${escapeHtml(section.label)}</span>
          <span class="ai-paper-dashboard-state">${loaded ? 'loaded' : 'pending'}</span>
          <small>${escapeHtml(statusText(section)).slice(0, 140)}</small>
        </button>`;
    }).join('');
    if (typeof window.bindWorkstationActions === 'function') window.bindWorkstationActions(target);
  }

  function setDashboardStatus(message) {
    const target = $('aiPaperDashboardStatus');
    if (target) target.textContent = message;
  }

  function refreshAiPaperDashboard() {
    renderDashboard();
    setDashboardStatus('AI paper dashboard refreshed. paper_only: true · live_execution: false · execution_submitted: false · read_only: true.');
    return {
      paper_only: true,
      live_execution: false,
      execution_submitted: false,
      background_loop_enabled: false,
      read_only: true,
      sections: SECTIONS.map((section) => ({
        key: section.key,
        panel_id: section.panelId,
        loaded: !!$(section.panelId),
        status: statusText(section),
      })),
    };
  }

  function focusAiPaperDashboardPanel(panelId) {
    const target = $(panelId);
    if (!target) {
      setDashboardStatus(`Panel ${panelId || 'unknown'} is not loaded yet.`);
      renderDashboard();
      return null;
    }
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    target.setAttribute('tabindex', '-1');
    target.focus({ preventScroll: true });
    target.classList.add('ai-paper-dashboard-focus');
    window.setTimeout(() => target.classList.remove('ai-paper-dashboard-focus'), 1800);
    setDashboardStatus(`Focused ${panelId}. Read-only navigation only; no paper mutation or live execution.`);
    renderDashboard();
    return target;
  }

  function ensureDashboardStyles() {
    if ($('aiPaperDashboardStyles')) return;
    const style = document.createElement('style');
    style.id = 'aiPaperDashboardStyles';
    style.textContent = `
      .ai-paper-dashboard-panel { border: 1px solid rgba(148, 163, 184, 0.35); border-radius: 12px; padding: 12px; margin: 12px 0; }
      .ai-paper-dashboard-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(145px, 1fr)); gap: 8px; margin-top: 8px; }
      .ai-paper-dashboard-card { text-align: left; min-height: 76px; display: flex; flex-direction: column; gap: 4px; justify-content: flex-start; }
      .ai-paper-dashboard-label { font-weight: 700; }
      .ai-paper-dashboard-state { font-size: 12px; text-transform: uppercase; opacity: 0.8; }
      .ai-paper-dashboard-card small { opacity: 0.75; line-height: 1.25; }
      .ai-paper-dashboard-focus { outline: 2px solid currentColor; outline-offset: 3px; }
    `;
    document.head.appendChild(style);
  }

  function ensurePanel() {
    if ($('aiPaperDashboardPanel')) return;
    const paperStatus = $('paperTradingStatus');
    const traderPanel = $('aiPaperTraderPanel');
    const anchor = traderPanel || paperStatus;
    if (!anchor || !anchor.parentElement) return;
    ensureDashboardStyles();
    const panel = document.createElement('div');
    panel.id = 'aiPaperDashboardPanel';
    panel.className = 'ai-paper-dashboard-panel';
    panel.innerHTML = `
      <div class="label">AI paper dashboard</div>
      <p class="paper-trading-warning">Compact read-only navigation for simulated AI paper workflows: decision, schedules, lifecycle, replay, history, performance, review packet, and audit export. It does not call LLMs, submit simulated orders, mutate paper state, write server files, start background loops, or contact live broker endpoints.</p>
      <div class="ai-trade-actions">
        <button type="button" class="secondary" data-action="aiPaperDashboard.refresh">Refresh dashboard</button>
      </div>
      <div id="aiPaperDashboardCards" class="ai-paper-dashboard-grid" aria-label="AI paper workstation dashboard"></div>
      <div id="aiPaperDashboardStatus" class="module-control-status">AI paper dashboard ready. paper_only: true · live_execution: false · execution_submitted: false · read_only: true.</div>
    `;
    if (traderPanel) traderPanel.parentElement.insertBefore(panel, traderPanel);
    else paperStatus.insertAdjacentElement('afterend', panel);
    if (typeof window.bindWorkstationActions === 'function') window.bindWorkstationActions(panel);
    refreshAiPaperDashboard();
  }

  function bootAiPaperDashboard() {
    ensurePanel();
    window.setTimeout(refreshAiPaperDashboard, 500);
    window.setTimeout(refreshAiPaperDashboard, 1500);
  }

  window.refreshAiPaperDashboard = refreshAiPaperDashboard;
  window.focusAiPaperDashboardPanel = focusAiPaperDashboardPanel;

  if (window.workstationBoot) window.workstationBoot.register('ai-paper-dashboard', bootAiPaperDashboard);
  else if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bootAiPaperDashboard);
  else bootAiPaperDashboard();
})();
