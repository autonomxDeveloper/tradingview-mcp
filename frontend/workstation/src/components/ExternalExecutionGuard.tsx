import { useState } from 'react';
import { Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';

type PreviewMode = 'paper-only' | 'planning-preview' | 'disabled';
const CONFIRMATION_PHRASE = 'PAPER ONLY';

export function ExternalExecutionGuard() {
  const [mode, setMode] = useState<PreviewMode>('paper-only');
  const [confirmation, setConfirmation] = useState('');
  const [message, setMessage] = useState('Paper simulation is the only active route. External execution is disabled.');
  const confirmationOk = confirmation.trim().toUpperCase() === CONFIRMATION_PHRASE;
  const previewReady = mode !== 'paper-only' && confirmationOk;
  const checks = [
    { id: 'paper-route', label: 'Paper simulation route remains active', ok: true },
    { id: 'external-disabled', label: 'External execution path is disabled', ok: true },
    { id: 'confirmation', label: `Confirmation phrase: ${CONFIRMATION_PHRASE}`, ok: confirmationOk },
  ];

  return (
    <section data-testid="external-execution-guard-card" className="grid gap-3 rounded-2xl border border-white/10 bg-white/[0.035] p-4 theme-day:border-slate-200 theme-day:bg-white">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div data-testid="external-execution-title" className="text-sm font-semibold">External execution guard</div>
          <div data-testid="external-execution-subtitle" className="text-xs text-muted-foreground">Planning-only controls. The workstation remains paper simulation only.</div>
        </div>
        <div data-testid="external-execution-lock-pill" className="inline-flex items-center gap-1 rounded-full border border-destructive/30 bg-destructive/10 px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-destructive"><Lock size={12} /> locked</div>
      </div>

      <div data-testid="external-execution-status-grid" className="grid grid-cols-2 gap-2 text-xs">
        <div data-testid="external-execution-status" className="rounded-xl border border-white/10 p-2 theme-day:border-slate-200">External path <b className="text-destructive">disabled</b></div>
        <div data-testid="external-execution-preview-status" className="rounded-xl border border-white/10 p-2 theme-day:border-slate-200">Preview <b>{previewReady ? 'ready' : 'locked'}</b></div>
      </div>

      <label data-testid="external-execution-mode-control" className="grid gap-1 text-xs text-muted-foreground">Intent mode
        <select data-testid="external-execution-mode-select" value={mode} onChange={(event) => setMode(event.target.value as PreviewMode)} className="rounded-xl border border-white/10 bg-background px-3 py-2 text-sm text-foreground outline-none theme-day:border-slate-200">
          <option data-testid="external-execution-mode-option-paper-only" value="paper-only">Paper only</option>
          <option data-testid="external-execution-mode-option-planning-preview" value="planning-preview">Planning preview</option>
          <option data-testid="external-execution-mode-option-disabled" value="disabled">Disabled</option>
        </select>
      </label>

      <label data-testid="external-execution-confirmation-control" className="grid gap-1 text-xs text-muted-foreground">Type PAPER ONLY to unlock preview planning
        <input data-testid="external-execution-confirmation-input" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} className="rounded-xl border border-white/10 bg-background px-3 py-2 text-sm text-foreground outline-none theme-day:border-slate-200" />
      </label>

      <div data-testid="external-execution-checklist" className="grid gap-2 rounded-xl border border-white/10 p-3 text-xs theme-day:border-slate-200">
        <div data-testid="external-execution-checklist-title" className="font-semibold text-foreground">Readiness checklist</div>
        {checks.map((item) => <div key={item.id} data-testid={`external-execution-check-${item.id}`} className="flex items-center justify-between gap-3"><span>{item.label}</span><span className={item.ok ? 'font-semibold text-primary' : 'font-semibold text-destructive'}>{item.ok ? 'ok' : 'locked'}</span></div>)}
      </div>

      <div data-testid="external-execution-message" className="rounded-xl border border-primary/20 bg-primary/10 p-3 text-xs text-muted-foreground">{message}</div>
      <Button data-testid="external-execution-keep-locked-button" variant="terminal" onClick={() => setMessage('Guard remains locked. Paper simulation continues to be the only available route.')}>Keep locked</Button>
    </section>
  );
}
