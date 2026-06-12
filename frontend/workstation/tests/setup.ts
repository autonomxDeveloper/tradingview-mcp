import '@testing-library/jest-dom/vitest';

Object.defineProperty(HTMLElement.prototype, 'ResizeObserver', {
  configurable: true,
  value: class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
});
