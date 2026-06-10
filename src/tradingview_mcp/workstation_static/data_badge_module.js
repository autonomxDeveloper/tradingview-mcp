window.workstationDataBadgeModule = window.workstationDataBadgeModule || {};

window.workstationDataBadgeModule.ensure = function ensureDataBadges() {
  let badges = document.getElementById('dataBadges');
  if (badges) return badges;
  badges = document.createElement('span');
  badges.id = 'dataBadges';
  badges.className = 'data-badges';
  const chartMeta = document.getElementById('chartMeta');
  if (chartMeta && chartMeta.parentNode) chartMeta.parentNode.insertBefore(badges, chartMeta.nextSibling);
  return badges;
};

window.workstationDataBadgeModule.render = function renderDataBadges() {
  const badges = window.workstationDataBadgeModule.ensure();
  if (!badges) return;
  const metadata = window.lastPayload?.metadata || {};
  const source = metadata.source || window.lastPayload?.source || (window.activeIsCrypto && window.activeIsCrypto() ? 'binance' : 'yahoo');
  const freshness = metadata.stale ? 'stale' : 'fresh';
  const cache = metadata.cache_status || 'request';
  const exchange = document.getElementById('exchange')?.value || '';
  const venue = window.activeIsCrypto && window.activeIsCrypto() ? 'binance' : exchange;
  badges.innerHTML = `<span class="data-badge">source ${source}</span><span class="data-badge">cache ${cache}</span><span class="data-badge ${metadata.stale ? 'warn' : 'ok'}">${freshness}</span><span class="data-badge">venue ${venue}</span>`;
};

window.ensureDataBadges = window.workstationDataBadgeModule.ensure;
window.renderDataBadges = window.workstationDataBadgeModule.render;

window.workstationDataBadgeModule.boot = function bootDataBadgeModule() {
  window.workstationDataBadgeModule.ensure();
};

if (window.registerWorkbenchBoot) {
  window.registerWorkbenchBoot('dataBadges', window.workstationDataBadgeModule.boot);
} else {
  setTimeout(window.workstationDataBadgeModule.boot, 0);
}
