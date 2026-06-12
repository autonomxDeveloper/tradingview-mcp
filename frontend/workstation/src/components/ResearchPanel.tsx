import { useMemo, useState } from 'react';
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

const workflowSteps = ['Scan market context', 'Generate research thesis', 'Backtest candidate', 'Save research packet'];
const indicatorControls = ['Moving averages', 'RSI / momentum', 'Volume profile', 'Support and resistance'];

function automationId(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

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

type WorkflowResult = {
  step: string;
  status: 'idle' | 'running' | 'done' | 'error';
  message: string;
  data?: unknown;
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

function TextList({ items, testId }: { items: string[]; testId: string }) {
  if (!items.length) return <div data-testid={`${testId}-empty`} className="text-xs text-muted-foreground">No items returned.</div>;
  return (
    <ul data-testid={testId} className="space-y-1 text-sm text-muted-foreground">
      {items.map((item, index) => <li data-testid={`${testId}-item-${index}`} key={`${item}-${index}`}>• {item}</li>)}
    </ul>
  );
}

function AnalysisResult({ view }: { view: AnalysisView }) {
  return (
    <div data-testid="analysis-result-card" className="space-y-3 rounded-2xl border border-primary/20 bg-primary/10 p-4">
      <div data-testid="analysis-result-header" className="flex items-start justify-between gap-3">
        <div data-testid="analysis-result-title-block">
          <div data-testid="analysis-result-title" className="text-sm font-semibold text-primary">LLM analysis</div>
          {view.model && <div data-testid="analysis-model-label" className="mt-1 text-xs text-muted-foreground">Model: {view.model}</div>}
        </div>
        {view.confidence && <span data-testid="analysis-confidence-label" className="rounded-full border border-white/10 bg-black/20 px-2 py-1 text-xs text-muted-foreground">Confidence: {view.confidence}</span>}
      </div>

      {view.summary && (
        <section data-testid="analysis-summary-section">
          <div data-testid="analysis-summary-heading" className="mb-1 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Summary</div>
          <p data-testid="analysis-summary-text" className="text-sm leading-6 text-foreground">{view.summary}</p>
        </section>
      )}

      {view.trend && (
        <section data-testid="analysis-trend-section">
          <div data-testid="analysis-trend-heading" className="mb-1 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Trend</div>
          <p data-testid="analysis-trend-text" className="text-sm leading-6 text-muted-foreground">{view.trend}</p>
        </section>
      )}

      <section data-testid="analysis-key-levels-section">
        <div data-testid="analysis-key-levels-heading" className="mb-1 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Key levels</div>
        <TextList testId="analysis-key-levels-list" items={view.keyLevels} />
      </section>

      <section data-testid="analysis-risks-section">
        <div data-testid="analysis-risks-heading" className="mb-1 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Risks</div>
        <TextList testId="analysis-risks-list" items={view.risks} />
      </section>

      {view.invalidation && (
        <section data-testid="analysis-invalidation-section">
          <div data-testid="analysis-invalidation-heading" className="mb-1 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Invalidation</div>
          <p data-testid="analysis-invalidation-text" className="text-sm leading-6 text-muted-foreground">{view.invalidation}</p>
        </section>
      )}

      <section data-testid="analysis-backtest-section">
        <div data-testid="analysis-backtest-heading" className="mb-1 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Backtest next</div>
        <TextList testId="analysis-backtest-list" items={view.backtestIdeas} />
      </section>

      {!view.summary && view.fallbackText && (
        <pre data-testid="analysis-fallback-text" className="max-h-64 overflow-auto rounded-2xl bg-black/35 p-3 text-xs text-muted-foreground whitespace-pre-wrap">{view.fallbackText}</pre>
      )}
    </div>
  );
}

export function ResearchPanel({ panel }: { panel: RightPanel }) {
  const { symbol, timeframe, assetType, exchange, leftOpen, rightOpen, bottomOpen, toggleLeft, toggleRight, toggleBottom } = useUiStore();
  const [workflowResult, setWorkflowResult] = useState<WorkflowResult | null>(null);
  const [runningWorkflowStep, setRunningWorkflowStep] = useState<string | null>(null);
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

  const runWorkflowStep = async (step: string, index: number) => {
    const stepId = automationId(step);
    setRunningWorkflowStep(stepId);
    setWorkflowResult({ step, status: 'running', message: `Running ${step.toLowerCase()}...` });

    try {
      let data: unknown;
      let message = '';

      if (index === 0) {
        data = await workstationApi.chart(symbol, timeframe, resolvedAssetType, 300);
        message = `Scanned latest ${resolvedAssetType} market context for ${symbol} on ${timeframe}.`;
      } else if (index === 1) {
        data = await analyze.mutateAsync();
        message = `Generated an LLM research thesis for ${symbol}.`;
      } else if (index === 2) {
        data = await workstationApi.backtest({
          symbol,
          strategy: 'sma_cross',
          period: '1y',
          interval: timeframe.toLowerCase(),
        });
        message = `Backtested a candidate SMA crossover setup for ${symbol}.`;
      } else {
        data = {
          symbol,
          asset_type: resolvedAssetType,
          exchange: resolvedExchange,
          timeframe,
          analysis: analyze.data ?? null,
          ideas: ideas.data ?? { ideas: [] },
          saved_at: new Date().toISOString(),
        };
        message = `Built a research packet for ${symbol}.`;
      }

      setWorkflowResult({ step, status: 'done', message, data });
    } catch (error) {
      setWorkflowResult({
        step,
        status: 'error',
        message: error instanceof Error ? error.message : `Failed to run ${step}.`,
      });
    } finally {
      setRunningWorkflowStep(null);
    }
  };

  return (
    <Card data-testid={`right-panel-${panel}`} className="flex h-full min-w-0 flex-1 flex-col overflow-hidden rounded-3xl">
      <CardHeader data-testid={`right-panel-${panel}-header`} className="border-b border-white/10">
        <CardTitle data-testid={`right-panel-${panel}-title`} className="flex items-center gap-2">
          <PanelIcon panel={panel} />
          {panelTitles[panel]}
        </CardTitle>
      </CardHeader>
      <CardContent data-testid={`right-panel-${panel}-content`} className="min-h-0 flex-1 overflow-auto p-4">
        {panel === 'research' && (
          <div data-testid="research-panel-content" className="space-y-4">
            <div data-testid="research-analyze-card" className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
              <div data-testid="research-analyze-title" className="text-sm font-semibold">Analyze {symbol}</div>
              <p data-testid="research-analyze-description" className="mt-1 text-xs text-muted-foreground">Risk-first {resolvedAssetType} research using the existing LM Studio endpoint.</p>
              <Button data-testid="analyze-current-symbol-button" className="mt-4 w-full" onClick={() => analyze.mutate()} disabled={analyze.isPending}>
                <BrainCircuit size={16} /> {analyze.isPending ? 'Analyzing...' : 'Analyze current symbol'}
              </Button>
            </div>
            {analysisView && <AnalysisResult view={analysisView} />}
            {analyze.error && <div data-testid="analysis-error-message" className="rounded-2xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{analyze.error.message}</div>}
          </div>
        )}

        {panel === 'workflow' && (
          <div data-testid="workflow-panel-content" className="space-y-3">
            {workflowSteps.map((step, index) => {
              const stepId = automationId(step);
              const isRunning = runningWorkflowStep === stepId;
              const isLastResult = workflowResult?.step === step;
              return (
                <div key={step} data-testid={`workflow-step-${stepId}`} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-3">
                  <div data-testid={`workflow-step-${stepId}-number`} className="grid h-8 w-8 place-items-center rounded-full bg-primary/15 text-xs font-bold text-primary">{index + 1}</div>
                  <div data-testid={`workflow-step-${stepId}-text`} className="min-w-0 flex-1">
                    <div data-testid={`workflow-step-${stepId}-title`} className="text-sm font-medium">{step}</div>
                    <div data-testid={`workflow-step-${stepId}-description`} className="text-xs text-muted-foreground">
                      {isRunning ? 'Running workflow action...' : isLastResult ? workflowResult.message : 'Composable workflow action'}
                    </div>
                  </div>
                  <Button data-testid={`workflow-step-${stepId}-run-button`} variant="terminal" size="sm" onClick={() => runWorkflowStep(step, index)} disabled={Boolean(runningWorkflowStep)}>
                    {isRunning ? 'Running' : 'Run'}
                  </Button>
                </div>
              );
            })}
            {workflowResult && (
              <div data-testid="workflow-result-card" className={`rounded-2xl border p-3 text-xs ${workflowResult.status === 'error' ? 'border-destructive/40 bg-destructive/10 text-destructive' : 'border-primary/20 bg-primary/10 text-muted-foreground'}`}>
                <div data-testid="workflow-result-status" className="font-semibold uppercase tracking-[0.18em]">{workflowResult.status}</div>
                <div data-testid="workflow-result-message" className="mt-2 text-sm normal-case tracking-normal text-foreground">{workflowResult.message}</div>
                {workflowResult.data !== undefined && (
                  <pre data-testid="workflow-result-json" className="mt-3 max-h-72 overflow-auto rounded-2xl bg-black/35 p-3 text-xs text-muted-foreground">{JSON.stringify(workflowResult.data, null, 2)}</pre>
                )}
              </div>
            )}
            <pre data-testid="workflow-ideas-json" className="max-h-72 overflow-auto rounded-2xl bg-black/35 p-3 text-xs text-muted-foreground">{JSON.stringify(ideas.data ?? { ideas: [] }, null, 2)}</pre>
          </div>
        )}

        {panel === 'paper' && (
          <div data-testid="paper-panel-content" className="space-y-4">
            <div data-testid="paper-account-card" className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
              <div data-testid="paper-account-title" className="flex items-center gap-2 text-sm font-semibold"><LineChart size={15} /> Paper account</div>
              <p data-testid="paper-account-description" className="mt-1 text-xs text-muted-foreground">Simulation-only paper trading state.</p>
            </div>
            <pre data-testid="paper-account-json" className="max-h-96 overflow-auto rounded-2xl bg-black/35 p-3 text-xs text-muted-foreground">{JSON.stringify(paper.data ?? {}, null, 2)}</pre>
          </div>
        )}

        {panel === 'journal' && (
          <pre data-testid="right-panel-journal-json" className="max-h-full overflow-auto rounded-2xl bg-black/35 p-3 text-xs text-muted-foreground">{JSON.stringify(journal.data ?? { events: [] }, null, 2)}</pre>
        )}

        {panel === 'indicators' && (
          <div data-testid="indicators-panel-content" className="space-y-3">
            {indicatorControls.map((indicator) => {
              const indicatorId = automationId(indicator);
              return (
                <button key={indicator} data-testid={`indicator-control-${indicatorId}`} type="button" className="w-full rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-left transition hover:border-primary/40 hover:bg-primary/10">
                  <div data-testid={`indicator-control-${indicatorId}-title`} className="text-sm font-medium">{indicator}</div>
                  <div data-testid={`indicator-control-${indicatorId}-description`} className="mt-1 text-xs text-muted-foreground">Open indicator controls for {symbol} on {timeframe}.</div>
                </button>
              );
            })}
            <p data-testid="indicators-panel-note" className="rounded-2xl border border-primary/20 bg-primary/10 p-3 text-xs text-muted-foreground">These controls are now interactive entry points; indicator overlays can be attached here as chart overlay support is expanded.</p>
          </div>
        )}

        {panel === 'news' && (
          <div data-testid="news-panel-content" className="space-y-3">
            <div data-testid="news-market-card" className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
              <div data-testid="news-market-title" className="flex items-center gap-2 text-sm font-semibold"><Newspaper size={15} /> Market news for {symbol}</div>
              <p data-testid="news-market-description" className="mt-1 text-xs text-muted-foreground">News and saved research ideas are grouped here for the current symbol.</p>
            </div>
            <pre data-testid="news-ideas-json" className="max-h-96 overflow-auto rounded-2xl bg-black/35 p-3 text-xs text-muted-foreground">{JSON.stringify(ideas.data ?? { ideas: [] }, null, 2)}</pre>
          </div>
        )}

        {panel === 'layout' && (
          <div data-testid="layout-panel-content" className="space-y-3">
            <button data-testid="layout-toggle-watchlist-button" type="button" onClick={toggleLeft} className="flex w-full items-center justify-between rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-left transition hover:border-primary/40 hover:bg-primary/10">
              <span data-testid="layout-toggle-watchlist-text">
                <span data-testid="layout-toggle-watchlist-title" className="block text-sm font-medium">Watchlist panel</span>
                <span data-testid="layout-toggle-watchlist-description" className="text-xs text-muted-foreground">Show or hide the left watchlist.</span>
              </span>
              <span data-testid="layout-toggle-watchlist-state" className="text-xs font-semibold text-primary">{leftOpen ? 'Open' : 'Closed'}</span>
            </button>
            <button data-testid="layout-toggle-right-drawer-button" type="button" onClick={() => toggleRight()} className="flex w-full items-center justify-between rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-left transition hover:border-primary/40 hover:bg-primary/10">
              <span data-testid="layout-toggle-right-drawer-text">
                <span data-testid="layout-toggle-right-drawer-title" className="block text-sm font-medium">Right drawer</span>
                <span data-testid="layout-toggle-right-drawer-description" className="text-xs text-muted-foreground">Show or hide research, workflow, news, and tools.</span>
              </span>
              <span data-testid="layout-toggle-right-drawer-state" className="text-xs font-semibold text-primary">{rightOpen ? 'Open' : 'Closed'}</span>
            </button>
            <button data-testid="layout-toggle-console-button" type="button" onClick={toggleBottom} className="flex w-full items-center justify-between rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-left transition hover:border-primary/40 hover:bg-primary/10">
              <span data-testid="layout-toggle-console-text">
                <span data-testid="layout-toggle-console-title" className="block text-sm font-medium">Console panel</span>
                <span data-testid="layout-toggle-console-description" className="text-xs text-muted-foreground">Show or hide payload, journal, and diagnostics tabs.</span>
              </span>
              <span data-testid="layout-toggle-console-state" className="text-xs font-semibold text-primary">{bottomOpen ? 'Open' : 'Closed'}</span>
            </button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
