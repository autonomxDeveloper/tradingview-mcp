import { useMemo } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { BrainCircuit, ClipboardList, History, LineChart, WalletCards } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { workstationApi } from '@/lib/api';
import { useUiStore, type RightPanel } from '@/store/ui-store';

export function ResearchPanel({ panel }: { panel: RightPanel }) {
  const { symbol, timeframe, assetType, exchange } = useUiStore();
  const analyze = useMutation<Record<string, unknown>, Error>({
    mutationFn: () => workstationApi.analyze({
      symbol,
      asset_type: assetType,
      exchange,
      timeframe,
      question: 'Give observations, risks, invalidation levels, and what to backtest next.',
    }),
  });
  const analysisText = useMemo(() => analyze.data ? JSON.stringify(analyze.data, null, 2) : '', [analyze.data]);
  const paper = useQuery({ queryKey: ['paper-account'], queryFn: workstationApi.paperAccount, enabled: panel === 'paper' });
  const ideas = useQuery({ queryKey: ['ideas'], queryFn: workstationApi.ideas, enabled: panel === 'workflow' });
  const journal = useQuery({ queryKey: ['journal'], queryFn: workstationApi.journal, enabled: panel === 'journal' });

  return (
    <Card className="flex h-full min-w-0 flex-1 flex-col overflow-hidden rounded-3xl">
      <CardHeader className="border-b border-white/10">
        <CardTitle className="flex items-center gap-2">
          {panel === 'research' && <BrainCircuit size={16} className="text-primary" />}
          {panel === 'workflow' && <ClipboardList size={16} className="text-primary" />}
          {panel === 'paper' && <WalletCards size={16} className="text-primary" />}
          {panel === 'journal' && <History size={16} className="text-primary" />}
          {panel === 'research' ? 'AI Research' : panel === 'workflow' ? 'AI Workflow' : panel === 'paper' ? 'Paper Trading' : 'Journal'}
        </CardTitle>
      </CardHeader>
      <CardContent className="min-h-0 flex-1 overflow-auto p-4">
        {panel === 'research' && (
          <div className="space-y-4">
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
              <div className="text-sm font-semibold">Analyze {symbol}</div>
              <p className="mt-1 text-xs text-muted-foreground">Risk-first research using the existing LM Studio endpoint.</p>
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
      </CardContent>
    </Card>
  );
}
