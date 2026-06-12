import { useMemo } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Activity, BrainCircuit, ClipboardList, History, LayoutPanelTop, LineChart, Newspaper, WalletCards } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { inferAssetType, workstationApi } from '@/lib/api';
import { useUiStore, type RightPanel } from '@/store/ui-store';

const panelTitles: Record<RightPanel, string> = {
  research: 'AI Research',
  workflow: 'AI Workflow',
  paper: 'Paper Trading',
  journal: 'Journal',
  indicators: 'Indicators',
  news: 'News',
  layout: 'Layout',
};

function PanelIcon({ panel }: { panel: RightPanel }) {
  if (panel === 'research') return <BrainCircuit size={16} className="text-primary" />;
  if (panel === 'workflow') return <ClipboardList size={16} className="text-primary" />;
  if (panel === 'paper') return <WalletCards size={16} className="text-primary" />;
  if (panel === 'journal') return <History size={16} className="text-primary" />;
  if (panel === 'indicators') return <Activity size={16} className="text-primary" />;
  if (panel === 'news') return <Newspaper size={16} className="text-primary" />;
  return <LayoutPanelTop size={16} className="text-primary" />;
}

export function ResearchPanel({ panel }: { panel: RightPanel }) {
  const { symbol, timeframe, assetType, exchange, leftOpen, rightOpen, bottomOpen, toggleLeft, toggleRight, toggleBottom } = useUiStore();
  const resolvedAssetType = inferAssetType(symbol, assetType);
  const resolvedExchange = resolvedAssetType === 'crypto' ? exchange || 'BINANCE' : exchange || 'NASDAQ';
  const analyze = useMutation<Record<string, unknown>, Error>({
    mutationFn: () => workstationApi.analyze({
      symbol,
      asset_type: resolvedAssetType,
      exchange: resolvedExchange,
      timeframe,
      question: 'Give observations, risks, invalidation levels, and what to backtest next.',
    }),
  });
  const analysisText = useMemo(() => analyze.data ? JSON.stringify(analyze.data, null, 2) : '', [analyze.data]);
  const paper = useQuery({ queryKey: ['paper-account'], queryFn: workstationApi.paperAccount, enabled: panel === 'paper' });
  const ideas = useQuery({ queryKey: ['ideas'], queryFn: workstationApi.ideas, enabled: panel === 'workflow' || panel === 'news' });
  const journal = useQuery({ queryKey: ['journal'], queryFn: workstationApi.journal, enabled: panel === 'journal' });

  return (
    <Card className="flex h-full min-w-0 flex-1 flex-col overflow-hidden rounded-3xl">
      <CardHeader className="border-b border-white/10">
        <CardTitle className="flex items-center gap-2">
          <PanelIcon panel={panel} />
          {panelTitles[panel]}
        </CardTitle>
      </CardHeader>
      <CardContent className="min-h-0 flex-1 overflow-auto p-4">
        {panel === 'research' && (
          <div className="space-y-4">
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
              <div className="text-sm font-semibold">Analyze {symbol}</div>
              <p className="mt-1 text-xs text-muted-foreground">Risk-first {resolvedAssetType} research using the existing LM Studio endpoint.</p>
              <Button className="mt-4 w-full" onClick={() => analyze.mutate()} disabled={analyze.isPending}>
                <BrainCircuit size={16} /> {analyze.isPending ? 'Analyzing...' : 'Analyze current symbol'}
              </Button>
            </div>
            {analysisText && <pre className="max-h-96 overflow-auto rounded-2xl bg-black/35 p-3 text-xs text-muted-foreground">{analysisText}</pre>}
            {analyze.error && <div className="rounded-2xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{analyze.error.message}</div>}
          </div>
        )}

        {panel === 'workflow' && (
          <div className="space-y-3">
            {['Scan market context', 'Generate research thesis', 'Backtest candidate', 'Save research packet'].map((step, index) => (
              <div key={step} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-3">
                <div className="grid h-8 w-8 place-items-center rounded-full bg-primary/15 text-xs font-bold text-primary">{index + 1}</div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium">{step}</div>
                  <div className="text-xs text-muted-foreground">Composable workflow action</div>
                </div>
                <Button variant="terminal" size="sm">Run</Button>
              </div>
            ))}
            <pre className="max-h-72 overflow-auto rounded-2xl bg-black/35 p-3 text-xs text-muted-foreground">{JSON.stringify(ideas.data ?? { ideas: [] }, null, 2)}</pre>
          </div>
        )}

        {panel === 'paper' && (
          <div className="space-y-4">
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
              <div className="flex items-center gap-2 text-sm font-semibold"><LineChart size={15} /> Paper account</div>
              <p className="mt-1 text-xs text-muted-foreground">Simulation-only paper trading state.</p>
            </div>
            <pre className="max-h-96 overflow-auto rounded-2xl bg-black/35 p-3 text-xs text-muted-foreground">{JSON.stringify(paper.data ?? {}, null, 2)}</pre>
          </div>
        )}

        {panel === 'journal' && (
          <pre className="max-h-full overflow-auto rounded-2xl bg-black/35 p-3 text-xs text-muted-foreground">{JSON.stringify(journal.data ?? { events: [] }, null, 2)}</pre>
        )}

        {panel === 'indicators' && (
          <div className="space-y-3">
            {['Moving averages', 'RSI / momentum', 'Volume profile', 'Support and resistance'].map((indicator) => (
              <button key={indicator} type="button" className="w-full rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-left transition hover:border-primary/40 hover:bg-primary/10">
                <div className="text-sm font-medium">{indicator}</div>
                <div className="mt-1 text-xs text-muted-foreground">Open indicator controls for {symbol} on {timeframe}.</div>
              </button>
            ))}
            <p className="rounded-2xl border border-primary/20 bg-primary/10 p-3 text-xs text-muted-foreground">These controls are now interactive entry points; indicator overlays can be attached here as chart overlay support is expanded.</p>
          </div>
        )}

        {panel === 'news' && (
          <div className="space-y-3">
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
              <div className="flex items-center gap-2 text-sm font-semibold"><Newspaper size={15} /> Market news for {symbol}</div>
              <p className="mt-1 text-xs text-muted-foreground">News and saved research ideas are grouped here for the current symbol.</p>
            </div>
            <pre className="max-h-96 overflow-auto rounded-2xl bg-black/35 p-3 text-xs text-muted-foreground">{JSON.stringify(ideas.data ?? { ideas: [] }, null, 2)}</pre>
          </div>
        )}

        {panel === 'layout' && (
          <div className="space-y-3">
            <button type="button" onClick={toggleLeft} className="flex w-full items-center justify-between rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-left transition hover:border-primary/40 hover:bg-primary/10">
              <span>
                <span className="block text-sm font-medium">Watchlist panel</span>
                <span className="text-xs text-muted-foreground">Show or hide the left watchlist.</span>
              </span>
              <span className="text-xs font-semibold text-primary">{leftOpen ? 'Open' : 'Closed'}</span>
            </button>
            <button type="button" onClick={() => toggleRight()} className="flex w-full items-center justify-between rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-left transition hover:border-primary/40 hover:bg-primary/10">
              <span>
                <span className="block text-sm font-medium">Right drawer</span>
                <span className="text-xs text-muted-foreground">Show or hide research, workflow, news, and tools.</span>
              </span>
              <span className="text-xs font-semibold text-primary">{rightOpen ? 'Open' : 'Closed'}</span>
            </button>
            <button type="button" onClick={toggleBottom} className="flex w-full items-center justify-between rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-left transition hover:border-primary/40 hover:bg-primary/10">
              <span>
                <span className="block text-sm font-medium">Console panel</span>
                <span className="text-xs text-muted-foreground">Show or hide payload, journal, and diagnostics tabs.</span>
              </span>
              <span className="text-xs font-semibold text-primary">{bottomOpen ? 'Open' : 'Closed'}</span>
            </button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
