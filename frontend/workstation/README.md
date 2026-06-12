# React trading workstation frontend

This directory is the new professional workstation UI foundation.

Stack:

- React + TypeScript + Vite
- Tailwind CSS
- shadcn-style components backed by Radix primitives
- Framer Motion animations
- Zustand UI state
- TanStack Query API state
- TradingView Lightweight Charts wrapped in React
- React Resizable Panels for docked panels
- Lucide React icons
- Vitest component/state tests
- Playwright configuration for browser behavior tests

## Local development

Run the Python workstation API on port `8088`, then run the React dev server:

```bash
cd frontend/workstation
npm install
npm run dev
```

The Vite dev server proxies `/api` requests to `http://127.0.0.1:8088`.

## Build

```bash
cd frontend/workstation
npm run build
```

The production build is emitted to:

```text
src/tradingview_mcp/workstation_react_static
```

The current legacy static UI remains available while this React app is migrated section by section.
