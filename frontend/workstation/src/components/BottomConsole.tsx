import type { ElementType } from 'react';
import { useMemo, useState } from 'react';
import * as Tabs from '@radix-ui/react-tabs';
import { useQuery } from '@tanstack/react-query';
import { Activity, Bot, ChevronDown, Database, FileText, Terminal, WalletCards } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { workstationApi } from '@/lib/api';
import { useUiStore } from '@/store/ui-store';
import { AITradingConsole } from './AITradingConsole';

const consoleTabs: Array<{ value: string; icon: ElementType; label: string }> = [
  { value: 'console', icon: Terminal, label: 'Console' },
  { value: 'paper', icon: WalletCards, label: 'Paper Trading' },
  { value: 'ai-trading', icon: Bot, label: 'AI Trading' },
  { value: 'payload', icon: Database, label: 'Payload' },
  { value: 'journal', icon: FileText, label: 'Journal' },
  { value: 'diagnostics', icon: Activity, label: 'Diagnostics' },
];

type BottomConsoleProps = { onCollapse?: () => void };
type PaperSide = 'buy' | 'sell';
type PaperOrderType = 'market' | 'limit';
type PaperOrderSource = 'manual' | 'ai';
type PaperPosition = { symbol: string; quantity: number; averagePrice: number };
type PaperOrder = {
  id: string;
  time: string;
  symbol: string;
  side: PaperSide;
  type: PaperOrderType;
  quantity: number;
  price: number;
  status: 'filled' | 'rejected';
  message: string;
  source: PaperOrderSource;
};
type PaperAccountState = { cash: number; positions: PaperPosition[]; orders: PaperOrder[] };

type PaperTradingConsoleProps = {
  paperAccount: PaperAccountState;
  paperMessage: string;
  marketValue: number;
  equity: number;
  placePaperOrder: (input: { symbol: string; side: PaperSide; type: PaperOrderType; quantity: number; price: number; source: PaperOrderSource }) => PaperOrder;
  resetPaperAccount: () => void;
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(value);
const safeTestId = (value: string) => value.toLowerCase().replace(/[^a-z0-9-]+/g, '-');

function PaperTradingConsole({ paperAccount, paperMessage, marketValue, equity, placePaperOrder, resetPaperAccount }: PaperTradingConsoleProps) {
  const symbol = useUiStore((state) => state.symbol);
  const [side, setSide] = useState<PaperSide>('buy');
  const [orderType, setOrderType] = useState<PaperOrderType>('market');
  const [quantity, setQuantity] = useState('1');
  const [limitPrice, setLimitPrice] = useState('100');

  const parsedQuantity = Number(quantity);
  const parsedPrice = Number(limitPrice);
  const referencePrice = Number.isFinite(parsedPrice) && parsedPrice > 0 ? parsedPrice : 100;
  const notional = Number.isFinite(parsedQuantity) && parsedQuantity > 0 ? parsedQuantity * referencePrice : 0;

  const placeOrder = () => {
    const normalizedSymbol = symbol.trim().toUpperCase() || 'BTCUSDT';
    const qty = Number(quantity);
    const price = orderType === 'market' ? referencePrice : Number(limitPrice);
    placePaperOrder({ symbol: normalizedSymbol, side, type: orderType, quantity: qty, price, source: 'manual' });
  };

  return (
    <div data-testid="paper-trading-console" className="grid h-full min-h-[220px] gap-4 lg:grid-cols-[1.1fr_1fr_1.2fr]">
      <section data-testid="paper-account-card" className="rounded-2xl border border-white/10 bg-white/[0.035] p-4 theme-day:border-slate-200 theme-day:bg-white">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <div data-testid="paper-account-title" className="text-sm font-semibold">Paper account</div>
            <div data-testid="paper-account-subtitle" className="text-xs text-muted-foreground">Shared simulated account for manual and AI paper trades.</div>
          </div>
          <Button data-testid="paper-reset-account-button" variant="terminal" size="sm" onClick={resetPaperAccount}>Reset</Button>
        </div>
        <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
          <div data-testid="paper-cash-card" className="rounded-xl border border-white/10 p-3 theme-day:border-slate-200"><div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Cash</div><div data-testid="paper-cash-value" className="mt-1 text-lg font-semibold">{formatCurrency(paperAccount.cash)}</div></div>
          <div data-testid="paper-equity-card" className="rounded-xl border border-white/10 p-3 theme-day:border-slate-200"><div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Equity</div><div data-testid="paper-equity-value" className="mt-1 text-lg font-semibold">{formatCurrency(equity)}</div></div>
          <div data-testid="paper-market-value-card" className="rounded-xl border border-white/10 p-3 theme-day:border-slate-200"><div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Positions</div><div data-testid="paper-market-value" className="mt-1 text-lg font-semibold">{formatCurrency(marketValue)}</div></div>
        </div>
        <div data-testid="paper-status-message" className="mt-3 rounded-xl border border-primary/20 bg-primary/10 p-3 text-xs text-muted-foreground">{paperMessage}</div>
      </section>

      <section data-testid="paper-order-ticket" className="rounded-2xl border border-white/10 bg-white/[0.035] p-4 theme-day:border-slate-200 theme-day:bg-white">
        <div className="mb-3"><div data-testid="paper-ticket-title" className="text-sm font-semibold">Order ticket</div><div data-testid="paper-ticket-symbol" className="text-xs text-muted-foreground">Current symbol: {symbol}</div></div>
        <div className="grid gap-3">
          <label data-testid="paper-side-control" className="grid gap-1 text-xs text-muted-foreground">Side<select data-testid="paper-side-select" value={side} onChange={(event) => setSide(event.target.value as PaperSide)} className="rounded-xl border border-white/10 bg-background px-3 py-2 text-sm text-foreground outline-none theme-day:border-slate-200"><option data-testid="paper-side-option-buy" value="buy">Buy</option><option data-testid="paper-side-option-sell" value="sell">Sell</option></select></label>
          <label data-testid="paper-order-type-control" className="grid gap-1 text-xs text-muted-foreground">Type<select data-testid="paper-order-type-select" value={orderType} onChange={(event) => setOrderType(event.target.value as PaperOrderType)} className="rounded-xl border border-white/10 bg-background px-3 py-2 text-sm text-foreground outline-none theme-day:border-slate-200"><option data-testid="paper-order-type-option-market" value="market">Market</option><option data-testid="paper-order-type-option-limit" value="limit">Limit</option></select></label>
          <div className="grid grid-cols-2 gap-3">
            <label data-testid="paper-quantity-control" className="grid gap-1 text-xs text-muted-foreground">Quantity<input data-testid="paper-quantity-input" value={quantity} onChange={(event) => setQuantity(event.target.value)} inputMode="decimal" className="rounded-xl border border-white/10 bg-background px-3 py-2 text-sm text-foreground outline-none theme-day:border-slate-200" /></label>
            <label data-testid="paper-limit-price-control" className="grid gap-1 text-xs text-muted-foreground">Reference / limit<input data-testid="paper-limit-price-input" value={limitPrice} onChange={(event) => setLimitPrice(event.target.value)} inputMode="decimal" className="rounded-xl border border-white/10 bg-background px-3 py-2 text-sm text-foreground outline-none theme-day:border-slate-200" /></label>
          </div>
          <div data-testid="paper-order-notional" className="rounded-xl border border-white/10 px-3 py-2 text-xs text-muted-foreground theme-day:border-slate-200">Est. notional: <span className="font-semibold text-foreground">{formatCurrency(notional)}</span></div>
          <Button data-testid="paper-place-order-button" onClick={placeOrder} className="w-full">Place paper order</Button>
        </div>
      </section>

      <section data-testid="paper-activity-card" className="grid min-h-0 gap-3 rounded-2xl border border-white/10 bg-white/[0.035] p-4 theme-day:border-slate-200 theme-day:bg-white">
        <div>
          <div data-testid="paper-positions-title" className="text-sm font-semibold">Open positions</div>
          <div data-testid="paper-positions-list" className="mt-2 max-h-24 overflow-auto rounded-xl border border-white/10 theme-day:border-slate-200">
            {paperAccount.positions.length === 0 ? <div data-testid="paper-positions-empty" className="p-3 text-xs text-muted-foreground">No open paper positions.</div> : paperAccount.positions.map((position) => <div key={position.symbol} data-testid={`paper-position-${safeTestId(position.symbol)}`} className="grid grid-cols-3 gap-2 border-b border-white/10 p-3 text-xs last:border-b-0 theme-day:border-slate-200"><span className="font-semibold text-foreground">{position.symbol}</span><span>{position.quantity}</span><span>{formatCurrency(position.averagePrice)}</span></div>)}
          </div>
        </div>
        <div className="min-h-0">
          <div data-testid="paper-orders-title" className="text-sm font-semibold">Order log</div>
          <div data-testid="paper-orders-list" className="mt-2 max-h-36 overflow-auto rounded-xl border border-white/10 theme-day:border-slate-200">
            {paperAccount.orders.length === 0 ? <div data-testid="paper-orders-empty" className="p-3 text-xs text-muted-foreground">No paper orders yet.</div> : paperAccount.orders.map((order) => <div key={order.id} data-testid={`paper-order-${safeTestId(order.id)}`} className="border-b border-white/10 p-3 text-xs last:border-b-0 theme-day:border-slate-200"><div className="flex items-center justify-between gap-2"><span className="font-semibold text-foreground">{order.side.toUpperCase()} {order.quantity} {order.symbol}</span><span className={order.status === 'filled' ? 'text-primary' : 'text-destructive'}>{order.status}</span></div><div className="mt-1 text-muted-foreground">{order.time} · {order.type} · {formatCurrency(order.price)} · {order.source}</div><div className="mt-1 text-muted-foreground">{order.message}</div></div>)}
          </div>
        </div>
      </section>
    </div>
  );
}

export function BottomConsole({ onCollapse }: BottomConsoleProps) {
  const health = useQuery({ queryKey: ['health'], queryFn: workstationApi.health });
  const journal = useQuery({ queryKey: ['journal-console'], queryFn: workstationApi.journal });
  const [paperAccount, setPaperAccount] = useState<PaperAccountState>({ cash: 100_000, positions: [], orders: [] });
  const [paperMessage, setPaperMessage] = useState('Ready to place a simulated order. Manual and AI paper trades share this account.');

  const paperMarketValue = useMemo(() => paperAccount.positions.reduce((total, position) => total + position.quantity * position.averagePrice, 0), [paperAccount.positions]);
  const paperEquity = paperAccount.cash + paperMarketValue;

  const placePaperOrder = ({ symbol, side, type, quantity, price, source }: { symbol: string; side: PaperSide; type: PaperOrderType; quantity: number; price: number; source: PaperOrderSource }) => {
    const normalizedSymbol = symbol.trim().toUpperCase() || 'BTCUSDT';
    const qty = Number(quantity);
    const fillPrice = Number(price);
    const createOrder = (status: PaperOrder['status'], message: string): PaperOrder => ({ id: `${source === 'ai' ? 'AI-P' : 'P'}-${Date.now()}`, time: new Date().toLocaleTimeString(), symbol: normalizedSymbol, side, type, quantity: Number.isFinite(qty) ? qty : 0, price: Number.isFinite(fillPrice) ? fillPrice : 0, status, message, source });

    if (!Number.isFinite(qty) || qty <= 0 || !Number.isFinite(fillPrice) || fillPrice <= 0) {
      const rejected = createOrder('rejected', 'Quantity and price must be positive numbers.');
      setPaperAccount((account) => ({ ...account, orders: [rejected, ...account.orders].slice(0, 75) }));
      setPaperMessage(rejected.message);
      return rejected;
    }

    const cost = qty * fillPrice;
    let result: PaperOrder;
    setPaperAccount((account) => {
      if (side === 'buy' && cost > account.cash) {
        result = createOrder('rejected', `Insufficient shared paper cash for ${formatCurrency(cost)} order.`);
        return { ...account, orders: [result, ...account.orders].slice(0, 75) };
      }
      const existing = account.positions.find((position) => position.symbol === normalizedSymbol);
      if (side === 'sell' && (!existing || existing.quantity < qty)) {
        result = createOrder('rejected', 'Paper short selling is disabled. Sell quantity must be covered by an open position.');
        return { ...account, orders: [result, ...account.orders].slice(0, 75) };
      }

      const nextCash = side === 'buy' ? account.cash - cost : account.cash + cost;
      const nextPositions = side === 'buy'
        ? (() => {
            if (!existing) return [...account.positions, { symbol: normalizedSymbol, quantity: qty, averagePrice: fillPrice }];
            const nextQuantity = existing.quantity + qty;
            const nextAverage = (existing.quantity * existing.averagePrice + cost) / nextQuantity;
            return account.positions.map((position) => position.symbol === normalizedSymbol ? { ...position, quantity: nextQuantity, averagePrice: nextAverage } : position);
          })()
        : account.positions.map((position) => position.symbol === normalizedSymbol ? { ...position, quantity: position.quantity - qty } : position).filter((position) => position.quantity > 0.0000001);
      result = createOrder('filled', `${source === 'ai' ? 'AI ' : ''}${side.toUpperCase()} ${qty} ${normalizedSymbol} @ ${formatCurrency(fillPrice)} filled in shared paper account.`);
      return { cash: nextCash, positions: nextPositions, orders: [result, ...account.orders].slice(0, 75) };
    });
    setPaperMessage(result!.message);
    return result!;
  };

  const resetPaperAccount = () => {
    setPaperAccount({ cash: 100_000, positions: [], orders: [] });
    setPaperMessage('Shared paper account reset to $100,000.');
  };

  return (
    <Card data-testid="bottom-console-panel" className="h-full overflow-hidden rounded-3xl">
      <Tabs.Root data-testid="bottom-console-tabs" defaultValue="console" className="flex h-full flex-col">
        <Tabs.List data-testid="bottom-console-tab-list" className="flex items-center justify-between gap-3 border-b border-white/10 p-3">
          <div data-testid="bottom-console-tab-buttons" className="flex gap-2 overflow-x-auto">
            {consoleTabs.map(({ value, icon: Icon, label }) => <Tabs.Trigger key={value} data-testid={`bottom-console-tab-${value}`} value={value} className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs text-muted-foreground transition data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"><Icon size={14} /> {label}</Tabs.Trigger>)}
          </div>
          {onCollapse && <Button data-testid="collapse-console-button" variant="terminal" size="icon" onClick={onCollapse} aria-label="Collapse console"><ChevronDown size={15} /></Button>}
        </Tabs.List>
        <div data-testid="bottom-console-tab-content" className="min-h-0 flex-1 overflow-auto p-4">
          <Tabs.Content data-testid="bottom-console-console-content" value="console" className="m-0 h-full"><div data-testid="bottom-console-ready-message" className="grid h-full place-items-center rounded-2xl border border-dashed border-white/10 text-sm text-muted-foreground">Ready. Select a symbol, run AI research, or resize the workstation panels.</div></Tabs.Content>
          <Tabs.Content data-testid="bottom-console-paper-content" value="paper" className="m-0 h-full"><PaperTradingConsole paperAccount={paperAccount} paperMessage={paperMessage} marketValue={paperMarketValue} equity={paperEquity} placePaperOrder={placePaperOrder} resetPaperAccount={resetPaperAccount} /></Tabs.Content>
          <Tabs.Content data-testid="bottom-console-ai-trading-content" value="ai-trading" className="m-0 h-full"><AITradingConsole paperAccount={paperAccount} paperEquity={paperEquity} paperMarketValue={paperMarketValue} placePaperOrder={placePaperOrder} /></Tabs.Content>
          <Tabs.Content data-testid="bottom-console-payload-content" value="payload" className="m-0"><pre data-testid="bottom-console-payload-json" className="text-xs text-muted-foreground">{JSON.stringify(health.data ?? {}, null, 2)}</pre></Tabs.Content>
          <Tabs.Content data-testid="bottom-console-journal-content" value="journal" className="m-0"><pre data-testid="bottom-console-journal-json" className="text-xs text-muted-foreground">{JSON.stringify(journal.data ?? {}, null, 2)}</pre></Tabs.Content>
          <Tabs.Content data-testid="bottom-console-diagnostics-content" value="diagnostics" className="m-0"><pre data-testid="bottom-console-diagnostics-json" className="text-xs text-muted-foreground">{JSON.stringify({ health: health.status, journal: journal.status }, null, 2)}</pre></Tabs.Content>
        </div>
      </Tabs.Root>
    </Card>
  );
}
