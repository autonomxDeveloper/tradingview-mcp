import type { ElementType } from 'react';
import * as Tabs from '@radix-ui/react-tabs';
import { useQuery } from '@tanstack/react-query';
import { Activity, Database, FileText, Terminal } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { workstationApi } from '@/lib/api';

const consoleTabs: Array<{ value: string; icon: ElementType; label: string }> = [
  { value: 'console', icon: Terminal, label: 'Console' },
  { value: 'payload', icon: Database, label: 'Payload' },
  { value: 'journal', icon: FileText, label: 'Journal' },
  { value: 'diagnostics', icon: Activity, label: 'Diagnostics' },
];

export function BottomConsole() {
  const health = useQuery({ queryKey: ['health'], queryFn: workstationApi.health });
  const journal = useQuery({ queryKey: ['journal-console'], queryFn: workstationApi.journal });

  return (
    <Card className="h-full overflow-hidden rounded-3xl">
      <Tabs.Root defaultValue="console" className="flex h-full flex-col">
        <Tabs.List className="flex gap-2 border-b border-white/10 p-3">
          {consoleTabs.map(({ value, icon: Icon, label }) => (
            <Tabs.Trigger key={value} value={value} className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs text-muted-foreground transition data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <Icon size={14} /> {label}
            </Tabs.Trigger>
          ))}
        </Tabs.List>
        <div className="min-h-0 flex-1 overflow-auto p-4">
          <Tabs.Content value="console" className="m-0 h-full">
            <div className="grid h-full place-items-center rounded-2xl border border-dashed border-white/10 text-sm text-muted-foreground">
              Ready. Select a symbol, run AI research, or resize the workstation panels.
            </div>
          </Tabs.Content>
          <Tabs.Content value="payload" className="m-0">
            <pre className="text-xs text-muted-foreground">{JSON.stringify(health.data ?? {}, null, 2)}</pre>
          </Tabs.Content>
          <Tabs.Content value="journal" className="m-0">
            <pre className="text-xs text-muted-foreground">{JSON.stringify(journal.data ?? {}, null, 2)}</pre>
          </Tabs.Content>
          <Tabs.Content value="diagnostics" className="m-0">
            <pre className="text-xs text-muted-foreground">{JSON.stringify({ health: health.status, journal: journal.status }, null, 2)}</pre>
          </Tabs.Content>
        </div>
      </Tabs.Root>
    </Card>
  );
}
