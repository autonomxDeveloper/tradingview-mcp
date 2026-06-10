function markdownForPacket(packet) {
  return `# Research packet: ${packet.snapshot.symbol} ${packet.snapshot.timeframe}\n\n` +
    `Generated: ${packet.generated_at_utc}\n\n` +
    `## Chart metadata\n- Asset: ${packet.snapshot.asset_type}\n- Exchange: ${packet.snapshot.exchange}\n- Source: ${packet.chart_metadata.source || 'unknown'}\n- Freshness: ${packet.chart_metadata.freshness || 'unknown'}\n\n` +
    `## Idea\n- ID: ${packet.snapshot.idea_id || 'none'}\n- Hypothesis: ${packet.snapshot.hypothesis || 'none'}\n- Invalidation: ${packet.snapshot.invalidation || 'none'}\n- Backtest plan: ${packet.snapshot.backtest_plan || 'none'}\n\n` +
    `## AI analysis\n${packet.snapshot.analysis || 'No analysis captured.'}\n\n` +
    `## Backtests\n${packet.backtests.map((record) => `- ${record.id || 'record'} ${record.strategy || ''} ${record.symbol || ''}`).join('\n') || 'No linked backtests.'}\n\n` +
    `## Recent journal\n${packet.journal.map((row) => `- ${row.event_type || row.type}: ${JSON.stringify(row.payload || {}).slice(0, 160)}`).join('\n') || 'No journal rows.'}\n`;
}

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
  renderExportDownloadCards([exportInfo.json_file, exportInfo.markdown_file].filter(Boolean).map((file) => ({ file })));
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

async function copyExportDownloadUrl(file) {
  const url = `${window.location.origin}/api/exports/download/${file}`;
  await navigator.clipboard.writeText(url);
  print({ copied: 'export download URL', url });
}

function ensureExportCards() {
  let container = document.getElementById('exportDownloadCards');
  if (container) return container;
  container = document.createElement('div');
  container.id = 'exportDownloadCards';
  container.className = 'export-download-cards';
  const output = document.getElementById('output');
  output?.parentNode?.insertBefore(container, output);
  return container;
}

function renderExportDownloadCards(files) {
  const container = ensureExportCards();
  const rows = (files || []).filter((row) => row.file);
  container.innerHTML = rows.length ? rows.map((row) => {
    const href = `/api/exports/download/${row.file}`;
    return `<div class="export-download-card"><a href="${href}" target="_blank" rel="noopener">${row.file}</a><span>${row.size_bytes || ''}</span><button onclick="copyExportDownloadUrl('${row.file}')">Copy URL</button></div>`;
  }).join('') : '<div class="export-download-card empty">No export files yet.</div>';
}

async function showLatestExport() {
  const files = (await api('/api/exports')).exports || [];
  const latest = files.slice(-2).map((row) => ({ ...row, download: `/api/exports/download/${row.file}` }));
  renderExportDownloadCards(latest);
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
  renderExportDownloadCards(rows);
  print({ export_files: rows, hint: 'Use the rendered export cards or copy a download URL.' });
}

function addExportCardStyles() {
  if (document.getElementById('exportCardStyles')) return;
  const style = document.createElement('style');
  style.id = 'exportCardStyles';
  style.textContent = '.export-download-cards{display:grid;gap:6px;padding:8px;background:#080d15;border-top:1px solid #1e293b}.export-download-card{display:flex;gap:8px;align-items:center;border:1px solid #1e293b;border-radius:8px;padding:7px;background:#0b1220}.export-download-card a{color:#93c5fd;text-decoration:none}.export-download-card span{color:#94a3b8;font-size:12px}.export-download-card button{font-size:12px;padding:4px 7px}.export-download-card.empty{color:#94a3b8}';
  document.head.appendChild(style);
}

addExportCardStyles();
