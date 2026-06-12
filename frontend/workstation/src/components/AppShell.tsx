import { motion } from 'framer-motion';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { Activity, Bot, BrainCircuit, ChartCandlestick, History, Menu, Newspaper, PanelLeft, PanelRight, Play, Search, Settings, WalletCards } from 'lucide-react';
import { useUiStore, type RightPanel } from '@/store/ui-store';
import { Button } from '@/components/ui/button';
import { WatchlistPanel } from '@/components/WatchlistPanel';
import { ChartWorkspace } from '@/components/ChartWorkspace';
import { ResearchPanel } from '@/components/ResearchPanel';
import { BottomConsole } from '@/components/BottomConsole';

const timeframes = ['1m', '5m', '15m', '1h', '2h', '1D', '1W', '2W'];

const rightPanelButtons: Array<{ id: RightPanel; label: string; icon: React.ElementType }> = [
  { id: 'research', label: 'Research', icon: BrainCircuit },
  { id: 'workflow', label: 'AI', icon: Bot },
  { id: 'paper', label: 'Paper', icon: WalletCards },
  { id: 'journal', label: 'Journal', icon: History },
];

export function AppShell() {
  const {
    symbol,
    timeframe,
    exchange,
    leftOpen,
    rightOpen,
    bottomOpen,
    rightPanel,
    setSymbol,
    setTimeframe,
    setExchange,
    toggleLeft,
    toggleRight,
    toggleBottom,
    setRightPanel,
  } = useUiStore();

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden p-3 text-foreground">
      <header className="glass-panel mb-3 flex h-16 shrink-0 items-center justify-between rounded-3xl px-4">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-2xl bg-primary/15 text-primary shadow-lg shadow-primary/10">
            <ChartCandlestick size={20} />
          </div>
          <div>
            <div className="text-sm font-semibold uppercase tracking-[0.28em] text-muted-foreground">Autonomx</div>
            <div className="text-lg font-semibold">Trading Research Workstation</div>
          </div>
        </div>
        <div className="hidden items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.045] px-3 py-2 lg:flex">
          <Search size={16} className="text-muted-foreground" />
          <input className="w-28 bg-transparent text-sm font-semibold outline-none" value={symbol} onChange={(event) => setSymbol(event.target.value)} />
          <span className="h-5 w-px bg-white/10" />
          <input className="w-24 bg-transparent text-xs uppercase text-muted-foreground outline-none" value={exchange} onChange={(event) => setExchange(event.target.value)} />
        </div>
        <div className="flex items-center gap-2">
          <Button variant="terminal" size="icon" onClick={toggleLeft} aria-label="Toggle watchlist"><PanelLeft size={17} /></Button>
          <Button variant="terminal" size="icon" onClick={() => toggleRight()} aria-label="Toggle research"><PanelRight size={17} /></Button>
          <Button variant="terminal" size="icon" onClick={toggleBottom} aria-label="Toggle console"><Menu size={17} /></Button>
          <Button size="sm"><Play size={15} /> Run scan</Button>
        </div>
      </header>

      <div className="mb-3 flex shrink-0 items-center justify-between gap-3 rounded-3xl border border-white/10 bg-black/20 px-3 py-2 backdrop-blur-xl">
        <div className="flex items-center gap-1 overflow-x-auto">
          {timeframes.map((item) => (
            <Button key={item} size="sm" variant={item === timeframe ? 'default' : 'terminal'} onClick={() => setTimeframe(item)}>{item}</Button>
          ))}
          <span className="mx-2 h-6 w-px bg-white/10" />
          <Button size="sm" variant="terminal"><Activity size={15} /> Indicators</Button>
          <Button size="sm" variant="terminal"><Newspaper size={15} /> News</Button>
          <Button size="sm" variant="terminal"><Settings size={15} /> Layout</Button>
        </div>
        <div className="hidden text-xs text-muted-foreground md:block">React + TypeScript workstation shell</div>
      </div>

      <PanelGroup direction="horizontal" className="min-h-0 flex-1">
        {leftOpen && (
          <Panel defaultSize={20} minSize={15} maxSize={30} className="min-w-[220px]">
            <motion.div initial={{ opacity: 0, x: -18 }} animate={{ opacity: 1, x: 0 }} className="h-full pr-3">
              <WatchlistPanel />
            </motion.div>
          </Panel>
        )}
        {leftOpen && <PanelResizeHandle className="w-1 rounded-full bg-white/10 transition hover:bg-primary/50" />}

        <Panel minSize={35} className="min-w-0 px-3">
          <ChartWorkspace />
        </Panel>

        {rightOpen && <PanelResizeHandle className="w-1 rounded-full bg-white/10 transition hover:bg-primary/50" />}
        {rightOpen && (
          <Panel defaultSize={27} minSize={21} maxSize={40} className="min-w-[320px]">
            <motion.aside initial={{ opacity: 0, x: 22 }} animate={{ opacity: 1, x: 0 }} className="flex h-full gap-3 pl-3">
              <div className="glass-panel flex w-14 shrink-0 flex-col items-center gap-2 rounded-3xl p-2">
                {rightPanelButtons.map(({ id, label, icon: Icon }) => (
                  <Button key={id} variant={rightPanel === id ? 'default' : 'terminal'} size="icon" aria-label={label} onClick={() => setRightPanel(id)}>
                    <Icon size={17} />
                  </Button>
                ))}
              </div>
              <ResearchPanel panel={rightPanel} />
            </motion.aside>
          </Panel>
        )}
      </PanelGroup>

      {bottomOpen && (
        <motion.div initial={{ opacity: 0, y: 22 }} animate={{ opacity: 1, y: 0 }} className="mt-3 h-56 shrink-0">
          <BottomConsole />
        </motion.div>
      )}
    </div>
  );
}
