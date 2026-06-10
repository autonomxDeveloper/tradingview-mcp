window.workstationModules = {
  ideas: {
    file: 'idea_module.js + idea_detail.js',
    owns: ['idea lifecycle', 'status filters', 'legacy idea API compatibility'],
  },
  scanner: {
    file: 'scanner_module.js',
    owns: ['watchlist scanner', 'scanner candidate workspace load', 'research-only scanner hypotheses'],
  },
  backtests: {
    file: 'backtest_module.js',
    owns: ['run backtest action', 'strategy comparison action', 'backtest list view'],
  },
  analysis: {
    file: 'analysis_module.js',
    owns: ['AI analysis request payloads', 'analysis loading state', 'analysis response rendering'],
  },
  aiTradeIdeas: {
    file: 'ai_trade_idea_module.js',
    owns: ['AI research trade idea prompt', 'chart-context trade idea cards', 'idea and paper ticket handoff'],
  },
  aiTradeWorkflow: {
    file: 'ai_trade_workflow_module.js',
    owns: ['AI trade idea review gate', 'workflow action gating', 'research-only confirmation state'],
  },
  aiBacktestGenerator: {
    file: 'ai_backtest_generator_module.js',
    owns: ['AI trade idea backtest plan generation', 'strategy mapping', 'generated backtest execution'],
  },
  aiBacktestReview: {
    file: 'ai_backtest_review_module.js',
    owns: ['AI trade idea backtest review', 'backtest verdict cards', 'paper-simulation readiness summary'],
  },
  aiWatchlistScanner: {
    file: 'ai_watchlist_scanner_module.js',
    owns: ['AI watchlist trade scanner', 'candidate ranking', 'scanner-to-idea/backtest/paper handoff'],
  },
  aiPaperRisk: {
    file: 'ai_paper_risk_module.js',
    owns: ['AI paper order risk review', 'paper submit review gate', 'simulated-order safety checks'],
  },
  aiPaperTrader: {
    file: 'ai_paper_trader_module.js',
    owns: ['AI paper-trader decision panel', 'guardrail display', 'explicit simulated execution handoff'],
  },
  aiPaperSchedules: {
    file: 'ai_paper_schedule_module.js',
    owns: ['AI paper-trader schedule panel', 'manual schedule run requests', 'scheduled decision handoff'],
  },
  aiPaperLifecycle: {
    file: 'ai_paper_lifecycle_module.js',
    owns: ['AI paper lifecycle panel', 'advisory position/order review', 'paper-only lifecycle recommendations'],
  },
  aiPaperReplay: {
    file: 'ai_paper_replay_module.js',
    owns: ['AI paper replay panel', 'deterministic decision replay', 'research-only replay summaries'],
  },
  aiPaperHistory: {
    file: 'ai_paper_history_module.js',
    owns: ['AI paper decision history panel', 'read-only journal decisions', 'history-to-replay handoff'],
  },
  aiPaperPerformance: {
    file: 'ai_paper_performance_module.js',
    owns: ['AI paper performance panel', 'read-only replay summaries', 'grouped paper-performance metrics'],
  },
  aiTradeJournalCoach: {
    file: 'ai_trade_journal_coach_module.js',
    owns: ['AI paper trade journal coaching', 'post-fill process review', 'simulated trade improvement rules'],
  },
  aiConfidenceCalibration: {
    file: 'ai_confidence_calibration_module.js',
    owns: ['AI confidence calibration', 'local outcome history', 'trade idea reliability hints'],
  },
  results: {
    file: 'results_module.js',
    owns: ['structured result panes', 'legacy print routing', 'action-to-pane hints'],
  },
  accessibility: {
    file: 'accessibility_module.js',
    owns: ['accessible names', 'live regions', 'keyboard result tabs', 'focus and pressed states'],
  },
  dataProviders: {
    file: 'data_provider_module.js',
    owns: ['stock provider selector', 'crypto venue selector', 'chart data request routing', 'provider licensing status'],
  },
  liveRefresh: {
    file: 'live_refresh_module.js',
    owns: ['live refresh controls', 'polling scheduler', 'chart freshness status'],
  },
  cryptoStreaming: {
    file: 'crypto_stream_module.js',
    owns: ['free Binance crypto WebSocket klines', 'stream status controls', 'primary chart streaming updates'],
  },
  paperTrading: {
    file: 'paper_trading_module.js',
    owns: ['simulated paper account panel', 'paper order ticket', 'paper fills and account reset actions'],
  },
  portfolio: {
    file: 'portfolio_module.js',
    owns: ['read-only portfolio research', 'portfolio tab action', 'portfolio-to-idea cross reference'],
  },
  dataBadges: {
    file: 'data_badge_module.js',
    owns: ['data source badges', 'freshness badges', 'legacy badge API compatibility'],
  },
  journal: {
    file: 'journal_module.js',
    owns: ['journal timeline', 'journal filters', 'current-symbol journal view'],
  },
  drawings: {
    file: 'drawing_module.js',
    owns: ['server drawing sync', 'drawing load/save/clear controls', 'localStorage fallback compatibility'],
  },
  watchlist: {
    file: 'watchlist_module.js',
    owns: ['watchlist add/remove/refresh', 'server persistence', 'symbol load behavior'],
  },
  snapshots: {
    file: 'snapshot_browser.js',
    owns: ['snapshot API save/list/load', 'journal fallback'],
  },
  exports: {
    file: 'export_module.js + export_preview.js',
    owns: ['packet build facade', 'validation', 'file export', 'download cards', 'copy actions', 'legacy export API compatibility'],
  },
  layout: {
    file: 'layout_module.js',
    owns: ['chart grid mode', 'slot state', 'layout state adapter'],
  },
  uiBindings: {
    file: 'ui_bindings.js',
    owns: ['data-action event binding', 'declarative control dispatch', 'legacy global handler bridge'],
  },
  cleanup: {
    file: 'workspace_cleanup.js',
    owns: ['research tools strip', 'control grouping'],
  },
  guard: {
    file: 'module_guard.js',
    owns: ['module dependency checks', 'missing global/UI anchor warnings', 'recent guard warning memory'],
  },
  bootDiagnostics: {
    file: 'boot_diagnostics.js',
    owns: ['boot diagnostics view', 'loaded script listing', 'recent guard warning view'],
  },
  legacyBindingPrune: {
    file: 'legacy_binding_prune.js',
    owns: ['post-boot binding normalization', 'module-owned handler rebind pass'],
  },
};

function showFrontendModules() {
  print({ workstation_modules: window.workstationModules, note: 'Module registry only; behavior is unchanged.' });
}

function addModuleRegistryButton() {
  const tabs = document.querySelector('.bottom .tabs');
  if (!tabs || document.getElementById('frontendModulesButton')) return;
  const button = document.createElement('button');
  button.id = 'frontendModulesButton';
  button.textContent = 'Modules';
  button.onclick = showFrontendModules;
  tabs.appendChild(button);
}

function loadModuleScript(id, src, onload) {
  if (document.getElementById(id)) { if (onload) onload(); return; }
  const script = document.createElement('script');
  script.id = id;
  script.src = src;
  if (onload) script.onload = onload;
  document.body.appendChild(script);
}

function loadWorkstationModules() {
  addModuleRegistryButton();
  loadModuleScript('resultsModuleScript', '/static/results_module.js');
  loadModuleScript('accessibilityModuleScript', '/static/accessibility_module.js');
  loadModuleScript('dataProviderModuleScript', '/static/data_provider_module.js');
  loadModuleScript('moduleGuardScript', '/static/module_guard.js');
  loadModuleScript('dataBadgeModuleScript', '/static/data_badge_module.js');
  loadModuleScript('journalModuleScript', '/static/journal_module.js');
  loadModuleScript('drawingModuleScript', '/static/drawing_module.js');
  loadModuleScript('watchlistModuleScript', '/static/watchlist_module.js');
  loadModuleScript('scannerModuleScript', '/static/scanner_module.js');
  loadModuleScript('backtestModuleScript', '/static/backtest_module.js');
  loadModuleScript('analysisModuleScript', '/static/analysis_module.js');
  loadModuleScript('aiTradeIdeaModuleScript', '/static/ai_trade_idea_module.js');
  loadModuleScript('aiTradeWorkflowModuleScript', '/static/ai_trade_workflow_module.js');
  loadModuleScript('aiBacktestGeneratorModuleScript', '/static/ai_backtest_generator_module.js');
  loadModuleScript('aiBacktestReviewModuleScript', '/static/ai_backtest_review_module.js');
  loadModuleScript('aiWatchlistScannerModuleScript', '/static/ai_watchlist_scanner_module.js');
  loadModuleScript('layoutModuleScript', '/static/layout_module.js');
  loadModuleScript('liveRefreshModuleScript', '/static/live_refresh_module.js');
  loadModuleScript('cryptoStreamModuleScript', '/static/crypto_stream_module.js');
  loadModuleScript('paperTradingModuleScript', '/static/paper_trading_module.js');
  loadModuleScript('aiPaperRiskModuleScript', '/static/ai_paper_risk_module.js');
  loadModuleScript('aiPaperTraderModuleScript', '/static/ai_paper_trader_module.js');
  loadModuleScript('aiPaperScheduleModuleScript', '/static/ai_paper_schedule_module.js');
  loadModuleScript('aiPaperLifecycleModuleScript', '/static/ai_paper_lifecycle_module.js');
  loadModuleScript('aiPaperReplayModuleScript', '/static/ai_paper_replay_module.js');
  loadModuleScript('aiPaperHistoryModuleScript', '/static/ai_paper_history_module.js');
  loadModuleScript('aiPaperPerformanceModuleScript', '/static/ai_paper_performance_module.js');
  loadModuleScript('aiTradeJournalCoachModuleScript', '/static/ai_trade_journal_coach_module.js');
  loadModuleScript('aiConfidenceCalibrationModuleScript', '/static/ai_confidence_calibration_module.js');
  loadModuleScript('portfolioModuleScript', '/static/portfolio_module.js');
  loadModuleScript('exportModuleScript', '/static/export_module.js');
  loadModuleScript('bootDiagnosticsScript', '/static/boot_diagnostics.js');
  loadModuleScript('legacyBindingPruneScript', '/static/legacy_binding_prune.js');
  loadModuleScript('uiBindingsScript', '/static/ui_bindings.js');
  if (window.workstationBoot) window.workstationBoot.run();
}

loadModuleScript('bootRegistryScript', '/static/boot_registry.js', loadWorkstationModules);
