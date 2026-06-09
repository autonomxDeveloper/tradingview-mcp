async function listSessionSnapshots() {
  const response = await api('/api/journal?limit=500');
  const events = (response.events || []).filter((row) => row.event_type === 'research_session_snapshot');
  window.workstationSnapshotEvents = events;
  const rows = events.map((event, index) => {
    const snapshot = event.payload || {};
    return {
      index: index + 1,
      time: event.timestamp_utc || event.timestamp || '',
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
  const event = events[Math.max(0, Number(index) - 1)];
  if (!event) { print('No snapshot found for that index.'); return; }
  const snapshot = event.payload || {};
  applySessionSnapshot(snapshot);
  print({ session_snapshot_loaded: { index: Number(index), symbol: snapshot.symbol, timeframe: snapshot.timeframe, idea_id: snapshot.idea_id } });
  loadMarket();
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

addSnapshotBrowserControls();
