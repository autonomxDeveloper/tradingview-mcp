async function saveSessionSnapshot() {
  const snapshot = currentSessionSnapshot();
  try {
    await post('/api/snapshots', { snapshot });
  } catch (_) {
    await post('/api/journal', { event_type: 'research_session_snapshot', payload: snapshot });
  }
  print({ session_snapshot_saved: { symbol: snapshot.symbol, timeframe: snapshot.timeframe, idea_id: snapshot.idea_id } });
}

async function listSessionSnapshots() {
  let records = [];
  try {
    const response = await api('/api/snapshots?limit=500');
    records = response.snapshots || [];
  } catch (_) {
    const response = await api('/api/journal?limit=500');
    records = (response.events || []).filter((row) => row.event_type === 'research_session_snapshot').map((row) => ({ created_at_utc: row.timestamp_utc || row.timestamp || '', snapshot: row.payload || {} }));
  }
  window.workstationSnapshotEvents = records;
  const rows = records.map((record, index) => {
    const snapshot = record.snapshot || record.payload || {};
    return {
      index: index + 1,
      id: record.id || '',
      time: record.created_at_utc || record.timestamp_utc || record.timestamp || '',
      symbol: snapshot.symbol || '',
      timeframe: snapshot.timeframe || '',
      idea_id: snapshot.idea_id || '',
    };
  });
  print({ session_snapshots: rows, action: 'Use loadSessionSnapshot(index).' });
}

function applySessionSnapshot(snapshot) {
  $('symbol').value = snapshot.symbol || $('symbol').value;
  $('tf').value = snapshot.timeframe || $('tf').value;
  $('asset').value = snapshot.asset_type || $('asset').value;
  $('exchange').value = snapshot.exchange || $('exchange').value;
  $('ideaId').value = snapshot.idea_id || '';
  $('hypothesis').value = snapshot.hypothesis || '';
  $('invalidation').value = snapshot.invalidation || '';
  $('backtestPlan').value = snapshot.backtest_plan || '';
  if (window.applyLayoutState) window.applyLayoutState(snapshot.layout || {});
  drawings = { ...emptyDrawings(), ...(snapshot.drawings || {}) };
  localStorage.setItem(drawingStorageKey(), JSON.stringify(drawings));
  renderDrawings();
}

async function loadSessionSnapshot(index = 1) {
  if (!window.workstationSnapshotEvents) await listSessionSnapshots();
  const events = window.workstationSnapshotEvents || [];
  const record = events[Math.max(0, Number(index) - 1)];
  if (!record) { print('No snapshot found for that index.'); return; }
  const snapshot = record.snapshot || record.payload || {};
  applySessionSnapshot(snapshot);
  print({ session_snapshot_loaded: { index: Number(index), symbol: snapshot.symbol, timeframe: snapshot.timeframe, idea_id: snapshot.idea_id } });
  loadMarket();
}

async function loadLatestSessionSnapshot() {
  await listSessionSnapshots();
  const count = (window.workstationSnapshotEvents || []).length;
  if (!count) { print('No session snapshot found.'); return; }
  await loadSessionSnapshot(count);
}

function addSnapshotBrowserControls() {
  const controls = document.getElementById('snapshotControls');
  if (!controls || document.getElementById('snapshotBrowserButton')) return;
  const listButton = document.createElement('button');
  listButton.id = 'snapshotBrowserButton';
  listButton.textContent = 'List snapshots';
  listButton.onclick = listSessionSnapshots;
  controls.appendChild(listButton);
}

function bootSnapshotBrowserModule() {
  addSnapshotBrowserControls();
}

if (window.registerWorkbenchBoot) {
  window.registerWorkbenchBoot('snapshot-browser', bootSnapshotBrowserModule);
} else {
  setTimeout(bootSnapshotBrowserModule, 0);
}
