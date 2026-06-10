(function() {
  const boundAttribute = 'data-action-bound';

  function callGlobal(name, ...args) {
    const handler = window[name];
    if (typeof handler !== 'function') {
      throw new Error(`Missing workstation handler: ${name}`);
    }
    return handler(...args);
  }

  function actionArgument(element) {
    if (!element) return undefined;
    if (element.dataset.actionArg !== undefined) return element.dataset.actionArg;
    if (element.dataset.actionValue === 'checked') return !!element.checked;
    if (element.dataset.actionValue === 'value') return element.value;
    return undefined;
  }

  const actions = {
    'market.load': () => callGlobal('loadMarket'),
    'analysis.run': () => callGlobal('analyze'),
    'chart.toggleOverlay': (element) => callGlobal('toggleOverlay', actionArgument(element)),
    'chart.toggleVolume': () => callGlobal('toggleVolume'),
    'chart.toggleRsi': () => callGlobal('toggleRsiPane'),
    'chart.toggleMacd': () => callGlobal('toggleMacdPane'),
    'chart.toggleAtr': () => callGlobal('toggleAtrPane'),
    'chart.fit': () => callGlobal('fitChart'),
    'live.toggle': (element) => callGlobal('setLiveRefresh', actionArgument(element)),
    'live.setInterval': (element) => callGlobal('setLiveRefreshInterval', actionArgument(element)),
    'drawings.addLevel': () => callGlobal('addLevelFromInput'),
    'drawings.addLastCloseLevel': () => callGlobal('addLevelFromLastClose'),
    'drawings.addNote': () => callGlobal('addNoteAtLastClose'),
    'drawings.addZone': () => callGlobal('addZoneFromInput'),
    'drawings.addGuide': () => callGlobal('addGuideFromInput'),
    'drawings.clear': () => callGlobal('clearDrawings'),
    'drawings.export': () => callGlobal('exportDrawings'),
    'drawings.import': () => callGlobal('importDrawings'),
    'layout.setMode': (element) => callGlobal('setLayoutMode', actionArgument(element)),
    'layout.setSymbolSync': (element) => callGlobal('setSymbolSync', actionArgument(element)),
    'layout.setTimeframeSync': (element) => callGlobal('setTimeframeSync', actionArgument(element)),
    'layout.save': () => callGlobal('saveLayout'),
    'layout.load': () => callGlobal('loadLayout'),
    'layout.reset': () => callGlobal('resetLayout'),
    'layout.list': () => callGlobal('listLayouts'),
    'layout.delete': () => callGlobal('deleteLayout'),
    'layout.setSlot': (element) => callGlobal('setChartSlot', Number(actionArgument(element))),
    'payload.show': () => callGlobal('showPayload'),
    'backtest.run': () => callGlobal('runBacktest'),
    'backtest.compare': () => callGlobal('compareStrategies'),
    'backtest.list': () => callGlobal('loadBacktests'),
    'paper.refresh': () => callGlobal('refreshPaperTrading'),
    'paper.submit': () => callGlobal('submitPaperOrder'),
    'paper.riskReview': () => callGlobal('reviewPaperOrderRisk'),
    'paper.submitReviewed': () => callGlobal('submitReviewedPaperOrder'),
    'paper.fill': () => callGlobal('fillPaperOrder'),
    'paper.cancel': () => callGlobal('cancelPaperOrder'),
    'paper.reset': () => callGlobal('resetPaperTrading'),
    'paper.mark': () => callGlobal('markPaperToMarket'),
    'aiPaperTrader.decision': () => callGlobal('runAiPaperTraderDecision'),
    'aiPaperTrader.execute': () => callGlobal('executeAiPaperDecision'),
    'ideas.save': () => callGlobal('saveIdea'),
    'ideas.list': () => callGlobal('loadIdeas'),
    'ideas.detail': (element) => callGlobal('loadIdeaDetail', Number(actionArgument(element) || 1)),
    'ideas.loadWorkspace': () => callGlobal('loadWorkspaceIdea'),
    'scanner.scan': () => callGlobal('scanWatchlist'),
    'scanner.useTopCandidate': () => callGlobal('useTopScannerCandidate'),
    'journal.load': () => callGlobal('loadJournal'),
  };

  function bindActionElement(element) {
    if (!element || element.getAttribute(boundAttribute) === 'true') return;
    const action = element.dataset.action;
    const handler = actions[action];
    if (!handler) return;
    const eventName = element.dataset.actionEvent || 'click';
    element.addEventListener(eventName, (event) => {
      if (eventName === 'click') event.preventDefault();
      try {
        const result = handler(element, event);
        if (result && typeof result.catch === 'function') {
          result.catch((error) => {
            if (typeof print === 'function') print(String(error && error.message ? error.message : error));
            else console.error(error);
          });
        }
      } catch (error) {
        if (typeof print === 'function') print(String(error && error.message ? error.message : error));
        else console.error(error);
      }
    });
    element.setAttribute(boundAttribute, 'true');
  }

  function bindWorkstationActions(root = document) {
    root.querySelectorAll('[data-action]').forEach(bindActionElement);
  }

  function observeActionElements() {
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (!(node instanceof Element)) return;
          if (node.matches('[data-action]')) bindActionElement(node);
          bindWorkstationActions(node);
        });
      });
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  window.bindWorkstationActions = bindWorkstationActions;

  function bootUiBindings() {
    bindWorkstationActions();
    observeActionElements();
  }

  if (window.workstationBoot) window.workstationBoot.register('ui-bindings', bootUiBindings);
  else if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bootUiBindings);
  else bootUiBindings();
})();