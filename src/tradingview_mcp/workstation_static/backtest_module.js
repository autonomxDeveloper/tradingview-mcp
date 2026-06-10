(function() {
  async function runBacktest() {
    const response = await post('/api/backtest/run', {
      symbol: $('symbol').value,
      strategy: $('strategy').value,
      period: $('period').value,
      include_trade_log: true,
      include_equity_curve: true,
      idea_id: $('ideaId').value || null,
    });
    print(response);
  }

  async function compareStrategies() {
    print(await api(`/api/backtest/compare?symbol=${encodeURIComponent($('symbol').value)}&period=${$('period').value}`));
  }

  async function loadBacktests() {
    print(await api(`/api/backtests?symbol=${encodeURIComponent($('symbol').value)}&limit=100`));
  }

  function addBacktestModuleControls() {
    const tabs = document.querySelector('.bottom .tabs');
    if (!tabs) return;
    const bindings = [
      ['backtestModuleRunButton', 'Backtest', runBacktest],
      ['backtestModuleCompareButton', 'Compare', compareStrategies],
      ['backtestModuleListButton', 'Backtests', loadBacktests],
    ];
    bindings.forEach(([id, label, handler]) => {
      const existing = document.getElementById(id);
      if (existing) { existing.onclick = handler; return; }
      const legacy = [...tabs.querySelectorAll('button')].find((button) => button.textContent.trim() === label);
      if (legacy) { legacy.id = id; legacy.onclick = handler; return; }
      const button = document.createElement('button');
      button.id = id;
      button.textContent = label;
      button.onclick = handler;
      tabs.appendChild(button);
    });
  }

  function bootBacktestModule() {
    if (window.workstationModuleGuard) {
      window.workstationModuleGuard.check('backtest', {
        globals: ['api', 'post', 'print', '$'],
        selectors: ['#symbol', '#strategy', '#period', '#ideaId', '.bottom .tabs'],
      });
    }
    addBacktestModuleControls();
  }

  window.runBacktest = runBacktest;
  window.compareStrategies = compareStrategies;
  window.loadBacktests = loadBacktests;
  window.addBacktestModuleControls = addBacktestModuleControls;
  window.bootBacktestModule = bootBacktestModule;

  if (window.workstationBoot) window.workstationBoot.register('backtest', bootBacktestModule);
  else setTimeout(bootBacktestModule, 0);
})();
