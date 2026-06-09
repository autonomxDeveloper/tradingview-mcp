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
  return { packet, markdown: markdownForPacket(packet) };
}

function renderResearchPacketPreview(packet, markdown, exportInfo = {}) {
  window.latestResearchPacket = packet;
  window.latestResearchPacketMarkdown = markdown;
  const summary = {
    symbol: packet.snapshot.symbol,
    timeframe: packet.snapshot.timeframe,
    idea_id: packet.snapshot.idea_id || 'none',
    ideas: packet.ideas.length,
    backtests: packet.backtests.length,
    journal_rows: packet.journal.length,
    downloads: {
      json: exportInfo.json_file ? `/api/exports/download/${exportInfo.json_file}` : '',
      markdown: exportInfo.markdown_file ? `/api/exports/download/${exportInfo.markdown_file}` : '',
    },
  };
  print({ research_packet_preview: summary, json_copy: 'Use copyResearchPacketJson().', markdown_copy: 'Use copyResearchPacketMarkdown().', markdown_preview: markdown.slice(0, 1800) });
}

async function exportResearchPacket() {
  const { packet, markdown } = await buildResearchPacket();
  await post('/api/journal', { event_type: 'research_packet_exported', payload: { symbol: packet.snapshot.symbol, timeframe: packet.snapshot.timeframe, idea_id: packet.snapshot.idea_id } });
  const saved = await post('/api/exports', { name: `${packet.snapshot.symbol}-${packet.snapshot.timeframe}`, packet, markdown });
  renderResearchPacketPreview(packet, markdown, saved.export || {});
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
  controls.appendChild(jsonButton);
  controls.appendChild(mdButton);
}

addPacketPreviewControls();
