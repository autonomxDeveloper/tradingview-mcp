function addPacketPreviewControls() {
  const controls = document.getElementById('exportControls');
  if (!controls || document.getElementById('copyPacketJsonButton')) return;
  const jsonButton = document.createElement('button');
  jsonButton.id = 'copyPacketJsonButton';
  jsonButton.textContent = 'Copy JSON';
  jsonButton.onclick = () => window.exportModule.copyJson();
  const mdButton = document.createElement('button');
  mdButton.id = 'copyPacketMarkdownButton';
  mdButton.textContent = 'Copy Markdown';
  mdButton.onclick = () => window.exportModule.copyMarkdown();
  const browseButton = document.createElement('button');
  browseButton.id = 'browseExportsButton';
  browseButton.textContent = 'Browse exports';
  browseButton.onclick = () => window.exportModule.browseFiles();
  const latestButton = document.createElement('button');
  latestButton.id = 'latestExportButton';
  latestButton.textContent = 'Latest export';
  latestButton.onclick = () => window.exportModule.latestExport();
  const validateButton = document.createElement('button');
  validateButton.id = 'validatePacketButton';
  validateButton.textContent = 'Validate packet';
  validateButton.onclick = () => window.exportModule.validatePacket();
  controls.appendChild(jsonButton);
  controls.appendChild(mdButton);
  controls.appendChild(browseButton);
  controls.appendChild(latestButton);
  controls.appendChild(validateButton);
}

window.exportModule = {
  async buildPacket() {
    return buildResearchPacket();
  },
  async exportPacket() {
    return exportResearchPacket();
  },
  async validatePacket() {
    return validateCurrentPacket();
  },
  async copyJson() {
    return copyResearchPacketJson();
  },
  async copyMarkdown() {
    return copyResearchPacketMarkdown();
  },
  async browseFiles() {
    return renderExportFileBrowser();
  },
  async latestExport() {
    return showLatestExport();
  },
  bindControls() {
    window.workstationModuleGuard?.missing?.('export-module', {
      globals: ['buildResearchPacket', 'exportResearchPacket', 'validateCurrentPacket', 'copyResearchPacketJson', 'copyResearchPacketMarkdown', 'renderExportFileBrowser', 'showLatestExport'],
      elements: ['exportControls'],
    });
    addPacketPreviewControls();
    const exportButton = document.querySelector('#exportControls button:first-child');
    if (exportButton) exportButton.onclick = () => window.exportModule.exportPacket();
    const listButton = document.querySelector('#exportControls button:nth-child(2)');
    if (listButton) listButton.onclick = () => window.exportModule.browseFiles();
    const copyJson = document.getElementById('copyPacketJsonButton');
    if (copyJson) copyJson.onclick = () => window.exportModule.copyJson();
    const copyMarkdown = document.getElementById('copyPacketMarkdownButton');
    if (copyMarkdown) copyMarkdown.onclick = () => window.exportModule.copyMarkdown();
    const browse = document.getElementById('browseExportsButton');
    if (browse) browse.onclick = () => window.exportModule.browseFiles();
    const latest = document.getElementById('latestExportButton');
    if (latest) latest.onclick = () => window.exportModule.latestExport();
    const validate = document.getElementById('validatePacketButton');
    if (validate) validate.onclick = () => window.exportModule.validatePacket();
  },
};

if (window.workstationBoot) window.workstationBoot.register('export-module', () => window.exportModule.bindControls());
else setTimeout(() => window.exportModule.bindControls(), 0);
