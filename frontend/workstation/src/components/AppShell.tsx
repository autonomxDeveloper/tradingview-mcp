import type { ElementType } from 'react';
import { useState } from 'react';
import { motion } from 'framer-motion';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import {
  Activity,
  Bot,
  BrainCircuit,
  Brush,
  ChartCandlestick,
  ChevronDown,
  Crosshair,
  Eraser,
  Eye,
  EyeOff,
  Globe2,
  History,
  Laugh,
  Lock,
  Magnet,
  Maximize,
  Menu,
  Minus,
  Moon,
  MousePointer2,
  MoveUpRight,
  Newspaper,
  PanelLeft,
  PanelRight,
  PencilRuler,
  Ruler,
  Search,
  Settings,
  Star,
  Sun,
  TextCursorInput,
  Trash2,
  Unlock,
  WalletCards,
  X,
  ZoomIn,
} from 'lucide-react';
import { useUiStore, type ChartStyle, type ChartTool, type RightPanel } from '@/store/ui-store';
import { Button } from '@/components/ui/button';
import { ChartWorkspace } from '@/components/ChartWorkspace';
import { ResearchPanel } from '@/components/ResearchPanel';
import { BottomConsole } from '@/components/BottomConsole';
import { ExternalExecutionGuard } from '@/components/ExternalExecutionGuard';

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

const chartTools: Array<{ id: ChartTool; label: string; icon: ElementType; dividerBefore?: boolean }> = [
  { id: 'crosshair', label: 'Crosshair', icon: Crosshair },
  { id: 'cursor', label: 'Cursor', icon: MousePointer2 },
  { id: 'trend-line', label: 'Trend line', icon: MoveUpRight, dividerBefore: true },
  { id: 'ray', label: 'Ray', icon: Minus },
  { id: 'horizontal-line', label: 'Horizontal line', icon: Minus },
  { id: 'vertical-line', label: 'Vertical line', icon: PencilRuler },
  { id: 'parallel-channel', label: 'Parallel channel', icon: Maximize },
  { id: 'fib-retracement', label: 'Fib retracement', icon: Ruler, dividerBefore: true },
  { id: 'brush', label: 'Brush', icon: Brush },
  { id: 'text', label: 'Text', icon: TextCursorInput },
  { id: 'emoji', label: 'Emoji', icon: Laugh },
  { id: 'measure', label: 'Measure', icon: Ruler, dividerBefore: true },
  { id: 'zoom', label: 'Zoom', icon: ZoomIn },
  { id: 'magnet', label: 'Magnet', icon: Magnet },
  { id: 'lock', label: 'Lock drawings', icon: Lock, dividerBefore: true },
  { id: 'hide-drawings', label: 'Show/hide drawings', icon: Eye },
  { id: 'global-mode', label: 'Global drawing mode', icon: Globe2 },
  { id: 'delete', label: 'Delete drawings', icon: Trash2, dividerBefore: true },
];

const rightPanelButtons: Array<{ id: RightPanel; label: string; icon: ElementType }> = [
  { id: 'research', label: 'Research', icon: BrainCircuit },
  { id: 'workflow', label: 'AI', icon: Bot },
  { id: 'paper', label: 'Paper', icon: WalletCards },
  { id: 'journal', label: 'Journal', icon: History },
];

function ChartToolsRail() {
  const {
    activeChartTool,
    drawingsVisible,
    chartLocked,
    favoriteChartTools,
    setActiveChartTool,
    toggleFavoriteChartTool,
  } = useUiStore();

  return (
    <nav data-testid="chart-tools-rail" aria-label="Chart tools" className="glass-panel flex h-full w-full flex-col items-center overflow-y-auto rounded-3xl p-2">
      <div data-testid="chart-tools-rail-label" className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Tools</div>
      <div data-testid="chart-tools-list" className="flex w-full flex-col items-center gap-1">
        {chartTools.map(({ id, label, icon: Icon, dividerBefore }) => {
          const isActive = activeChartTool === id;
          const isFavorite = favoriteChartTools.includes(id);
          const ToolIcon = id === 'lock' && chartLocked ? Unlock : id === 'hide-drawings' && !drawingsVisible ? EyeOff : Icon;

          return (
            <div key={id} data-testid={`chart-tool-group-${id}`} className="w-full">
              {dividerBefore && <div data-testid={`chart-tool-divider-${id}`} className="my-2 h-px w-full bg-white/10" />}
              <div className="group relative flex items-center justify-center">
                <Button
                  data-testid={`chart-tool-${id}-button`}
                  variant={isActive ? 'default' : 'terminal'}
                  size="icon"
                  aria-label={label}
                  title={label}
                  onClick={() => setActiveChartTool(id)}
                  className="h-10 w-10"
                >
                  <ToolIcon size={17} />
                </Button>
                <button
                  data-testid={`chart-tool-${id}-favorite-button`}
                  type="button"
                  aria-label={`Favorite ${label}`}
                  title={`Favorite ${label}`}
                  onClick={() => toggleFavoriteChartTool(id)}
                  className="absolute -right-1 -top-1 hidden h-4 w-4 place-items-center rounded-full border border-white/10 bg-background text-[9px] text-muted-foreground group-hover:grid"
                >
                  <Star size={10} className={isFavorite ? 'fill-current text-primary' : ''} />
                </button>
              </div>
            </div>
          );
        })}
      </div>
      <div data-testid="chart-tools-status" className="mt-auto pt-3 text-center text-[10px] text-muted-foreground">
        <div data-testid="active-chart-tool-label">{activeChartTool.replaceAll('-', ' ')}</div>
        <div data-testid="chart-drawings-visibility-label">{drawingsVisible ? 'visible' : 'hidden'}</div>
      </div>
    </nav>
  );
}

export function AppShell() {
  const [executionGuardOpen, setExecutionGuardOpen] = useState(false);
  const {
    timeframe,
    chartStyle,
    themeMode,
    leftOpen,
    rightOpen,
    bottomOpen,
    rightPanel,
    setTimeframe,
    setChartStyle,
    toggleThemeMode,
    toggleLeft,
    toggleRight,
    toggleBottom,
    setRightPanel,
  } = useUiStore();

  const toolbarButtonVariant = (panel: RightPanel) => (rightOpen && rightPanel === panel ? 'default' : 'terminal');
  const isDayMode = themeMode === 'day';

  return (
    <div data-testid="workstation-shell" data-theme={themeMode} className={`${isDayMode ? 'theme-day' : 'theme-night'} flex h-full min-h-0 flex-col overflow-hidden bg-background p-3 text-foreground`}>
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
        <div data-testid="header-actions" className="flex items-center gap-2">
          <Button data-testid="toggle-theme-mode-button" variant="terminal" size="icon" onClick={toggleThemeMode} aria-label={isDayMode ? 'Switch to night mode' : 'Switch to day mode'} title={isDayMode ? 'Night mode' : 'Day mode'}>
            {isDayMode ? <Moon size={17} /> : <Sun size={17} />}
          </Button>
          <Button data-testid="toggle-chart-tools-button" variant="terminal" size="icon" onClick={toggleLeft} aria-label="Toggle chart tools"><PanelLeft size={17} /></Button>
          <Button data-testid="toggle-right-drawer-button" variant="terminal" size="icon" onClick={() => toggleRight()} aria-label="Toggle research"><PanelRight size={17} /></Button>
          <Button data-testid="toggle-console-button" variant="terminal" size="icon" onClick={toggleBottom} aria-label="Toggle console"><Menu size={17} /></Button>
          <Button data-testid="toggle-external-execution-guard-button" variant={executionGuardOpen ? 'default' : 'terminal'} size="icon" onClick={() => setExecutionGuardOpen((value) => !value)} aria-label="Toggle external execution guard"><Lock size={17} /></Button>
          <Button data-testid="run-scan-button" size="sm"><Search size={15} /> Run scan</Button>
        </div>
      </header>

      <div data-testid="workstation-toolbar" className="mb-3 flex shrink-0 items-center justify-between gap-3 rounded-3xl border border-white/10 bg-black/20 px-3 py-2 backdrop-blur-xl theme-day:border-slate-200 theme-day:bg-white/80">
        <div data-testid="toolbar-left-actions" className="flex min-w-0 items-center gap-2 overflow-x-auto">
          <label data-testid="timeframe-select-control" className="relative flex shrink-0 items-center gap-2 rounded-full border border-white/10 bg-white/[0.045] px-3 py-2 text-sm font-semibold text-foreground shadow-sm shadow-black/10 theme-day:border-slate-200 theme-day:bg-white">
            <span data-testid="timeframe-select-label" className="text-xs uppercase tracking-[0.18em] text-muted-foreground">TF</span>
            <select data-testid="timeframe-select" aria-label="Timeframe" className="min-w-16 cursor-pointer appearance-none bg-transparent pr-6 text-sm font-semibold outline-none" value={timeframe} onChange={(event) => setTimeframe(event.target.value)}>
              {timeframes.map((item) => <option key={item} data-testid={`timeframe-option-${item.toLowerCase()}`} value={item}>{item}</option>)}
            </select>
            <ChevronDown data-testid="timeframe-select-icon" size={15} className="pointer-events-none absolute right-3 text-muted-foreground" />
          </label>
          <label data-testid="chart-style-select-control" className="relative flex shrink-0 items-center gap-2 rounded-full border border-white/10 bg-white/[0.045] px-3 py-2 text-sm font-semibold text-foreground shadow-sm shadow-black/10 theme-day:border-slate-200 theme-day:bg-white">
            <ChartCandlestick data-testid="chart-style-select-glyph" size={15} className="text-muted-foreground" />
            <span data-testid="chart-style-select-label" className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Type</span>
            <select data-testid="chart-style-select" aria-label="Chart style" className="min-w-36 cursor-pointer appearance-none bg-transparent pr-6 text-sm font-semibold outline-none" value={chartStyle} onChange={(event) => setChartStyle(event.target.value as ChartStyle)}>
              {chartStyles.map((item) => <option key={item.id} data-testid={`chart-style-option-${item.id}`} value={item.id}>{item.label}</option>)}
            </select>
            <ChevronDown data-testid="chart-style-select-icon" size={15} className="pointer-events-none absolute right-3 text-muted-foreground" />
          </label>
          <span data-testid="toolbar-divider" className="mx-2 h-6 w-px bg-white/10 theme-day:bg-slate-200" />
          <Button data-testid="toolbar-indicators-button" size="sm" variant={toolbarButtonVariant('indicators')} onClick={() => setRightPanel('indicators')}><Activity size={15} /> Indicators</Button>
          <Button data-testid="toolbar-news-button" size="sm" variant={toolbarButtonVariant('news')} onClick={() => setRightPanel('news')}><Newspaper size={15} /> News</Button>
          <Button data-testid="toolbar-layout-button" size="sm" variant={toolbarButtonVariant('layout')} onClick={() => setRightPanel('layout')}><Settings size={15} /> Layout</Button>
        </div>
        <div data-testid="workstation-shell-caption" className="hidden text-xs text-muted-foreground md:block">Chart tools + AI research workspace</div>
      </div>

      {executionGuardOpen && (
        <motion.div data-testid="external-execution-guard-region" initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-3 shrink-0">
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1"><ExternalExecutionGuard /></div>
            <Button data-testid="close-external-execution-guard-button" variant="terminal" size="icon" aria-label="Close external execution guard" onClick={() => setExecutionGuardOpen(false)}><X size={16} /></Button>
          </div>
        </motion.div>
      )}

      <PanelGroup data-testid="main-panel-group" direction="horizontal" className="min-h-0 flex-1">
        {leftOpen && (
          <Panel data-testid="chart-tools-panel-region" defaultSize={5} minSize={4} maxSize={7} className="min-w-[64px] max-w-[86px]">
            <motion.div data-testid="chart-tools-panel-motion" initial={{ opacity: 0, x: -18 }} animate={{ opacity: 1, x: 0 }} className="h-full pr-3">
              <ChartToolsRail />
            </motion.div>
          </Panel>
        )}
        {leftOpen && <PanelResizeHandle data-testid="chart-tools-resize-handle" className="w-1 rounded-full bg-white/10 transition hover:bg-primary/50 theme-day:bg-slate-200" />}

        <Panel data-testid="chart-panel-region" minSize={35} className="min-w-0 px-3">
          <ChartWorkspace />
        </Panel>

        {rightOpen && <PanelResizeHandle data-testid="right-drawer-resize-handle" className="w-1 rounded-full bg-white/10 transition hover:bg-primary/50 theme-day:bg-slate-200" />}
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
