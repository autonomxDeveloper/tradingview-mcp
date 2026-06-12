import { useState } from 'react';
import { Database, DownloadCloud, HardDrive, RefreshCw, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { workstationApi } from '@/lib/api';
import { useUiStore } from '@/store/ui-store';

const DEFAULT_SESSION_ID = 'default';

type StorageStatus = {
  ok?: unknown;
  storage_dir?: unknown;
  paper_only?: unknown;
  live_execution?: unknown;
};

function pretty(value: unknown) {
  return JSON.stringify(value ?? {}, null, 2);
}

export function AITradingStorageControls() {
  const { symbol, timeframe, assetType, exchange } = useUiStore();
  const [status, setStatus] = useState<StorageStatus | null>(null);
  const [session, setSession] = useState<Record<string, unknown> | null>(null);
  const [message, setMessage] = useState('Backend session store is ready to check.');
  const [isBusy, setIsBusy] = useState(false);

  const loadStatus = async () => {
    setIsBusy(true);
    try {
      const payload = await workstationApi.aiTradingStatus();
      setStatus(payload);
      setMessage('Loaded backend AI trading storage status.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not load backend storage status.');
    } finally {
      setIsBusy(false);
    }
  };

  const loadSession = async () => {
    setIsBusy(true);
    try {
      const payload = await workstationApi.loadAiTradingSession(DEFAULT_SESSION_ID);
      setSession(payload);
      setMessage('Loaded backend AI trading session snapshot.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not load backend AI trading session.');
    } finally {
      setIsBusy(false);
    }
  };

  const saveHeartbeat = async () => {
    setIsBusy(true);
    try {
      const snapshot = {
        version: 1,
        source: 'right-drawer-storage-controls',
        symbol,
        timeframe,
        assetType,
        exchange,
        savedAt: new Date().toISOString(),
        paperOnly: true,
        note: 'Backend persistence heartbeat from the workstation UI. AI Trading execution remains simulation-only.',
      };
      const payload = await workstationApi.saveAiTradingSession(snapshot, DEFAULT_SESSION_ID);
      await workstationApi.appendAiTradingEvent({
        session_id: DEFAULT_SESSION_ID,
        level: 'success',
        message: `Saved backend session heartbeat for ${symbol || 'current symbol'}.`,
        payload: snapshot,
      });
      setSession(payload);
      setMessage('Saved backend AI trading heartbeat snapshot.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not save backend AI trading snapshot.');
    } finally {
      setIsBusy(false);
    }
  };

  const exportBackendSession = () => {
    const packet = {
      exportedAt: new Date().toISOString(),
      sessionId: DEFAULT_SESSION_ID,
      status,
      session,
    };
    const blob = new Blob([pretty(packet)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `ai-trading-backend-session-${Date.now()}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    setMessage('Exported backend AI trading session packet.');
  };

  return (
    <div data-testid="ai-trading-storage-card" className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.04] p-4 theme-day:border-slate-200 theme-day:bg-white">
      <div data-testid="ai-trading-storage-header" className="flex items-start justify-between gap-3">
        <div>
          <div data-testid="ai-trading-storage-title" className="flex items-center gap-2 text-sm font-semibold">
            <HardDrive size={15} /> AI Trading storage
          </div>
          <p data-testid="ai-trading-storage-description" className="mt-1 text-xs text-muted-foreground">
            Disk-backed session API for AI Trading snapshots, events, and paper-only records.
          </p>
        </div>
        <span data-testid="ai-trading-storage-mode-pill" className="rounded-full border border-primary/30 bg-primary/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-primary">
          paper only
        </span>
      </div>

      <div data-testid="ai-trading-storage-message" className="rounded-xl border border-white/10 bg-black/20 p-3 text-xs text-muted-foreground theme-day:border-slate-200 theme-day:bg-slate-50">
        {message}
      </div>

      <div data-testid="ai-trading-storage-actions" className="grid grid-cols-2 gap-2">
        <Button data-testid="ai-trading-storage-status-button" variant="terminal" size="sm" onClick={loadStatus} disabled={isBusy}>
          <RefreshCw size={13} /> Status
        </Button>
        <Button data-testid="ai-trading-storage-load-button" variant="terminal" size="sm" onClick={loadSession} disabled={isBusy}>
          <Database size={13} /> Load
        </Button>
        <Button data-testid="ai-trading-storage-save-button" variant="terminal" size="sm" onClick={saveHeartbeat} disabled={isBusy}>
          <Save size={13} /> Save heartbeat
        </Button>
        <Button data-testid="ai-trading-storage-export-button" variant="terminal" size="sm" onClick={exportBackendSession} disabled={!status && !session}>
          <DownloadCloud size={13} /> Export
        </Button>
      </div>

      <div data-testid="ai-trading-storage-summary" className="grid gap-2 text-xs sm:grid-cols-2">
        <div data-testid="ai-trading-storage-status-summary" className="rounded-xl border border-white/10 p-3 theme-day:border-slate-200">
          <div className="mb-1 font-semibold text-foreground">Status</div>
          <div className="text-muted-foreground">OK: {String(status?.ok ?? 'unknown')}</div>
          <div className="text-muted-foreground">Paper only: {String(status?.paper_only ?? 'unknown')}</div>
          <div className="text-muted-foreground">Live execution: {String(status?.live_execution ?? 'unknown')}</div>
        </div>
        <div data-testid="ai-trading-storage-session-summary" className="rounded-xl border border-white/10 p-3 theme-day:border-slate-200">
          <div className="mb-1 font-semibold text-foreground">Session</div>
          <div className="text-muted-foreground">ID: {DEFAULT_SESSION_ID}</div>
          <div className="text-muted-foreground">Symbol: {symbol || 'current'}</div>
          <div className="text-muted-foreground">Timeframe: {timeframe}</div>
        </div>
      </div>

      <pre data-testid="ai-trading-storage-json" className="max-h-56 overflow-auto rounded-2xl bg-black/35 p-3 text-xs text-muted-foreground">
        {pretty({ status, session })}
      </pre>
    </div>
  );
}
