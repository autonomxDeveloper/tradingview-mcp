// Dedicated drawing module for server sync helpers and compatibility API.
window.workstationDrawingModule = window.workstationDrawingModule || {};

window.workstationDrawingModule.payload = function payload() {
  return { symbol: $('symbol').value, timeframe: $('tf').value, drawings };
};

window.workstationDrawingModule.setStatus = function setStatus(message) {
  const status = document.getElementById('drawingSyncStatus');
  if (status) status.textContent = message;
};

window.workstationDrawingModule.button = function button(label, handler) {
  const element = document.createElement('button');
  element.className = 'secondary';
  element.textContent = label;
  element.onclick = handler;
  return element;
};

window.workstationDrawingModule.ensureControls = function ensureControls() {
  let controls = document.getElementById('drawingControls');
  if (!controls) {
    controls = document.createElement('span');
    controls.id = 'drawingControls';
    controls.className = 'module-control-group drawing-control-group';
    const target = document.getElementById('researchToolsStrip') || document.querySelector('.bottom .tabs');
    if (target) target.appendChild(controls);
  }
  if (!controls) return null;
  if (!document.getElementById('loadServerDrawingsButton')) {
    const load = window.workstationDrawingModule.button('Load drawings', window.workstationDrawingModule.load);
    load.id = 'loadServerDrawingsButton';
    const save = window.workstationDrawingModule.button('Save drawings', window.workstationDrawingModule.save);
    save.id = 'saveServerDrawingsButton';
    const clear = window.workstationDrawingModule.button('Clear server drawings', window.workstationDrawingModule.clearServer);
    clear.id = 'clearServerDrawingsButton';
    controls.appendChild(load);
    controls.appendChild(save);
    controls.appendChild(clear);
  }
  if (!document.getElementById('drawingSyncStatus')) {
    const status = document.createElement('span');
    status.id = 'drawingSyncStatus';
    status.className = 'muted';
    status.textContent = 'drawings local fallback ready';
    controls.appendChild(status);
  }
  return controls;
};

window.workstationDrawingModule.save = async function save() {
  await post('/api/drawings', window.workstationDrawingModule.payload());
  window.workstationDrawingModule.setStatus('drawings saved');
};

window.workstationDrawingModule.load = async function load() {
  const response = await api(`/api/drawings?symbol=${encodeURIComponent($('symbol').value)}&timeframe=${encodeURIComponent($('tf').value)}`);
  drawings = { ...emptyDrawings(), ...(response.drawings || {}) };
  localStorage.setItem(drawingStorageKey(), JSON.stringify(drawings));
  renderDrawings();
  window.workstationDrawingModule.setStatus('drawings loaded');
};

window.workstationDrawingModule.clearServer = async function clearServer() {
  drawings = emptyDrawings();
  localStorage.setItem(drawingStorageKey(), JSON.stringify(drawings));
  renderDrawings();
  await window.workstationDrawingModule.save();
  window.workstationDrawingModule.setStatus('server drawings cleared');
};

window.workstationDrawingModule.bindControls = function bindControls() {
  window.workstationModuleGuard?.missing('drawings', { globals: ['api', 'post', '$', 'emptyDrawings', 'renderDrawings'], elements: ['researchToolsStrip'] });
  const controls = window.workstationDrawingModule.ensureControls();
  if (!controls) return;
  document.getElementById('loadServerDrawingsButton')?.addEventListener('click', window.workstationDrawingModule.load, { once: false });
  document.getElementById('saveServerDrawingsButton')?.addEventListener('click', window.workstationDrawingModule.save, { once: false });
  document.getElementById('clearServerDrawingsButton')?.addEventListener('click', window.workstationDrawingModule.clearServer, { once: false });
};

window.saveServerDrawings = window.workstationDrawingModule.save;
window.loadServerDrawings = window.workstationDrawingModule.load;
window.clearServerDrawings = window.workstationDrawingModule.clearServer;
if (window.workstationBoot) window.workstationBoot.register('drawing-module', () => window.workstationDrawingModule.bindControls());
else window.workstationDrawingModule.bindControls();
