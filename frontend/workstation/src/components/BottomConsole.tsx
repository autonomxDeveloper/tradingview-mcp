import type { ElementType } from 'react';
import * as Tabs from '@radix-ui/react-tabs';
import { useQuery } from '@tanstack/react-query';
import { Activity, ChevronDown, Database, FileText, Terminal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { workstationApi } from '@/lib/api';

const consoleTabs: Array<{ value: string; icon: ElementType; label: string }> = [
  { value: 'console', icon: Terminal, label: 'Console' },
  { value: 'payload', icon: Database, label: 'Payload' },
  { value: 'journal', icon: FileText, label: 'Journal' },
  { value: 'diagnostics', icon: Activity, label: 'Diagnostics' },
];

type BottomConsoleProps = {
  onCollapse?: () => void;
};

export function BottomConsole({ onCollapse }: BottomConsoleProps) {
  const health = useQuery({ queryKey: ['health'], queryFn: workstationApi.health });
  const journal = useQuery({ queryKey: ['journal-console'], queryFn: workstationApi.journal });

  return (
    <Card data-testid="bottom-console-panel" className="h-full overflow-hidden rounded-3xl">
      <Tabs.Root data-testid="bottom-console-tabs" defaultValue="console" className="flex h-full flex-col">
        <Tabs.List data-testid="bottom-console-tab-list" className="flex items-center justify-between gap-3 border-b border-white/10 p-3">
          <div data-testid="bottom-console-tab-buttons" className="flex gap-2 overflow-x-auto">
            {consoleTabs.map(({ value, icon: Icon, label }) => (
              <Tabs.Trigger key={value} data-testid={`bottom-console-tab-${value}`} value={value} className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs text-muted-foreground transition data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                <Icon size={14} /> {label}
              </Tabs.Trigger>
            ))}
          </div>
          {onCollapse && (
            <Button data-testid="collapse-console-button" variant="terminal" size="icon" onClick={onCollapse} aria-label="Collapse console">
              <ChevronDown size={15} />
            </Button>
          )}
        </Tabs.List>
        <div data-testid="bottom-console-tab-content" className="min-h-0 flex-1 overflow-auto p-4">
          <Tabs.Content data-testid="bottom-console-console-content" value="console" className="m-0 h-full">
            <div data-testid="bottom-console-ready-message" className="grid h-full place-items-center rounded-2xl border border-dashed border-white/10 text-sm text-muted-foreground">
              Ready. Select a symbol, run AI research, or resize the workstation panels.
            </div>
          </Tabs.Content>
          <Tabs.Content data-testid="bottom-console-payload-content" value="payload" className="m-0">
            <pre data-testid="bottom-console-payload-json" className="text-xs text-muted-foreground">{JSON.stringify(health.data ?? {}, null, 2)}</pre>
          </Tabs.Content>
          <Tabs.Content data-testid="bottom-console-journal-content" value="journal" className="m-0">
            <pre data-testid="bottom-console-journal-json" className="text-xs text-muted-foreground">{JSON.stringify(journal.data ?? {}, null, 2)}</pre>
          </Tabs.Content>
          <Tabs.Content data-testid="bottom-console-diagnostics-content" value="diagnostics" className="m-0">
            <pre data-testid="bottom-console-diagnostics-json" className="text-xs text-muted-foreground">{JSON.stringify({ health: health.status, journal: journal.status }, null, 2)}</pre>
          </Tabs.Content>
        </div>
      </Tabs.Root>
    </Card>
  );
}
