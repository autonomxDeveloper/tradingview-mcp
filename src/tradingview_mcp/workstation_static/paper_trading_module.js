(function() {
  const paperState = {
    account: null,
    orders: [],
    fills: [],
  };

  function $(id) {
    return document.getElementById(id);
  }

  async function paperApi(url, opts = {}) {
    const response = await fetch(url, opts);
    const payload = await response.json();
    if (!response.ok || payload.error) {
      const message = payload?.error?.message || `${response.status} ${response.statusText}`;
      throw new Error(message);
    }
    return payload;
  }

  function postJson(url, body = {}) {
    return paperApi(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  }

  function activeSymbol() {
    return (($('symbol') && $('symbol').value) || '').trim().toUpperCase();
  }

  function activeAssetType() {
    const asset = (($('asset') && $('asset').value) || 'auto').toLowerCase();
    const symbol = activeSymbol();
    if (asset === 'crypto' || symbol.endsWith('USDT') || symbol.endsWith('-USD')) return 'crypto';
    if (asset === 'stock' || asset === 'auto') return 'stock';
    return 'other';
  }

  function numberFromInput(id) {
    const value = parseFloat(($(id) && $(id).value) || '');
    return Number.isFinite(value) && value > 0 ? value : null;
  }

  function optionalText(id) {
    return (($(id) && $(id).value) || '').trim();
  }

  function currency(value) {
    const numeric = Number(value || 0);
    return numeric.toLocaleString(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 2 });
  }

  function compactNumber(value) {
    const numeric = Number(value || 0);
    return Number.isInteger(numeric) ? String(numeric) : numeric.toFixed(6).replace(/0+$/, '').replace(/\.$/, '');
  }

  function setPaperStatus(message) {
    const status = $('paperTradingStatus');
    if (status) status.textContent = message;
  }

  function printPaper(value) {
    if (typeof window.setResultPane === 'function') window.setResultPane('paper', value);
    else if (typeof window.print === 'function') window.print(value);
  }

  function renderAccountSummary(snapshot = paperState.account) {
    const target = $('paperAccountSummary');
    if (!target) return;
    const account = snapshot?.account || {};
    target.innerHTML = `
      <div><span>Cash</span><strong>${currency(account.cash)}</strong></div>
      <div><span>Equity</span><strong>${currency(account.equity)}</strong></div>
      <div><span>Market value</span><strong>${currency(account.market_value)}</strong></div>
      <div><span>Unrealized P&L</span><strong>${currency(account.unrealized_pnl)}</strong></div>
    `;
  }

  function renderPaperSnapshot() {
    const account = paperState.account || {};
    const positions = account.positions || [];
    printPaper({
      simulated: true,
      live_execution: false,
      account,
      open_positions: positions,
      recent_orders: paperState.orders,
      recent_fills: paperState.fills,
    });
  }

  async function refreshPaperTrading() {
    setPaperStatus('Refreshing simulated paper account...');
    const [account, orders, fills] = await Promise.all([
      paperApi('/api/paper/account'),
      paperApi('/api/paper/orders?limit=25'),
      paperApi('/api/paper/fills?limit=25'),
    ]);
    paperState.account = account;
    paperState.orders = orders.orders || [];
    paperState.fills = fills.fills || [];
    renderAccountSummary(account);
    renderPaperSnapshot();
    setPaperStatus('Paper account refreshed. Simulated only; no live orders.');
    return paperState;
  }

  function buildPaperOrderRequest() {
    const symbol = activeSymbol();
    const quantity = numberFromInput('paperQuantity');
    if (!symbol) throw new Error('Enter a symbol before submitting a paper order.');
    if (!quantity) throw new Error('Enter a positive paper order quantity.');
    const orderType = optionalText('paperOrderType') || 'market';
    const body = {
      symbol,
      side: optionalText('paperSide') || 'buy',
      quantity,
      order_type: orderType,
      asset_type: activeAssetType(),
      idea_id: optionalText('paperIdeaId') || null,
      notes: optionalText('paperNotes'),
    };
    const limitPrice = numberFromInput('paperLimitPrice');
    const stopPrice = numberFromInput('paperStopPrice');
    if (orderType === 'limit') body.limit_price = limitPrice;
    if (orderType === 'stop') body.stop_price = stopPrice;
    if (orderType === 'limit' && !body.limit_price) throw new Error('Limit orders require a positive limit price.');
    if (orderType === 'stop' && !body.stop_price) throw new Error('Stop orders require a positive stop price.');
    return body;
  }

  async function submitPaperOrder() {
    const body = buildPaperOrderRequest();
    setPaperStatus('Submitting simulated paper order...');
    const result = await postJson('/api/paper/orders', body);
    if ($('paperOrderId') && result.order?.id) $('paperOrderId').value = result.order.id;
    setPaperStatus(`Submitted simulated ${body.side} ${body.order_type} order for ${body.symbol}.`);
    await refreshPaperTrading();
    printPaper({ submitted_order: result.order, account: result.account, simulated: true, live_execution: false });
    return result;
  }

  async function fillPaperOrder() {
    const orderId = optionalText('paperOrderId');
    const fillPrice = numberFromInput('paperFillPrice');
    const fillQuantity = numberFromInput('paperFillQuantity');
    if (!orderId) throw new Error('Enter a paper order ID to fill.');
    if (!fillPrice) throw new Error('Enter a positive simulated fill price.');
    setPaperStatus('Applying simulated fill...');
    const result = await postJson(`/api/paper/orders/${encodeURIComponent(orderId)}/fill`, {
      fill_price: fillPrice,
      fill_quantity: fillQuantity,
      source: 'paper_ui',
    });
    setPaperStatus(`Filled simulated order ${orderId}.`);
    await refreshPaperTrading();
    printPaper({ fill_result: result, simulated: true, live_execution: false });
    return result;
  }

  async function cancelPaperOrder() {
    const orderId = optionalText('paperOrderId');
    if (!orderId) throw new Error('Enter a paper order ID to cancel.');
    setPaperStatus('Cancelling simulated paper order...');
    const result = await postJson(`/api/paper/orders/${encodeURIComponent(orderId)}/cancel`, {});
    setPaperStatus(`Cancelled simulated order ${orderId}.`);
    await refreshPaperTrading();
    printPaper({ cancelled_order: result.order, account: result.account, simulated: true, live_execution: false });
    return result;
  }

  async function resetPaperTrading() {
    const initialCash = numberFromInput('paperInitialCash') || 10000;
    setPaperStatus('Resetting simulated paper account...');
    const result = await postJson('/api/paper/reset', { initial_cash: initialCash, currency: 'USD' });
    setPaperStatus(`Reset simulated account to ${currency(initialCash)}.`);
    await refreshPaperTrading();
    printPaper({ reset: result, simulated: true, live_execution: false });
    return result;
  }

  async function markPaperToMarket() {
    const symbol = activeSymbol();
    const markPrice = numberFromInput('paperMarkPrice');
    if (!symbol) throw new Error('Enter a symbol before marking paper positions.');
    if (!markPrice) throw new Error('Enter a positive mark price.');
    setPaperStatus('Marking simulated account to market...');
    const account = await postJson('/api/paper/account/mark-to-market', { marks: { [symbol]: markPrice } });
    paperState.account = account;
    renderAccountSummary(account);
    setPaperStatus(`Marked ${symbol} at ${currency(markPrice)}.`);
    printPaper({ marked_account: account, simulated: true, live_execution: false });
    return account;
  }

  function copyActiveIdeaToPaperTicket() {
    const ideaId = optionalText('ideaId');
    if ($('paperIdeaId') && ideaId) $('paperIdeaId').value = ideaId;
  }

  function initializePaperTradingUi() {
    ['paperSide', 'paperOrderType', 'paperQuantity', 'paperLimitPrice', 'paperStopPrice', 'paperFillPrice', 'paperFillQuantity', 'paperOrderId', 'paperIdeaId', 'paperNotes', 'paperInitialCash', 'paperMarkPrice'].forEach((id) => {
      const element = $(id);
      if (element && !element.getAttribute('aria-label')) element.setAttribute('aria-label', id.replace(/^paper/, 'Paper '));
    });
    copyActiveIdeaToPaperTicket();
    refreshPaperTrading().catch((error) => setPaperStatus(`Paper trading unavailable: ${error.message || error}`));
  }

  window.refreshPaperTrading = refreshPaperTrading;
  window.submitPaperOrder = submitPaperOrder;
  window.fillPaperOrder = fillPaperOrder;
  window.cancelPaperOrder = cancelPaperOrder;
  window.resetPaperTrading = resetPaperTrading;
  window.markPaperToMarket = markPaperToMarket;

  if (window.workstationBoot) window.workstationBoot.register('paper-trading', initializePaperTradingUi);
  else if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initializePaperTradingUi);
  else initializePaperTradingUi();
})();
