import type { ElementType } from 'react';
import { useMemo, useState } from 'react';
import * as Tabs from '@radix-ui/react-tabs';
import { useQuery } from '@tanstack/react-query';
import { Activity, ChevronDown, Database, FileText, Terminal, WalletCards } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { workstationApi } from '@/lib/api';
import { useUiStore } from '@/store/ui-store';

const consoleTabs: Array<{ value: string; icon: ElementType; label: string }> = [
  { value: 'console', icon: Terminal, label: 'Console' },
  { value: 'paper', icon: WalletCards, label: 'Paper Trading' },
  { value: 'payload', icon: Database, label: 'Payload' },
  { value: 'journal', icon: FileText, label: 'Journal' },
  { value: 'diagnostics', icon: Activity, label: 'Diagnostics' },
];

type BottomConsoleProps = {
  onCollapse?: () => void;
};

type PaperSide = 'buy' | 'sell';
type PaperOrderType = 'market' | 'limit';

type PaperPosition = {
  symbol: string;
  quantity: number;
  averagePrice: number;
};

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
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(value);

function PaperTradingConsole() {
  const symbol = useUiStore((state) => state.symbol);
  const [cash, setCash] = useState(100_000);
  const [positions, setPositions] = useState<PaperPosition[]>([]);
  const [orders, setOrders] = useState<PaperOrder[]>([]);
  const [side, setSide] = useState<PaperSide>('buy');
  const [orderType, setOrderType] = useState<PaperOrderType>('market');
  const [quantity, setQuantity] = useState('1');
  const [limitPrice, setLimitPrice] = useState('100');
  const [message, setMessage] = useState('Ready to place a simulated order. Market orders use the ticket reference price.');

  const parsedQuantity = Number(quantity);
  const parsedPrice = Number(limitPrice);
  const referencePrice = Number.isFinite(parsedPrice) && parsedPrice > 0 ? parsedPrice : 100;
  const notional = Number.isFinite(parsedQuantity) && parsedQuantity > 0 ? parsedQuantity * referencePrice : 0;
  const marketValue = useMemo(
    () => positions.reduce((total, position) => total + position.quantity * position.averagePrice, 0),
    [positions],
  );
  const equity = cash + marketValue;

  const placeOrder = () => {
    const normalizedSymbol = symbol.trim().toUpperCase() || 'BTCUSDT';
    const qty = Number(quantity);
    const price = orderType === 'market' ? referencePrice : Number(limitPrice);

    if (!Number.isFinite(qty) || qty <= 0 || !Number.isFinite(price) || price <= 0) {
      const rejected: PaperOrder = {
        id: `P-${Date.now()}`,
        time: new Date().toLocaleTimeString(),
        symbol: normalizedSymbol,
        side,
        type: orderType,
        quantity: Number.isFinite(qty) ? qty : 0,
        price: Number.isFinite(price) ? price : 0,
        status: 'rejected',
        message: 'Quantity and price must be positive numbers.',
      };
      setOrders((items) => [rejected, ...items].slice(0, 25));
      setMessage(rejected.message);
      return;
    }

    const cost = qty * price;

    if (side === 'buy' && cost > cash) {
      const rejected: PaperOrder = {
        id: `P-${Date.now()}`,
        time: new Date().toLocaleTimeString(),
        symbol: normalizedSymbol,
        side,
        type: orderType,
        quantity: qty,
        price,
        status: 'rejected',
        message: `Insufficient paper cash for ${formatCurrency(cost)} order.`,
      };
      setOrders((items) => [rejected, ...items].slice(0, 25));
      setMessage(rejected.message);
      return;
    }

    if (side === 'sell') {
      const existing = positions.find((position) => position.symbol === normalizedSymbol);
      if (!existing || existing.quantity < qty) {
        const rejected: PaperOrder = {
          id: `P-${Date.now()}`,
          time: new Date().toLocaleTimeString(),
          symbol: normalizedSymbol,
          side,
          type: orderType,
          quantity: qty,
          price,
          status: 'rejected',
          message: 'Paper short selling is disabled. Sell quantity must be covered by an open position.',
        };
        setOrders((items) => [rejected, ...items].slice(0, 25));
        setMessage(rejected.message);
        return;
      }
    }

    if (side === 'buy') {
      setCash((value) => value - cost);
      setPositions((items) => {
        const existing = items.find((position) => position.symbol === normalizedSymbol);
        if (!existing) {
          return [...items, { symbol: normalizedSymbol, quantity: qty, averagePrice: price }];
        }
        const nextQuantity = existing.quantity + qty;
        const nextAverage = (existing.quantity * existing.averagePrice + cost) / nextQuantity;
        return items.map((position) =>
          position.symbol === normalizedSymbol
            ? { ...position, quantity: nextQuantity, averagePrice: nextAverage }
            : position,
        );
      });
    } else {
      setCash((value) => value + cost);
      setPositions((items) =>
        items
          .map((position) =>
            position.symbol === normalizedSymbol ? { ...position, quantity: position.quantity - qty } : position,
          )
          .filter((position) => position.quantity > 0.0000001),
      );
    }

    const filled: PaperOrder = {
      id: `P-${Date.now()}`,
      time: new Date().toLocaleTimeString(),
      symbol: normalizedSymbol,
      side,
      type: orderType,
      quantity: qty,
      price,
      status: 'filled',
      message: `${side.toUpperCase()} ${qty} ${normalizedSymbol} @ ${formatCurrency(price)} filled in paper mode.`,
    };
    setOrders((items) => [filled, ...items].slice(0, 25));
    setMessage(filled.message);
  };

  const resetPaperAccount = () => {
    setCash(100_000);
    setPositions([]);
    setOrders([]);
    setMessage('Paper account reset to $100,000.');
  };

  return (
    <div data-testid="paper-trading-console" className="grid h-full min-h-[220px] gap-4 lg:grid-cols-[1.1fr_1fr_1.2fr]">
      <section data-testid="paper-account-card" className="rounded-2xl border border-white/10 bg-white/[0.035] p-4 theme-day:border-slate-200 theme-day:bg-white">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <div data-testid="paper-account-title" className="text-sm font-semibold">Paper account</div>
            <div data-testid="paper-account-subtitle" className="text-xs text-muted-foreground">Simulated fills only. No live orders are sent.</div>
          </div>
          <Button data-testid="paper-reset-account-button" variant="terminal" size="sm" onClick={resetPaperAccount}>Reset</Button>
        </div>
        <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
          <div data-testid="paper-cash-card" className="rounded-xl border border-white/10 p-3 theme-day:border-slate-200">
            <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Cash</div>
            <div data-testid="paper-cash-value" className="mt-1 text-lg font-semibold">{formatCurrency(cash)}</div>
          </div>
          <div data-testid="paper-equity-card" className="rounded-xl border border-white/10 p-3 theme-day:border-slate-200">
            <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Equity</div>
            <div data-testid="paper-equity-value" className="mt-1 text-lg font-semibold">{formatCurrency(equity)}</div>
          </div>
          <div data-testid="paper-market-value-card" className="rounded-xl border border-white/10 p-3 theme-day:border-slate-200">
            <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Positions</div>
            <div data-testid="paper-market-value" className="mt-1 text-lg font-semibold">{formatCurrency(marketValue)}</div>
          </div>
        </div>
        <div data-testid="paper-status-message" className="mt-3 rounded-xl border border-primary/20 bg-primary/10 p-3 text-xs text-muted-foreground">{message}</div>
      </section>

      <section data-testid="paper-order-ticket" className="rounded-2xl border border-white/10 bg-white/[0.035] p-4 theme-day:border-slate-200 theme-day:bg-white">
        <div className="mb-3">
          <div data-testid="paper-ticket-title" className="text-sm font-semibold">Order ticket</div>
          <div data-testid="paper-ticket-symbol" className="text-xs text-muted-foreground">Current symbol: {symbol}</div>
        </div>
        <div className="grid gap-3">
          <label data-testid="paper-side-control" className="grid gap-1 text-xs text-muted-foreground">
            Side
            <select data-testid="paper-side-select" value={side} onChange={(event) => setSide(event.target.value as PaperSide)} className="rounded-xl border border-white/10 bg-background px-3 py-2 text-sm text-foreground outline-none theme-day:border-slate-200">
              <option data-testid="paper-side-option-buy" value="buy">Buy</option>
              <option data-testid="paper-side-option-sell" value="sell">Sell</option>
            </select>
          </label>
          <label data-testid="paper-order-type-control" className="grid gap-1 text-xs text-muted-foreground">
            Type
            <select data-testid="paper-order-type-select" value={orderType} onChange={(event) => setOrderType(event.target.value as PaperOrderType)} className="rounded-xl border border-white/10 bg-background px-3 py-2 text-sm text-foreground outline-none theme-day:border-slate-200">
              <option data-testid="paper-order-type-option-market" value="market">Market</option>
              <option data-testid="paper-order-type-option-limit" value="limit">Limit</option>
            </select>
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label data-testid="paper-quantity-control" className="grid gap-1 text-xs text-muted-foreground">
              Quantity
              <input data-testid="paper-quantity-input" value={quantity} onChange={(event) => setQuantity(event.target.value)} inputMode="decimal" className="rounded-xl border border-white/10 bg-background px-3 py-2 text-sm text-foreground outline-none theme-day:border-slate-200" />
            </label>
            <label data-testid="paper-limit-price-control" className="grid gap-1 text-xs text-muted-foreground">
              Reference / limit
              <input data-testid="paper-limit-price-input" value={limitPrice} onChange={(event) => setLimitPrice(event.target.value)} inputMode="decimal" className="rounded-xl border border-white/10 bg-background px-3 py-2 text-sm text-foreground outline-none theme-day:border-slate-200" />
            </label>
          </div>
          <div data-testid="paper-order-notional" className="rounded-xl border border-white/10 px-3 py-2 text-xs text-muted-foreground theme-day:border-slate-200">
            Est. notional: <span className="font-semibold text-foreground">{formatCurrency(notional)}</span>
          </div>
          <Button data-testid="paper-place-order-button" onClick={placeOrder} className="w-full">Place paper order</Button>
        </div>
      </section>

      <section data-testid="paper-activity-card" className="grid min-h-0 gap-3 rounded-2xl border border-white/10 bg-white/[0.035] p-4 theme-day:border-slate-200 theme-day:bg-white">
        <div>
          <div data-testid="paper-positions-title" className="text-sm font-semibold">Open positions</div>
          <div data-testid="paper-positions-list" className="mt-2 max-h-24 overflow-auto rounded-xl border border-white/10 theme-day:border-slate-200">
            {positions.length === 0 ? (
              <div data-testid="paper-positions-empty" className="p-3 text-xs text-muted-foreground">No open paper positions.</div>
            ) : (
              positions.map((position) => (
                <div key={position.symbol} data-testid={`paper-position-${position.symbol.toLowerCase()}`} className="grid grid-cols-3 gap-2 border-b border-white/10 p-3 text-xs last:border-b-0 theme-day:border-slate-200">
                  <span data-testid={`paper-position-${position.symbol.toLowerCase()}-symbol`} className="font-semibold text-foreground">{position.symbol}</span>
                  <span data-testid={`paper-position-${position.symbol.toLowerCase()}-quantity`}>{position.quantity}</span>
                  <span data-testid={`paper-position-${position.symbol.toLowerCase()}-average-price`}>{formatCurrency(position.averagePrice)}</span>
                </div>
              ))
            )}
          </div>
        </div>
        <div className="min-h-0">
          <div data-testid="paper-orders-title" className="text-sm font-semibold">Order log</div>
          <div data-testid="paper-orders-list" className="mt-2 max-h-36 overflow-auto rounded-xl border border-white/10 theme-day:border-slate-200">
            {orders.length === 0 ? (
              <div data-testid="paper-orders-empty" className="p-3 text-xs text-muted-foreground">No paper orders yet.</div>
            ) : (
              orders.map((order) => (
                <div key={order.id} data-testid={`paper-order-${order.id.toLowerCase()}`} className="border-b border-white/10 p-3 text-xs last:border-b-0 theme-day:border-slate-200">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-foreground">{order.side.toUpperCase()} {order.quantity} {order.symbol}</span>
                    <span data-testid={`paper-order-${order.id.toLowerCase()}-status`} className={order.status === 'filled' ? 'text-primary' : 'text-destructive'}>{order.status}</span>
                  </div>
                  <div className="mt-1 text-muted-foreground">{order.time} · {order.type} · {formatCurrency(order.price)}</div>
                  <div data-testid={`paper-order-${order.id.toLowerCase()}-message`} className="mt-1 text-muted-foreground">{order.message}</div>
                </div>
              ))
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

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
          <Tabs.Content data-testid="bottom-console-paper-content" value="paper" className="m-0 h-full">
            <PaperTradingConsole />
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
