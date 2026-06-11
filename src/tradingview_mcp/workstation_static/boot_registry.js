window.workstationBoot = window.workstationBoot || {
  callbacks: [],
  ran: new Set(),
  hasRun: false,
  runOne(name, fn) {
    if (!name || typeof fn !== 'function' || this.ran.has(name)) return;
    this.ran.add(name);
    try { fn(); }
    catch (error) { console.error(`workstation boot failed: ${name}`, error); }
  },
  register(name, fn) {
    if (!name || typeof fn !== 'function' || this.ran.has(name)) return;
    if (this.hasRun || document.readyState !== 'loading') {
      this.runOne(name, fn);
      return;
    }
    this.callbacks.push({ name, fn });
  },
  run() {
    this.hasRun = true;
    const pending = [...this.callbacks];
    this.callbacks = [];
    pending.forEach(({ name, fn }) => this.runOne(name, fn));
  },
};

document.addEventListener('DOMContentLoaded', () => window.workstationBoot.run());
window.addEventListener('load', () => window.workstationBoot.run());
