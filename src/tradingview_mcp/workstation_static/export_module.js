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
