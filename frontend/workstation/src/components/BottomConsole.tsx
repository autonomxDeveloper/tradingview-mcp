import type { ElementType } from 'react';
import { useMemo, useState } from 'react';
import * as Tabs from '@radix-ui/react-tabs';
import { useQuery } from '@tanstack/react-query';
import { Activity, Bot, ChevronDown, Database, FileText, ShieldAlert, Terminal, WalletCards } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { inferAssetType, workstationApi } from '@/lib/api';
import { useUiStore } from '@/store/ui-store';

const consoleTabs: Array<{ value: string; icon: ElementType; label: string }> = [
  { value: 'console', icon: Terminal, label: 'Console' },
  { value: 'paper', icon: WalletCards, label: 'Paper Trading' },
  { value: 'ai-trading', icon: Bot, label: 'AI Trading' },
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

type AiTradingMode = 'observe' | 'suggest' | 'auto-paper';
type AiDecisionAction = 'buy' | 'sell' | 'hold';

type AiTradingDecision = {
  id: string;
  time: string;
  symbol: string;
  timeframe: string;
  action: AiDecisionAction;
  confidence: number;
  rationale: string;
  entryPrice: number;
  stopLoss: number;
  takeProfit: number;
  quantity: number;
  riskStatus: 'passed' | 'blocked' | 'not_required';
  riskReasons: string[];
};

type AiTradingEvent = {
  id: string;
  time: string;
  level: 'info' | 'success' | 'warning' | 'error';
  message: string;
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(value);

const formatPercent = (value: number) => `${Number.isFinite(value) ? value.toFixed(0) : '0'}%`;

const getAnalysisText = (payload: Record<string, unknown>) => {
  const analysis = payload.analysis as Record<string, unknown> | undefined;
  const content = analysis?.content;
  if (typeof content === 'string' && content.trim()) return content;
  const fallback = payload.content;
  return typeof fallback === 'string' ? fallback : '';
};

const getStructuredValue = (payload: Record<string, unknown>, key: string) => {
  const structured = payload.structured_analysis as Record<string, unknown> | undefined;
  const value = structured?.[key];
  return typeof value === 'string' ? value : '';
};

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

function AITradingConsole() {
  const symbol = useUiStore((state) => state.symbol);
  const timeframe = useUiStore((state) => state.timeframe);
  const assetType = useUiStore((state) => state.assetType);
  const exchange = useUiStore((state) => state.exchange);
  const [mode, setMode] = useState<AiTradingMode>('observe');
  const [strategy, setStrategy] = useState('swing');
  const [maxRiskPct, setMaxRiskPct] = useState('0.5');
  const [maxDailyLoss, setMaxDailyLoss] = useState('500');
  const [minConfidence, setMinConfidence] = useState('65');
  const [maxTradesPerDay, setMaxTradesPerDay] = useState('3');
  const [cycleStatus, setCycleStatus] = useState<'idle' | 'running' | 'paused' | 'stopped'>('idle');
  const [decision, setDecision] = useState<AiTradingDecision | null>(null);
  const [orders, setOrders] = useState<PaperOrder[]>([]);
  const [events, setEvents] = useState<AiTradingEvent[]>([
    { id: 'init', time: new Date().toLocaleTimeString(), level: 'info', message: 'AI trading is idle. Run one paper-safe cycle to begin.' },
  ]);

  const parsedMaxRiskPct = Number(maxRiskPct);
  const parsedMaxDailyLoss = Number(maxDailyLoss);
  const parsedMinConfidence = Number(minConfidence);
  const parsedMaxTrades = Number(maxTradesPerDay);
  const todayFilledTrades = orders.filter((order) => order.status === 'filled').length;
  const accountEquity = 100_000;

  const appendEvent = (level: AiTradingEvent['level'], message: string) => {
    setEvents((items) => [{ id: `E-${Date.now()}-${items.length}`, time: new Date().toLocaleTimeString(), level, message }, ...items].slice(0, 50));
  };

  const emergencyStop = () => {
    setCycleStatus('stopped');
    appendEvent('error', 'Emergency stop engaged. AI trading cycle execution disabled until reset.');
  };

  const resetSession = () => {
    setCycleStatus('idle');
    setDecision(null);
    setOrders([]);
    setEvents([{ id: `E-${Date.now()}`, time: new Date().toLocaleTimeString(), level: 'info', message: 'AI trading session reset.' }]);
  };

  const fillAiPaperOrder = (nextDecision: AiTradingDecision) => {
    if (nextDecision.action === 'hold') {
      appendEvent('info', 'No paper order placed because the model decision was HOLD.');
      return;
    }
    const filled: PaperOrder = {
      id: `AI-P-${Date.now()}`,
      time: new Date().toLocaleTimeString(),
      symbol: nextDecision.symbol,
      side: nextDecision.action,
      type: 'market',
      quantity: nextDecision.quantity,
      price: nextDecision.entryPrice,
      status: 'filled',
      message: `AI ${nextDecision.action.toUpperCase()} ${nextDecision.quantity} ${nextDecision.symbol} @ ${formatCurrency(nextDecision.entryPrice)} filled in auto-paper mode.`,
    };
    setOrders((items) => [filled, ...items].slice(0, 25));
    appendEvent('success', filled.message);
  };

  const runCycle = async () => {
    if (cycleStatus === 'stopped') {
      appendEvent('error', 'Emergency stop is active. Reset the session before running another cycle.');
      return;
    }

    const normalizedSymbol = symbol.trim().toUpperCase() || 'BTCUSDT';
    const resolvedAssetType = inferAssetType(normalizedSymbol, assetType);
    setCycleStatus('running');
    appendEvent('info', `Started AI cycle for ${normalizedSymbol} on ${timeframe}.`);

    try {
      const chartContext = await workstationApi.chart(normalizedSymbol, timeframe, assetType, 300);
      appendEvent('success', 'Market context loaded.');

      const analysisPayload = await workstationApi.analyze({
        symbol: normalizedSymbol,
        asset_type: resolvedAssetType,
        exchange,
        timeframe,
        question: `Create a concise automated trading decision for ${normalizedSymbol}. Return a conservative buy, sell, or hold thesis with risk levels. Strategy=${strategy}. Mode=${mode}.`,
      });
      appendEvent('success', 'LLM analysis completed.');

      const bars = Array.isArray(chartContext.candles)
        ? chartContext.candles
        : Array.isArray(chartContext.bars)
          ? chartContext.bars
          : Array.isArray(chartContext.data)
            ? chartContext.data
            : [];
      const lastBar = bars[bars.length - 1] as { close?: string | number; high?: string | number; low?: string | number } | undefined;
      const priorBar = bars[bars.length - 20] as { close?: string | number } | undefined;
      const close = Number(lastBar?.close ?? 100);
      const priorClose = Number(priorBar?.close ?? close);
      const price = Number.isFinite(close) && close > 0 ? close : 100;
      const drift = priorClose > 0 ? (price - priorClose) / priorClose : 0;
      const trend = getStructuredValue(analysisPayload, 'trend').toLowerCase();
      const rawText = `${getStructuredValue(analysisPayload, 'summary')} ${getAnalysisText(analysisPayload)}`.toLowerCase();
      const confidenceFromPayload = Number((analysisPayload.structured_analysis as Record<string, unknown> | undefined)?.confidence);
      const confidence = Number.isFinite(confidenceFromPayload)
        ? Math.max(0, Math.min(100, confidenceFromPayload > 1 ? confidenceFromPayload : confidenceFromPayload * 100))
        : Math.max(45, Math.min(82, 58 + Math.abs(drift) * 450));
      const action: AiDecisionAction =
        trend.includes('bear') || rawText.includes('sell') || drift < -0.025
          ? 'sell'
          : trend.includes('bull') || rawText.includes('buy') || drift > 0.025
            ? 'buy'
            : 'hold';
      const stopDistance = price * 0.015;
      const riskBudget = accountEquity * ((Number.isFinite(parsedMaxRiskPct) ? parsedMaxRiskPct : 0.5) / 100);
      const quantity = action === 'hold' ? 0 : Math.max(0.0001, Number((riskBudget / stopDistance).toFixed(resolvedAssetType === 'crypto' ? 5 : 2)));
      const stopLoss = action === 'sell' ? price + stopDistance : price - stopDistance;
      const takeProfit = action === 'sell' ? price - stopDistance * 2 : price + stopDistance * 2;
      const riskReasons: string[] = [];
      if (action !== 'hold' && confidence < (Number.isFinite(parsedMinConfidence) ? parsedMinConfidence : 65)) {
        riskReasons.push(`Confidence ${formatPercent(confidence)} is below minimum ${minConfidence}%.`);
      }
      if (action !== 'hold' && todayFilledTrades >= (Number.isFinite(parsedMaxTrades) ? parsedMaxTrades : 3)) {
        riskReasons.push(`Max trades per day reached (${maxTradesPerDay}).`);
      }
      if (action !== 'hold' && riskBudget > (Number.isFinite(parsedMaxDailyLoss) ? parsedMaxDailyLoss : 500)) {
        riskReasons.push(`Risk budget ${formatCurrency(riskBudget)} exceeds max daily loss ${formatCurrency(Number(maxDailyLoss))}.`);
      }

      const nextDecision: AiTradingDecision = {
        id: `D-${Date.now()}`,
        time: new Date().toLocaleTimeString(),
        symbol: normalizedSymbol,
        timeframe,
        action,
        confidence,
        rationale: getStructuredValue(analysisPayload, 'summary') || getAnalysisText(analysisPayload) || 'Model returned a decision from current market context.',
        entryPrice: price,
        stopLoss,
        takeProfit,
        quantity,
        riskStatus: action === 'hold' ? 'not_required' : riskReasons.length === 0 ? 'passed' : 'blocked',
        riskReasons,
      };

      setDecision(nextDecision);
      appendEvent(nextDecision.riskStatus === 'blocked' ? 'warning' : 'success', `Decision: ${nextDecision.action.toUpperCase()} with ${formatPercent(nextDecision.confidence)} confidence.`);

      if (mode === 'auto-paper' && nextDecision.riskStatus === 'passed') {
        fillAiPaperOrder(nextDecision);
      } else if (mode === 'suggest' && nextDecision.action !== 'hold') {
        appendEvent('info', 'Trade proposal is waiting for manual approval.');
      } else if (mode === 'observe') {
        appendEvent('info', 'Observe mode only: no order created.');
      }
      setCycleStatus('idle');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'AI trading cycle failed.';
      appendEvent('error', message);
      setCycleStatus('idle');
    }
  };

  const approveDecision = () => {
    if (!decision || decision.action === 'hold') return;
    if (decision.riskStatus !== 'passed') {
      appendEvent('error', 'Approval blocked by deterministic risk gate.');
      return;
    }
    fillAiPaperOrder(decision);
  };

  const rejectDecision = () => {
    if (!decision) return;
    appendEvent('warning', `Rejected ${decision.action.toUpperCase()} proposal for ${decision.symbol}.`);
    setDecision(null);
  };

  return (
    <div data-testid="ai-trading-console" className="grid h-full min-h-[260px] gap-4 xl:grid-cols-[1fr_1.1fr_1fr]">
      <section data-testid="ai-trading-controls-card" className="rounded-2xl border border-white/10 bg-white/[0.035] p-4 theme-day:border-slate-200 theme-day:bg-white">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <div data-testid="ai-trading-title" className="text-sm font-semibold">Automated AI Trading</div>
            <div data-testid="ai-trading-subtitle" className="text-xs text-muted-foreground">Paper-safe cycle runner. No live broker orders are sent.</div>
          </div>
          <div data-testid="ai-trading-status-pill" className="rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-primary">{cycleStatus}</div>
        </div>

        <div className="grid gap-3">
          <label data-testid="ai-trading-mode-control" className="grid gap-1 text-xs text-muted-foreground">
            Execution mode
            <select data-testid="ai-trading-mode-select" value={mode} onChange={(event) => setMode(event.target.value as AiTradingMode)} className="rounded-xl border border-white/10 bg-background px-3 py-2 text-sm text-foreground outline-none theme-day:border-slate-200">
              <option data-testid="ai-trading-mode-option-observe" value="observe">Observe only</option>
              <option data-testid="ai-trading-mode-option-suggest" value="suggest">Suggest trades</option>
              <option data-testid="ai-trading-mode-option-auto-paper" value="auto-paper">Auto-paper trade</option>
            </select>
          </label>
          <label data-testid="ai-trading-strategy-control" className="grid gap-1 text-xs text-muted-foreground">
            Strategy profile
            <select data-testid="ai-trading-strategy-select" value={strategy} onChange={(event) => setStrategy(event.target.value)} className="rounded-xl border border-white/10 bg-background px-3 py-2 text-sm text-foreground outline-none theme-day:border-slate-200">
              <option data-testid="ai-trading-strategy-option-scalp" value="scalp">Scalping</option>
              <option data-testid="ai-trading-strategy-option-intraday" value="intraday">Intraday</option>
              <option data-testid="ai-trading-strategy-option-swing" value="swing">Swing</option>
              <option data-testid="ai-trading-strategy-option-position" value="position">Position</option>
            </select>
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label data-testid="ai-trading-risk-per-trade-control" className="grid gap-1 text-xs text-muted-foreground">
              Risk / trade %
              <input data-testid="ai-trading-risk-per-trade-input" value={maxRiskPct} onChange={(event) => setMaxRiskPct(event.target.value)} inputMode="decimal" className="rounded-xl border border-white/10 bg-background px-3 py-2 text-sm text-foreground outline-none theme-day:border-slate-200" />
            </label>
            <label data-testid="ai-trading-min-confidence-control" className="grid gap-1 text-xs text-muted-foreground">
              Min confidence %
              <input data-testid="ai-trading-min-confidence-input" value={minConfidence} onChange={(event) => setMinConfidence(event.target.value)} inputMode="decimal" className="rounded-xl border border-white/10 bg-background px-3 py-2 text-sm text-foreground outline-none theme-day:border-slate-200" />
            </label>
            <label data-testid="ai-trading-max-daily-loss-control" className="grid gap-1 text-xs text-muted-foreground">
              Max daily loss $
              <input data-testid="ai-trading-max-daily-loss-input" value={maxDailyLoss} onChange={(event) => setMaxDailyLoss(event.target.value)} inputMode="decimal" className="rounded-xl border border-white/10 bg-background px-3 py-2 text-sm text-foreground outline-none theme-day:border-slate-200" />
            </label>
            <label data-testid="ai-trading-max-trades-control" className="grid gap-1 text-xs text-muted-foreground">
              Max trades/day
              <input data-testid="ai-trading-max-trades-input" value={maxTradesPerDay} onChange={(event) => setMaxTradesPerDay(event.target.value)} inputMode="numeric" className="rounded-xl border border-white/10 bg-background px-3 py-2 text-sm text-foreground outline-none theme-day:border-slate-200" />
            </label>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Button data-testid="ai-trading-run-cycle-button" disabled={cycleStatus === 'running'} onClick={runCycle}>{cycleStatus === 'running' ? 'Running...' : 'Run AI cycle'}</Button>
            <Button data-testid="ai-trading-pause-button" variant="terminal" onClick={() => { setCycleStatus('paused'); appendEvent('warning', 'AI trading paused.'); }}>Pause</Button>
            <Button data-testid="ai-trading-emergency-stop-button" variant="terminal" onClick={emergencyStop} className="border-destructive/40 text-destructive"><ShieldAlert size={14} /> E-stop</Button>
            <Button data-testid="ai-trading-reset-session-button" variant="terminal" onClick={resetSession}>Reset</Button>
          </div>
        </div>
      </section>

      <section data-testid="ai-trading-decision-card" className="rounded-2xl border border-white/10 bg-white/[0.035] p-4 theme-day:border-slate-200 theme-day:bg-white">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <div data-testid="ai-trading-decision-title" className="text-sm font-semibold">Decision</div>
            <div data-testid="ai-trading-symbol-timeframe" className="text-xs text-muted-foreground">{symbol} · {timeframe} · {inferAssetType(symbol, assetType)}</div>
          </div>
          <div data-testid="ai-trading-decision-action" className="rounded-full border border-white/10 px-3 py-1 text-xs font-semibold uppercase theme-day:border-slate-200">{decision?.action ?? 'none'}</div>
        </div>

        {decision ? (
          <div className="grid gap-3">
            <div className="grid gap-2 sm:grid-cols-3">
              <div data-testid="ai-trading-decision-confidence" className="rounded-xl border border-white/10 p-3 theme-day:border-slate-200">
                <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Confidence</div>
                <div className="mt-1 text-lg font-semibold">{formatPercent(decision.confidence)}</div>
              </div>
              <div data-testid="ai-trading-risk-gate-status" className="rounded-xl border border-white/10 p-3 theme-day:border-slate-200">
                <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Risk gate</div>
                <div className={decision.riskStatus === 'blocked' ? 'mt-1 text-lg font-semibold text-destructive' : 'mt-1 text-lg font-semibold text-primary'}>{decision.riskStatus}</div>
              </div>
              <div data-testid="ai-trading-proposed-size" className="rounded-xl border border-white/10 p-3 theme-day:border-slate-200">
                <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Size</div>
                <div className="mt-1 text-lg font-semibold">{decision.quantity}</div>
              </div>
            </div>
            <div data-testid="ai-trading-decision-rationale" className="max-h-24 overflow-auto rounded-xl border border-white/10 p-3 text-xs text-muted-foreground theme-day:border-slate-200">{decision.rationale}</div>
            <div data-testid="ai-trading-proposed-order-card" className="grid gap-2 rounded-xl border border-primary/20 bg-primary/10 p-3 text-xs sm:grid-cols-2">
              <div>Entry: <span data-testid="ai-trading-entry-price" className="font-semibold text-foreground">{formatCurrency(decision.entryPrice)}</span></div>
              <div>Stop: <span data-testid="ai-trading-stop-loss" className="font-semibold text-foreground">{formatCurrency(decision.stopLoss)}</span></div>
              <div>Target: <span data-testid="ai-trading-take-profit" className="font-semibold text-foreground">{formatCurrency(decision.takeProfit)}</span></div>
              <div>Mode: <span data-testid="ai-trading-current-mode" className="font-semibold text-foreground">{mode}</span></div>
            </div>
            {decision.riskReasons.length > 0 && (
              <ul data-testid="ai-trading-risk-reasons" className="grid gap-1 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
                {decision.riskReasons.map((reason) => <li key={reason}>• {reason}</li>)}
              </ul>
            )}
            <div className="grid grid-cols-2 gap-2">
              <Button data-testid="ai-trading-approve-order-button" disabled={!decision || decision.action === 'hold' || decision.riskStatus !== 'passed'} onClick={approveDecision}>Approve to paper</Button>
              <Button data-testid="ai-trading-reject-order-button" variant="terminal" disabled={!decision} onClick={rejectDecision}>Reject</Button>
            </div>
          </div>
        ) : (
          <div data-testid="ai-trading-decision-empty" className="grid min-h-[210px] place-items-center rounded-2xl border border-dashed border-white/10 text-center text-sm text-muted-foreground theme-day:border-slate-200">
            Run an AI cycle to generate a paper-safe trade decision.
          </div>
        )}
      </section>

      <section data-testid="ai-trading-activity-card" className="grid min-h-0 gap-3 rounded-2xl border border-white/10 bg-white/[0.035] p-4 theme-day:border-slate-200 theme-day:bg-white">
        <div>
          <div data-testid="ai-trading-paper-orders-title" className="text-sm font-semibold">AI paper orders</div>
          <div data-testid="ai-trading-paper-orders-list" className="mt-2 max-h-28 overflow-auto rounded-xl border border-white/10 theme-day:border-slate-200">
            {orders.length === 0 ? (
              <div data-testid="ai-trading-paper-orders-empty" className="p-3 text-xs text-muted-foreground">No AI paper orders yet.</div>
            ) : (
              orders.map((order) => (
                <div key={order.id} data-testid={`ai-trading-order-${order.id.toLowerCase()}`} className="border-b border-white/10 p-3 text-xs last:border-b-0 theme-day:border-slate-200">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-foreground">{order.side.toUpperCase()} {order.quantity} {order.symbol}</span>
                    <span className="text-primary">{order.status}</span>
                  </div>
                  <div className="mt-1 text-muted-foreground">{order.time} · {formatCurrency(order.price)}</div>
                </div>
              ))
            )}
          </div>
        </div>
        <div className="min-h-0">
          <div data-testid="ai-trading-event-log-title" className="text-sm font-semibold">Event log</div>
          <div data-testid="ai-trading-event-log" className="mt-2 max-h-48 overflow-auto rounded-xl border border-white/10 theme-day:border-slate-200">
            {events.map((event) => (
              <div key={event.id} data-testid={`ai-trading-event-${event.id.toLowerCase()}`} className="border-b border-white/10 p-3 text-xs last:border-b-0 theme-day:border-slate-200">
                <div className="flex items-center justify-between gap-2">
                  <span className={event.level === 'error' ? 'font-semibold text-destructive' : event.level === 'success' ? 'font-semibold text-primary' : 'font-semibold text-foreground'}>{event.level}</span>
                  <span className="text-muted-foreground">{event.time}</span>
                </div>
                <div className="mt-1 text-muted-foreground">{event.message}</div>
              </div>
            ))}
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
          <Tabs.Content data-testid="bottom-console-ai-trading-content" value="ai-trading" className="m-0 h-full">
            <AITradingConsole />
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
