function addResearchToolsStrip() {
  const bottom = document.querySelector('.bottom');
  const tabs = document.querySelector('.bottom .tabs');
  if (!bottom || !tabs || document.getElementById('researchToolsStrip')) return;
  const strip = document.createElement('div');
  strip.id = 'researchToolsStrip';
  strip.className = 'research-tools-strip';
  strip.innerHTML = '<span class="research-tools-title">Research tools</span>';
  bottom.insertBefore(strip, document.getElementById('output'));
  ['ideaStatusControls', 'journalFilters', 'drawingControls', 'snapshotControls', 'exportControls'].forEach((id) => {
    const element = document.getElementById(id);
    if (element) strip.appendChild(element);
  });
}

function addWorkspaceCleanupStyles() {
  if (document.getElementById('workspaceCleanupStyles')) return;
  const style = document.createElement('style');
  style.id = 'workspaceCleanupStyles';
  style.textContent = '.research-tools-strip{display:flex;gap:8px;align-items:flex-start;flex-wrap:wrap;border-top:1px solid #1e293b;border-bottom:1px solid #1e293b;background:#070b12;padding:8px}.research-tools-title{font-size:12px;color:#94a3b8;text-transform:uppercase;letter-spacing:.08em;padding:6px 4px}.research-tools-strip span[id$="Controls"]{margin-top:0}.research-tools-strip button,.research-tools-strip input,.research-tools-strip select{font-size:12px}.bottom>.tabs{padding-bottom:6px}';
  document.head.appendChild(style);
}

function cleanupWorkspaceControls() {
  addWorkspaceCleanupStyles();
  addResearchToolsStrip();
}

setTimeout(cleanupWorkspaceControls, 0);
