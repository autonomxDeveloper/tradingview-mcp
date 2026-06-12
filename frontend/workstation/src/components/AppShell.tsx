import type { ElementType } from 'react';
import { motion } from 'framer-motion';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { Activity, Bot, BrainCircuit, ChartCandlestick, ChevronDown, History, Menu, Newspaper, PanelLeft, PanelRight, Play, Search, Settings, WalletCards } from 'lucide-react';
import { useUiStore, type ChartStyle, type RightPanel } from '@/store/ui-store';
import { Button } from '@/components/ui/button';
import { WatchlistPanel } from '@/components/WatchlistPanel';
import { ChartWorkspace } from '@/components/ChartWorkspace';
import { ResearchPanel } from '@/components/ResearchPanel';
import { BottomConsole } from '@/components/BottomConsole';

const timeframes = ['1m', '5m', '15m', '1h', '2h', '1D', '1W', '2W'];

const chartStyles: Array<{ id: ChartStyle; label: string }> = [
  { id: 'bars', label: 'Bars' },
  { id: 'candles', label: 'Candles' },
  { id: 'hollow-candles', label: 'Hollow candles' },
  { id: 'volume-candles', label: 'Volume candles' },
  { id: 'line', label: 'Line' },
  { id: 'line-with-markers', label: 'Line with markers' },
  { id: 'step-line', label: 'Step line' },
  { id: 'area', label: 'Area' },
  { id: 'hlc-area', label: 'HLC area' },
  { id: 'baseline', label: 'Baseline' },
  { id: 'columns', label: 'Columns' },
  { id: 'high-low', label: 'High-low' },
  { id: 'volume-footprint', label: 'Volume footprint' },
  { id: 'time-price-opportunity', label: 'Time price opportunity' },
  { id: 'session-volume-profile', label: 'Session volume profile' },
  { id: 'heikin-ashi', label: 'Heikin Ashi' },
  { id: 'renko', label: 'Renko' },
  { id: 'line-break', label: 'Line break' },
];

const rightPanelButtons: Array<{ id: RightPanel; label: string; icon: ElementType }> = [
  { id: 'research', label: 'Research', icon: BrainCircuit },
  { id: 'workflow', label: 'AI', icon: Bot },
  { id: 'paper', label: 'Paper', icon: WalletCards },
  { id: 'journal', label: 'Journal', icon: History },
];

export function AppShell() {
  const {
    symbol,
    timeframe,
    chartStyle,
    exchange,
    leftOpen,
    rightOpen,
    bottomOpen,
    rightPanel,
    setSymbol,
    setTimeframe,
    setChartStyle,
    setExchange,
    toggleLeft,
    toggleRight,
    toggleBottom,
    setRightPanel,
  } = useUiStore();

  const toolbarButtonVariant = (panel: RightPanel) => (rightOpen && rightPanel === panel ? 'default' : 'terminal');

  return (
    <div data-testid="workstation-shell" className="flex h-full min-h-0 flex-col overflow-hidden p-3 text-foreground">
      <header data-testid="workstation-header" className="glass-panel mb-3 flex h-16 shrink-0 items-center justify-between rounded-3xl px-4">
        <div data-testid="workstation-brand" className="flex items-center gap-3">
          <div data-testid="workstation-brand-icon" className="grid h-10 w-10 place-items-center rounded-2xl bg-primary/15 text-primary shadow-lg shadow-primary/10">
            <ChartCandlestick size={20} />
          </div>
          <div data-testid="workstation-title-block">
            <div data-testid="workstation-brand-name" className="text-sm font-semibold uppercase tracking-[0.28em] text-muted-foreground">Autonomx</div>
            <div data-testid="workstation-title" className="text-lg font-semibold">Trading Research Workstation</div>
          </div>
        </div>
        <div data-testid="symbol-search-control" className="hidden items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.045] px-3 py-2 lg:flex">
          <Search size={16} className="text-muted-foreground" />
          <input data-testid="symbol-input" aria-label="Symbol" className="w-28 bg-transparent text-sm font-semibold outline-none" value={symbol} onChange={(event) => setSymbol(event.target.value)} />
          <span data-testid="symbol-exchange-separator" className="h-5 w-px bg-white/10" />
          <input data-testid="exchange-input" aria-label="Exchange" className="w-24 bg-transparent text-xs uppercase text-muted-foreground outline-none" value={exchange} onChange={(event) => setExchange(event.target.value)} />
        </div>
        <div data-testid="header-actions" className="flex items-center gap-2">
          <Button data-testid="toggle-watchlist-button" variant="terminal" size="icon" onClick={toggleLeft} aria-label="Toggle watchlist"><PanelLeft size={17} /></Button>
          <Button data-testid="toggle-right-drawer-button" variant="terminal" size="icon" onClick={() => toggleRight()} aria-label="Toggle research"><PanelRight size={17} /></Button>
          <Button data-testid="toggle-console-button" variant="terminal" size="icon" onClick={toggleBottom} aria-label="Toggle console"><Menu size={17} /></Button>
          <Button data-testid="run-scan-button" size="sm"><Play size={15} /> Run scan</Button>
        </div>
      </header>

      <div data-testid="workstation-toolbar" className="mb-3 flex shrink-0 items-center justify-between gap-3 rounded-3xl border border-white/10 bg-black/20 px-3 py-2 backdrop-blur-xl">
        <div data-testid="toolbar-left-actions" className="flex min-w-0 items-center gap-2 overflow-x-auto">
          <label data-testid="timeframe-select-control" className="relative flex shrink-0 items-center gap-2 rounded-full border border-white/10 bg-white/[0.045] px-3 py-2 text-sm font-semibold text-foreground shadow-sm shadow-black/10">
            <span data-testid="timeframe-select-label" className="text-xs uppercase tracking-[0.18em] text-muted-foreground">TF</span>
            <select
              data-testid="timeframe-select"
              aria-label="Timeframe"
              className="min-w-16 cursor-pointer appearance-none bg-transparent pr-6 text-sm font-semibold outline-none"
              value={timeframe}
              onChange={(event) => setTimeframe(event.target.value)}
            >
              {timeframes.map((item) => (
                <option key={item} data-testid={`timeframe-option-${item.toLowerCase()}`} value={item}>{item}</option>
              ))}
            </select>
            <ChevronDown data-testid="timeframe-select-icon" size={15} className="pointer-events-none absolute right-3 text-muted-foreground" />
          </label>
          <label data-testid="chart-style-select-control" className="relative flex shrink-0 items-center gap-2 rounded-full border border-white/10 bg-white/[0.045] px-3 py-2 text-sm font-semibold text-foreground shadow-sm shadow-black/10">
            <ChartCandlestick data-testid="chart-style-select-glyph" size={15} className="text-muted-foreground" />
            <span data-testid="chart-style-select-label" className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Type</span>
            <select
              data-testid="chart-style-select"
              aria-label="Chart style"
              className="min-w-36 cursor-pointer appearance-none bg-transparent pr-6 text-sm font-semibold outline-none"
              value={chartStyle}
              onChange={(event) => setChartStyle(event.target.value as ChartStyle)}
            >
              {chartStyles.map((item) => (
                <option key={item.id} data-testid={`chart-style-option-${item.id}`} value={item.id}>{item.label}</option>
              ))}
            </select>
            <ChevronDown data-testid="chart-style-select-icon" size={15} className="pointer-events-none absolute right-3 text-muted-foreground" />
          </label>
          <span data-testid="toolbar-divider" className="mx-2 h-6 w-px bg-white/10" />
          <Button data-testid="toolbar-indicators-button" size="sm" variant={toolbarButtonVariant('indicators')} onClick={() => setRightPanel('indicators')}><Activity size={15} /> Indicators</Button>
          <Button data-testid="toolbar-news-button" size="sm" variant={toolbarButtonVariant('news')} onClick={() => setRightPanel('news')}><Newspaper size={15} /> News</Button>
          <Button data-testid="toolbar-layout-button" size="sm" variant={toolbarButtonVariant('layout')} onClick={() => setRightPanel('layout')}><Settings size={15} /> Layout</Button>
        </div>
        <div data-testid="workstation-shell-caption" className="hidden text-xs text-muted-foreground md:block">React + TypeScript workstation shell</div>
      </div>

      <PanelGroup data-testid="main-panel-group" direction="horizontal" className="min-h-0 flex-1">
        {leftOpen && (
          <Panel data-testid="watchlist-panel-region" defaultSize={20} minSize={15} maxSize={30} className="min-w-[220px]">
            <motion.div data-testid="watchlist-panel-motion" initial={{ opacity: 0, x: -18 }} animate={{ opacity: 1, x: 0 }} className="h-full pr-3">
              <WatchlistPanel />
            </motion.div>
          </Panel>
        )}
        {leftOpen && <PanelResizeHandle data-testid="watchlist-resize-handle" className="w-1 rounded-full bg-white/10 transition hover:bg-primary/50" />}

        <Panel data-testid="chart-panel-region" minSize={35} className="min-w-0 px-3">
          <ChartWorkspace />
        </Panel>

        {rightOpen && <PanelResizeHandle data-testid="right-drawer-resize-handle" className="w-1 rounded-full bg-white/10 transition hover:bg-primary/50" />}
        {rightOpen && (
          <Panel data-testid="right-drawer-region" defaultSize={27} minSize={21} maxSize={40} className="min-w-[320px]">
            <motion.aside data-testid="right-drawer" initial={{ opacity: 0, x: 22 }} animate={{ opacity: 1, x: 0 }} className="flex h-full gap-3 pl-3">
              <div data-testid="right-drawer-rail" className="glass-panel flex w-14 shrink-0 flex-col items-center gap-2 rounded-3xl p-2">
                {rightPanelButtons.map(({ id, label, icon: Icon }) => (
                  <Button key={id} data-testid={`right-rail-${id}-button`} variant={rightPanel === id ? 'default' : 'terminal'} size="icon" aria-label={label} onClick={() => setRightPanel(id)}>
                    <Icon size={17} />
                  </Button>
                ))}
              </div>
              <ResearchPanel panel={rightPanel} />
            </motion.aside>
          </Panel>
        )}
      </PanelGroup>

      {bottomOpen ? (
        <motion.div data-testid="bottom-console-region" initial={{ opacity: 0, y: 22 }} animate={{ opacity: 1, y: 0 }} className="mt-3 h-56 shrink-0">
          <BottomConsole onCollapse={toggleBottom} />
        </motion.div>
      ) : (
        <div data-testid="bottom-console-collapsed-region" className="mt-3 flex shrink-0 justify-end">
          <Button data-testid="open-console-button" variant="terminal" size="sm" onClick={toggleBottom} aria-label="Open console">
            <Menu size={15} /> Console
          </Button>
        </div>
      )}
    </div>
  );
}