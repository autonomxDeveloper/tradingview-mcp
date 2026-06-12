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

type StructuredAnalysis = {
  parsed?: boolean;
  summary?: unknown;
  trend?: unknown;
  key_levels?: unknown;
  risks?: unknown;
  invalidation?: unknown;
  backtest_ideas?: unknown;
  confidence?: unknown;
  raw?: unknown;
};

type AnalysisPayload = {
  analysis?: {
    content?: unknown;
    model?: unknown;
  };
  structured_analysis?: StructuredAnalysis;
};

type AnalysisView = {
  summary: string;
  trend: string;
  keyLevels: string[];
  risks: string[];
  invalidation: string;
  backtestIdeas: string[];
  confidence: string;
  model: string;
  fallbackText: string;
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

function toText(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return JSON.stringify(value);
}

function toTextList(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(toText).filter(Boolean);
  const text = toText(value);
  return text ? [text] : [];
}

function parseModelJson(content: string): StructuredAnalysis | null {
  const trimmed = content.trim();
  if (!trimmed) return null;
  const withoutFence = trimmed.startsWith('```')
    ? trimmed.replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim()
    : trimmed;
  try {
    const parsed = JSON.parse(withoutFence);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function buildAnalysisView(payload?: AnalysisPayload): AnalysisView | null {
  if (!payload) return null;
  const modelContent = toText(payload.analysis?.content);
  const structured = payload.structured_analysis?.parsed === false
    ? parseModelJson(modelContent) ?? payload.structured_analysis
    : payload.structured_analysis ?? parseModelJson(modelContent);

  if (!structured) {
    return modelContent
      ? {
          summary: '',
          trend: '',
          keyLevels: [],
          risks: [],
          invalidation: '',
          backtestIdeas: [],
          confidence: '',
          model: toText(payload.analysis?.model),
          fallbackText: modelContent,
        }
      : null;
  }

  return {
    summary: toText(structured.summary),
    trend: toText(structured.trend),
    keyLevels: toTextList(structured.key_levels),
    risks: toTextList(structured.risks),
    invalidation: toText(structured.invalidation),
    backtestIdeas: toTextList(structured.backtest_ideas),
    confidence: toText(structured.confidence),
    model: toText(payload.analysis?.model),
    fallbackText: modelContent,
  };
}

function TextList({ items }: { items: string[] }) {
  if (!items.length) return <div className="text-xs text-muted-foreground">No items returned.</div>;
  return (
    <ul className="space-y-1 text-sm text-muted-foreground">
      {items.map((item, index) => <li key={`${item}-${index}`}>• {item}</li>)}
    </ul>
  );
}

function AnalysisResult({ view }: { view: AnalysisView }) {
  return (
    <div className="space-y-3 rounded-2xl border border-primary/20 bg-primary/10 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-primary">LLM analysis</div>
          {view.model && <div className="mt-1 text-xs text-muted-foreground">Model: {view.model}</div>}
        </div>
        {view.confidence && <span className="rounded-full border border-white/10 bg-black/20 px-2 py-1 text-xs text-muted-foreground">Confidence: {view.confidence}</span>}
      </div>

      {view.summary && (
        <section>
          <div className="mb-1 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Summary</div>
          <p className="text-sm leading-6 text-foreground">{view.summary}</p>
        </section>
      )}

      {view.trend && (
        <section>
          <div className="mb-1 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Trend</div>
          <p className="text-sm leading-6 text-muted-foreground">{view.trend}</p>
        </section>
      )}

      <section>
        <div className="mb-1 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Key levels</div>
        <TextList items={view.keyLevels} />
      </section>

      <section>
        <div className="mb-1 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Risks</div>
        <TextList items={view.risks} />
      </section>

      {view.invalidation && (
        <section>
          <div className="mb-1 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Invalidation</div>
          <p className="text-sm leading-6 text-muted-foreground">{view.invalidation}</p>
        </section>
      )}

      <section>
        <div className="mb-1 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Backtest next</div>
        <TextList items={view.backtestIdeas} />
      </section>

      {!view.summary && view.fallbackText && (
        <pre className="max-h-64 overflow-auto rounded-2xl bg-black/35 p-3 text-xs text-muted-foreground whitespace-pre-wrap">{view.fallbackText}</pre>
      )}
    </div>
  );
}

export function ResearchPanel({ panel }: { panel: RightPanel }) {
  const { symbol, timeframe, assetType, exchange, leftOpen, rightOpen, bottomOpen, toggleLeft, toggleRight, toggleBottom } = useUiStore();
  const resolvedAssetType = inferAssetType(symbol, assetType);
  const resolvedExchange = resolvedAssetType === 'crypto' ? exchange || 'BINANCE' : exchange || 'NASDAQ';
  const analyze = useMutation<AnalysisPayload, Error>({
    mutationFn: () => workstationApi.analyze({
      symbol,
      asset_type: resolvedAssetType,
      exchange: resolvedExchange,
      timeframe,
      question: 'Give observations, risks, invalidation levels, and what to backtest next.',
    }),
  });
  const analysisView = useMemo(() => buildAnalysisView(analyze.data), [analyze.data]);
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
            {analysisView && <AnalysisResult view={analysisView} />}
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
