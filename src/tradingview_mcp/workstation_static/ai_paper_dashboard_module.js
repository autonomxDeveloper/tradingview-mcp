(function() {
  const PANEL_LINKS = [
    { key: 'decision', label: 'Decision', panel: 'aiPaperTraderPanel', status: 'aiPaperTraderStatus', action: 'aiPaperTrader.decision' },
    { key: 'schedules', label: 'Schedules', panel: 'aiPaperSchedulePanel', status: 'aiPaperScheduleStatus', action: 'aiPaperSchedule.refresh' },
    { key: 'lifecycle', label: 'Lifecycle', panel: 'aiPaperLifecyclePanel', status: 'aiPaperLifecycleStatus', action: 'aiPaperLifecycle.review' },
    { key: 'replay', label: 'Replay', panel: 'aiPaperReplayPanel', status: 'aiPaperReplayStatus', action: 'aiPaperReplay.run' },
    { key: 'history', label: 'History', panel: 'aiPaperHistoryPanel', status: 'aiPaperHistoryStatus', action: 'aiPaperHistory.refresh' },
    { key: 'performance', label: 'Performance', panel: 'aiPaperPerformancePanel', status: 'aiPaperPerformanceStatus', action: 'aiPaperPerformance.run' },
    { key: 'reviewPacket', label: 'Review packet', panel: 'aiPaperReviewPacketPanel', status: 'aiPaperReviewPacketStatus', action: 'aiPaperReviewPacket.build' },
    { key: 'auditExport', label: 'Audit export', panel: 'aiPaperAuditExportPanel', status: 'aiPaperAuditExportStatus', action: 'aiPaperAuditExport.build' },
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

  function panelState(link) {
    const panel = $(link.panel);
    const status = $(link.status);
    return {
      exists: !!panel,
      status: status ? String(status.textContent || '').trim() : 'not loaded yet',
    };
  }

  function statusBadge(link) {
    const state = panelState(link);
    return state.exists ? 'ready' : 'pending';
  }

  function focusAiPaperDashboardPanel(key) {
    const link = PANEL_LINKS.find((item) => item.key === key || item.panel === key);
    if (!link) throw new Error(`Unknown AI paper dashboard target: ${key}`);
    const panel = $(link.panel);
    if (!panel) throw new Error(`${link.label} panel has not loaded yet.`);
    panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
    if (typeof panel.focus === 'function') {
      if (!panel.hasAttribute('tabindex')) panel.setAttribute('tabindex', '-1');
      panel.focus({ preventScroll: true });
    }
    updateAiPaperDashboardStatus(`Focused ${link.label}. Read-only dashboard navigation only; no trade action submitted.`);
    return link;
  }

  function collectAiPaperDashboardStatus() {
    return PANEL_LINKS.map((link) => ({
      key: link.key,
      label: link.label,
      panel: link.panel,
      status_id: link.status,
      action: link.action,
      state: statusBadge(link),
      message: panelState(link).status,
    }));
  }

  function updateAiPaperDashboardStatus(message) {
    const target = $('aiPaperDashboardStatus');
    if (target) target.textContent = message;
  }

  function renderAiPaperDashboardStatus() {
    const list = $('aiPaperDashboardList');
    if (!list) return;
    const statuses = collectAiPaperDashboardStatus();
    list.innerHTML = statuses.map((item) => `
      <button type="button" class="secondary ai-paper-dashboard-link" data-action="aiPaperDashboard.focus" data-action-arg="${escapeHtml(item.key)}" aria-label="Focus ${escapeHtml(item.label)} panel">
        <span>${escapeHtml(item.label)}</span>
        <b>${escapeHtml(item.state)}</b>
      </button>
    `).join('');
    if (typeof window.bindWorkstationActions === 'function') window.bindWorkstationActions(list);
    const ready = statuses.filter((item) => item.state === 'ready').length;
    updateAiPaperDashboardStatus(`AI paper dashboard ready: ${ready}/${statuses.length} panels loaded. paper_only: true · live_execution: false · execution_submitted: false · read_only: true.`);
    return statuses;
  }

  function printAiPaperDashboardStatus() {
    const payload = {
      ai_paper_dashboard: collectAiPaperDashboardStatus(),
      paper_only: true,
      live_execution: false,
      execution_submitted: false,
      background_loop_enabled: false,
      read_only: true,
      note: 'Dashboard is navigation/status only. It does not call the LLM, mutate paper state, submit simulated orders, or call live broker endpoints.',
    };
    if (typeof window.setResultPane === 'function') window.setResultPane('paper', payload);
    else if (typeof window.print === 'function') window.print(payload);
    updateAiPaperDashboardStatus('Printed read-only AI paper dashboard status. No account mutation or execution submitted.');
    return payload;
  }

  function ensureAiPaperDashboardPanel() {
    if ($('aiPaperDashboardPanel')) return;
    const traderPanel = $('aiPaperTraderPanel');
    const paperStatus = $('paperTradingStatus');
    const anchor = traderPanel || paperStatus;
    if (!anchor || !anchor.parentElement) return;
    const panel = document.createElement('div');
    panel.id = 'aiPaperDashboardPanel';
    panel.className = 'ai-paper-dashboard-panel';
    panel.innerHTML = `
      <div class="label">AI paper dashboard</div>
      <p class="paper-trading-warning">Compact navigation/status strip for AI paper research panels. Read-only dashboard; no LLM calls, no paper state mutation, no simulated order submission, and no live broker execution.</p>
      <div id="aiPaperDashboardList" class="ai-paper-dashboard-list" aria-label="AI paper dashboard navigation"></div>
      <div class="ai-trade-actions">
        <button type="button" class="secondary" data-action="aiPaperDashboard.refresh">Refresh dashboard status</button>
        <button type="button" class="secondary" data-action="aiPaperDashboard.print">Print dashboard status</button>
      </div>
      <div id="aiPaperDashboardStatus" class="module-control-status">AI paper dashboard loading. paper_only: true · live_execution: false · execution_submitted: false · read_only: true.</div>
    `;
    anchor.parentElement.insertBefore(panel, anchor);
    if (typeof window.bindWorkstationActions === 'function') window.bindWorkstationActions(panel);
    renderAiPaperDashboardStatus();
  }

  function initializeAiPaperDashboard() {
    ensureAiPaperDashboardPanel();
    window.setTimeout(renderAiPaperDashboardStatus, 100);
    window.setTimeout(renderAiPaperDashboardStatus, 500);
  }

  window.aiPaperDashboardLinks = PANEL_LINKS;
  window.focusAiPaperDashboardPanel = focusAiPaperDashboardPanel;
  window.renderAiPaperDashboardStatus = renderAiPaperDashboardStatus;
  window.printAiPaperDashboardStatus = printAiPaperDashboardStatus;

  if (window.workstationBoot) window.workstationBoot.register('ai-paper-dashboard', initializeAiPaperDashboard);
  else if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initializeAiPaperDashboard);
  else initializeAiPaperDashboard();
})();
