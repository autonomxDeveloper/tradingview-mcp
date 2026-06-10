// Dedicated drawing module for server sync helpers and compatibility API.
window.workstationDrawingModule = window.workstationDrawingModule || {};

window.workstationDrawingModule.payload = function payload() {
  return { symbol: $('symbol').value, timeframe: $('tf').value, drawings };
};

window.workstationDrawingModule.setStatus = function setStatus(message) {
  const status = document.getElementById('drawingSyncStatus');
  if (status) status.textContent = message;
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
  const controls = document.getElementById('drawingControls');
  if (!controls) return;
  const buttons = controls.querySelectorAll('button');
  if (buttons[0]) buttons[0].onclick = window.workstationDrawingModule.load;
  if (buttons[1]) buttons[1].onclick = window.workstationDrawingModule.save;
  if (buttons[2]) buttons[2].onclick = window.workstationDrawingModule.clearServer;
};

window.saveServerDrawings = window.workstationDrawingModule.save;
window.loadServerDrawings = window.workstationDrawingModule.load;
window.clearServerDrawings = window.workstationDrawingModule.clearServer;
if (window.workstationBoot) window.workstationBoot.register('drawing-module', () => window.workstationDrawingModule.bindControls());
else window.workstationDrawingModule.bindControls();
