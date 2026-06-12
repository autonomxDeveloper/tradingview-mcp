import { useQuery } from '@tanstack/react-query';
import { Star, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { workstationApi } from '@/lib/api';
import { useUiStore } from '@/store/ui-store';

export function WatchlistPanel() {
  const setSymbol = useUiStore((state) => state.setSymbol);
  const activeSymbol = useUiStore((state) => state.symbol);
  const { data, isLoading } = useQuery({ queryKey: ['watchlist'], queryFn: workstationApi.watchlist });
  const symbols = data?.symbols ?? ['AAPL', 'NVDA', 'TSLA', 'SPY', 'QQQ', 'BTCUSDT', 'ETHUSDT'];

  return (
    <Card className="flex h-full flex-col overflow-hidden rounded-3xl">
      <CardHeader className="border-b border-white/10">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2"><Star size={16} className="text-primary" /> Watchlist</CardTitle>
          <span className="rounded-full bg-primary/10 px-2 py-1 text-xs text-primary">{symbols.length}</span>
        </div>
      </CardHeader>
      <CardContent className="min-h-0 flex-1 overflow-auto p-2">
        {isLoading && <div className="p-3 text-sm text-muted-foreground">Loading symbols...</div>}
        <div className="space-y-2">
          {symbols.map((symbol) => (
            <button
              key={symbol}
              type="button"
              onClick={() => setSymbol(symbol)}
              className={`flex w-full items-center justify-between rounded-2xl border px-3 py-3 text-left transition ${activeSymbol === symbol ? 'border-primary/40 bg-primary/10' : 'border-white/10 bg-white/[0.04] hover:bg-white/[0.08]'}`}
            >
              <div>
                <div className="font-semibold">{symbol}</div>
                <div className="text-xs text-muted-foreground">Research workspace</div>
              </div>
              <TrendingUp size={16} className="text-primary" />
            </button>
          ))}
        </div>
      </CardContent>
      <div className="border-t border-white/10 p-3">
        <Button variant="terminal" className="w-full">Manage watchlist</Button>
      </div>
    </Card>
  );
}
