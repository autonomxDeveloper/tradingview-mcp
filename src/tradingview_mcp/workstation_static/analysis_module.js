(function() {
  function analysisPayload() {
    return {
      symbol: $('symbol').value,
      asset_type: $('asset').value,
      exchange: $('exchange').value,
      timeframe: $('tf').value,
      question: $('question').value,
    };
  }

  function renderAnalysisResponse(response) {
    const value = response.structured_analysis?.parsed
      ? response.structured_analysis
      : response.analysis?.content || response;
    print(value, 'analysis');
  }

  async function analyze() {
    print('Analyzing...', 'analysis');
    const response = await post('/api/ai/analyze', analysisPayload());
    renderAnalysisResponse(response);
  }

  function bindAnalysisControls() {
    [...document.querySelectorAll('button')].forEach((button) => {
      const action = button.getAttribute('onclick') || '';
      if (action.trim() === 'analyze()') button.onclick = analyze;
    });
  }

  function bootAnalysisModule() {
    if (window.workstationModuleGuard) {
      window.workstationModuleGuard.check('analysis', {
        globals: ['api', 'post', 'print', '$'],
        selectors: ['#symbol', '#asset', '#exchange', '#tf', '#question', '#analysis'],
      });
    }
    bindAnalysisControls();
  }

  window.analysisPayload = analysisPayload;
  window.renderAnalysisResponse = renderAnalysisResponse;
  window.analyze = analyze;
  window.bindAnalysisControls = bindAnalysisControls;
  window.bootAnalysisModule = bootAnalysisModule;

  if (window.workstationBoot) window.workstationBoot.register('analysis', bootAnalysisModule);
  else setTimeout(bootAnalysisModule, 0);
})();
