async function buildResearchPacket() {
  const snapshot = currentSessionSnapshot();
  const journalResponse = await api('/api/journal?limit=30');
  const ideaResponse = await api(`/api/ideas?symbol=${encodeURIComponent(snapshot.symbol)}&limit=20`);
  const backtestQuery = snapshot.idea_id ? `/api/backtests?idea_id=${encodeURIComponent(snapshot.idea_id)}&limit=20` : `/api/backtests?symbol=${encodeURIComponent(snapshot.symbol)}&limit=20`;
  const backtestResponse = await api(backtestQuery);
  const metadata = lastPayload?.metadata || {};
  const packet = {
    generated_at_utc: new Date().toISOString(),
    mode: 'research_only',
    snapshot,
    chart_metadata: {
      text: document.getElementById('chartMeta')?.textContent || '',
      source: metadata.source || lastPayload?.source || '',
      freshness: metadata.stale ? 'stale' : 'fresh',
    },
    ideas: ideaResponse.ideas || [],
    backtests: backtestResponse.records || [],
    journal: journalResponse.events || [],
  };
  packet.validation = validateResearchPacket(packet);
  return { packet, markdown: markdownForPacket(packet) };
}

function validateResearchPacket(packet) {
  const warnings = [];
  const snapshot = packet.snapshot || {};
  if (!snapshot.idea_id) warnings.push('missing linked idea id');
  if (!String(snapshot.invalidation || '').trim()) warnings.push('missing invalidation');
  if (!String(snapshot.hypothesis || '').trim()) warnings.push('missing hypothesis');
  if (!packet.backtests.length) warnings.push('no linked or symbol backtest records');
  if (!window.lastPayload) warnings.push('no market payload loaded');
  if (packet.chart_metadata.freshness === 'stale') warnings.push('market payload is stale');
  if (!String(snapshot.analysis || '').trim()) warnings.push('no AI analysis captured');
  return { ok: warnings.length === 0, warnings };
}

function renderResearchPacketPreview(packet, markdown, exportInfo = {}) {
  window.latestResearchPacket = packet;
  window.latestResearchPacketMarkdown = markdown;
  window.latestExportFiles = exportInfo;
  const summary = {
    symbol: packet.snapshot.symbol,
    timeframe: packet.snapshot.timeframe,
    idea_id: packet.snapshot.idea_id || 'none',
    ideas: packet.ideas.length,
    backtests: packet.backtests.length,
    journal_rows: packet.journal.length,
    validation: packet.validation,
    downloads: {
      json: exportInfo.json_file ? `/api/exports/download/${exportInfo.json_file}` : '',
      markdown: exportInfo.markdown_file ? `/api/exports/download/${exportInfo.markdown_file}` : '',
    },
  };
  print({ research_packet_preview: summary, json_copy: 'Use copyResearchPacketJson().', markdown_copy: 'Use copyResearchPacketMarkdown().', markdown_preview: markdown.slice(0, 1800) });
}

async function exportResearchPacket() {
  const { packet, markdown } = await buildResearchPacket();
  await post('/api/journal', { event_type: 'research_packet_exported', payload: { symbol: packet.snapshot.symbol, timeframe: packet.snapshot.timeframe, idea_id: packet.snapshot.idea_id, validation: packet.validation } });
  const saved = await post('/api/exports', { name: `${packet.snapshot.symbol}-${packet.snapshot.timeframe}`, packet, markdown });
  renderResearchPacketPreview(packet, markdown, saved.export || {});
}

async function validateCurrentPacket() {
  const { packet } = await buildResearchPacket();
  print({ research_packet_validation: packet.validation, note: packet.validation.ok ? 'packet looks complete' : 'export allowed, but review warnings first' });
}

async function copyResearchPacketJson() {
  if (!window.latestResearchPacket) await exportResearchPacket();
  const text = JSON.stringify(window.latestResearchPacket, null, 2);
  await navigator.clipboard.writeText(text);
  print({ copied: 'research packet JSON', bytes: text.length });
}

async function copyResearchPacketMarkdown() {
  if (!window.latestResearchPacketMarkdown) await exportResearchPacket();
  await navigator.clipboard.writeText(window.latestResearchPacketMarkdown);
  print({ copied: 'research packet Markdown', bytes: window.latestResearchPacketMarkdown.length });
}

async function showLatestExport() {
  const files = (await api('/api/exports')).exports || [];
  const latest = files.slice(-2).map((row) => ({ ...row, download: `/api/exports/download/${row.file}` }));
  print({ latest_export_files: latest });
}

async function renderExportFileBrowser() {
  const files = (await api('/api/exports')).exports || [];
  const rows = files.map((row, index) => ({
    index: index + 1,
    file: row.file,
    size_bytes: row.size_bytes,
    download: `/api/exports/download/${row.file}`,
  }));
  print({ export_files: rows, hint: 'Open a download URL in the browser to save the file.' });
}

function addPacketPreviewControls() {
  const controls = document.getElementById('exportControls');
  if (!controls || document.getElementById('copyPacketJsonButton')) return;
  const jsonButton = document.createElement('button');
  jsonButton.id = 'copyPacketJsonButton';
  jsonButton.textContent = 'Copy JSON';
  jsonButton.onclick = copyResearchPacketJson;
  const mdButton = document.createElement('button');
  mdButton.id = 'copyPacketMarkdownButton';
  mdButton.textContent = 'Copy Markdown';
  mdButton.onclick = copyResearchPacketMarkdown;
  const browseButton = document.createElement('button');
  browseButton.id = 'browseExportsButton';
  browseButton.textContent = 'Browse exports';
  browseButton.onclick = renderExportFileBrowser;
  const latestButton = document.createElement('button');
  latestButton.id = 'latestExportButton';
  latestButton.textContent = 'Latest export';
  latestButton.onclick = showLatestExport;
  const validateButton = document.createElement('button');
  validateButton.id = 'validatePacketButton';
  validateButton.textContent = 'Validate packet';
  validateButton.onclick = validateCurrentPacket;
  controls.appendChild(jsonButton);
  controls.appendChild(mdButton);
  controls.appendChild(browseButton);
  controls.appendChild(latestButton);
  controls.appendChild(validateButton);
}

addPacketPreviewControls();
