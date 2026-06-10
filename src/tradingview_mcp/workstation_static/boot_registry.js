window.workstationBoot = window.workstationBoot || {
  callbacks: [],
  ran: new Set(),
  register(name, fn) {
    if (!name || typeof fn !== 'function' || this.ran.has(name)) return;
    this.callbacks.push({ name, fn });
  },
  run() {
    const pending = [...this.callbacks];
    this.callbacks = [];
    pending.forEach(({ name, fn }) => {
      if (this.ran.has(name)) return;
      this.ran.add(name);
      try { fn(); }
      catch (error) { console.error(`workstation boot failed: ${name}`, error); }
    });
  },
};

document.addEventListener('DOMContentLoaded', () => window.workstationBoot.run());
window.addEventListener('load', () => window.workstationBoot.run());
