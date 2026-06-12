import { useEffect, useMemo, useRef, useState } from 'react';
import { Download, Save, ShieldAlert, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { inferAssetType, workstationApi } from '@/lib/api';
import { useUiStore } from '@/store/ui-store';

type PaperSide = 'buy' | 'sell';
type PaperOrderType = 'market' | 'limit';
type PaperOrderSource = 'manual' | 'ai';
type AiTradingMode = 'observe' | 'suggest' | 'auto-paper';
type AiDecisionAction = 'buy' | 'sell' | 'hold';
type CycleStatus = 'idle' | 'running' | 'paused' | 'stopped';
type BacktestGateMode = 'off' | 'warn' | 'required';

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
type MarketBar = { close?: string | number; high?: string | number; low?: string | number };
type BacktestResult = {
  status: 'passed' | 'blocked' | 'warning' | 'skipped';
  reason: string;
  tradeCount: number;
  winRate: number;
  totalReturnPct: number;
};
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
  backtest: BacktestResult;
};
type AiTradingEvent = { id: string; time: string; level: 'info' | 'success' | 'warning' | 'error'; message: string };

type AiTradingSavedSession = {
  version: 2;
  savedAt: string;
  mode: AiTradingMode;
  strategy: string;
  maxRiskPct: string;
  maxDailyLoss: string;
  minConfidence: string;
  maxTradesPerDay: string;
  cycleIntervalSec: string;
  cooldownSec: string;
  backtestGateMode: BacktestGateMode;
  minBacktestReturnPct: string;
  minBacktestWinRate: string;
  minBacktestTrades: string;
  cycleCount: number;
  skippedCycles: number;
  lastCycleAt: number | null;
  decision: AiTradingDecision | null;
  orders: PaperOrder[];
  events: AiTradingEvent[];
};

type AITradingConsoleProps = {
  paperAccount: PaperAccountState;
  paperEquity: number;
  paperMarketValue: number;
  placePaperOrder: (input: { symbol: string; side: PaperSide; type: PaperOrderType; quantity: number; price: number; source: PaperOrderSource }) => PaperOrder;
};

const AI_TRADING_STORAGE_KEY = 'tradingview-workstation.ai-trading-session.v2';
const LEGACY_AI_TRADING_STORAGE_KEY = 'tradingview-workstation.ai-trading-session.v1';
const MAX_AI_EVENTS = 100;
const MAX_AI_ORDERS = 75;

const formatCurrency = (value: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(value);
const formatPercent = (value: number) => `${Number.isFinite(value) ? value.toFixed(0) : '0'}%`;
const formatCountdown = (seconds: number) => `${Math.max(0, Math.ceil(seconds))}s`;
const safeTestId = (value: string) => value.toLowerCase().replace(/[^a-z0-9-]+/g, '-');

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

const getBars = (payload: Record<string, unknown>) => {
  if (Array.isArray(payload.candles)) return payload.candles as MarketBar[];
  if (Array.isArray(payload.bars)) return payload.bars as MarketBar[];
  if (Array.isArray(payload.data)) return payload.data as MarketBar[];
  const candles = payload.candles as Record<string, unknown> | undefined;
  if (candles && Array.isArray(candles.bars)) return candles.bars as MarketBar[];
  return [];
};

const closeSeries = (bars: MarketBar[]) => bars.map((bar) => Number(bar.close)).filter((value) => Number.isFinite(value) && value > 0);
const sma = (series: number[], endExclusive: number, length: number) => {
  if (endExclusive < length) return null;
  const slice = series.slice(endExclusive - length, endExclusive);
  return slice.reduce((sum, value) => sum + value, 0) / length;
};

const runSmaBacktest = (
  bars: MarketBar[],
  action: AiDecisionAction,
  gateMode: BacktestGateMode,
  minReturnPct: number,
  minWinRate: number,
  minTrades: number,
): BacktestResult => {
  if (action === 'hold' || gateMode === 'off') return { status: 'skipped', reason: 'Backtest gate is not required for this decision.', tradeCount: 0, winRate: 0, totalReturnPct: 0 };
  const prices = closeSeries(bars).slice(-240);
  if (prices.length < 60) return { status: gateMode === 'required' ? 'blocked' : 'warning', reason: `Only ${prices.length} usable bars available; at least 60 are needed.`, tradeCount: 0, winRate: 0, totalReturnPct: 0 };

  const returns: number[] = [];
  let entry: number | null = null;
  for (let index = 31; index < prices.length; index += 1) {
    const fastPrev = sma(prices, index - 1, 10);
    const slowPrev = sma(prices, index - 1, 30);
    const fast = sma(prices, index, 10);
    const slow = sma(prices, index, 30);
    if (fastPrev === null || slowPrev === null || fast === null || slow === null) continue;
    const bullishCross = fastPrev <= slowPrev && fast > slow;
    const bearishCross = fastPrev >= slowPrev && fast < slow;
    const enterSignal = action === 'buy' ? bullishCross : bearishCross;
    const exitSignal = action === 'buy' ? bearishCross : bullishCross;
    if (entry === null && enterSignal) entry = prices[index];
    else if (entry !== null && exitSignal) {
      const exit = prices[index];
      const ret = action === 'buy' ? (exit - entry) / entry : (entry - exit) / entry;
      returns.push(ret);
      entry = null;
    }
  }
  if (entry !== null) {
    const exit = prices[prices.length - 1];
    returns.push(action === 'buy' ? (exit - entry) / entry : (entry - exit) / entry);
  }

  const tradeCount = returns.length;
  const wins = returns.filter((value) => value > 0).length;
  const winRate = tradeCount > 0 ? (wins / tradeCount) * 100 : 0;
  const totalReturnPct = returns.reduce((total, value) => total + value, 0) * 100;
  const failures: string[] = [];
  if (tradeCount < minTrades) failures.push(`trades ${tradeCount}/${minTrades}`);
  if (winRate < minWinRate) failures.push(`win rate ${formatPercent(winRate)}/${formatPercent(minWinRate)}`);
  if (totalReturnPct < minReturnPct) failures.push(`return ${totalReturnPct.toFixed(2)}%/${minReturnPct.toFixed(2)}%`);
  const passed = failures.length === 0;
  return {
    status: passed ? 'passed' : gateMode === 'required' ? 'blocked' : 'warning',
    reason: passed ? `Backtest passed: ${tradeCount} trades, ${formatPercent(winRate)} win rate, ${totalReturnPct.toFixed(2)}% return.` : `Backtest ${gateMode === 'required' ? 'blocked' : 'warned'}: ${failures.join(', ')}.`,
    tradeCount,
    winRate,
    totalReturnPct,
  };
};

export function AITradingConsole({ paperAccount, paperEquity, paperMarketValue, placePaperOrder }: AITradingConsoleProps) {
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
  const [cycleIntervalSec, setCycleIntervalSec] = useState('60');
  const [cooldownSec, setCooldownSec] = useState('120');
  const [backtestGateMode, setBacktestGateMode] = useState<BacktestGateMode>('warn');
  const [minBacktestReturnPct, setMinBacktestReturnPct] = useState('0');
  const [minBacktestWinRate, setMinBacktestWinRate] = useState('45');
  const [minBacktestTrades, setMinBacktestTrades] = useState('2');
  const [autoEnabled, setAutoEnabled] = useState(false);
  const [lastCycleAt, setLastCycleAt] = useState<number | null>(null);
  const [cycleCount, setCycleCount] = useState(0);
  const [skippedCycles, setSkippedCycles] = useState(0);
  const [cycleStatus, setCycleStatus] = useState<CycleStatus>('idle');
  const [decision, setDecision] = useState<AiTradingDecision | null>(null);
  const [orders, setOrders] = useState<PaperOrder[]>([]);
  const [events, setEvents] = useState<AiTradingEvent[]>([{ id: 'init', time: new Date().toLocaleTimeString(), level: 'info', message: 'AI trading is idle. Run one paper-safe cycle to begin.' }]);
  const [persistMessage, setPersistMessage] = useState('Session is not saved yet.');
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const runningRef = useRef(false);

  const parsedMaxRiskPct = Number(maxRiskPct);
  const parsedMaxDailyLoss = Number(maxDailyLoss);
  const parsedMinConfidence = Number(minConfidence);
  const parsedMaxTrades = Number(maxTradesPerDay);
  const parsedIntervalSec = Number(cycleIntervalSec);
  const parsedCooldownSec = Number(cooldownSec);
  const parsedMinBacktestReturnPct = Number(minBacktestReturnPct);
  const parsedMinBacktestWinRate = Number(minBacktestWinRate);
  const parsedMinBacktestTrades = Number(minBacktestTrades);
  const todayFilledTrades = paperAccount.orders.filter((order) => order.status === 'filled' && order.source === 'ai').length;
  const secondsSinceLastCycle = lastCycleAt ? (Date.now() - lastCycleAt) / 1000 : Number.POSITIVE_INFINITY;
  const cooldownRemaining = Math.max(0, (Number.isFinite(parsedCooldownSec) ? parsedCooldownSec : 120) - secondsSinceLastCycle);

  const buildSession = (): AiTradingSavedSession => ({ version: 2, savedAt: new Date().toISOString(), mode, strategy, maxRiskPct, maxDailyLoss, minConfidence, maxTradesPerDay, cycleIntervalSec, cooldownSec, backtestGateMode, minBacktestReturnPct, minBacktestWinRate, minBacktestTrades, cycleCount, skippedCycles, lastCycleAt, decision, orders, events });
  const appendEvent = (level: AiTradingEvent['level'], message: string) => setEvents((items) => [{ id: `E-${Date.now()}-${items.length}`, time: new Date().toLocaleTimeString(), level, message }, ...items].slice(0, MAX_AI_EVENTS));

  const applySession = (session: Partial<AiTradingSavedSession>, source: string) => {
    if (session.mode) setMode(session.mode);
    if (typeof session.strategy === 'string') setStrategy(session.strategy);
    if (typeof session.maxRiskPct === 'string') setMaxRiskPct(session.maxRiskPct);
    if (typeof session.maxDailyLoss === 'string') setMaxDailyLoss(session.maxDailyLoss);
    if (typeof session.minConfidence === 'string') setMinConfidence(session.minConfidence);
    if (typeof session.maxTradesPerDay === 'string') setMaxTradesPerDay(session.maxTradesPerDay);
    if (typeof session.cycleIntervalSec === 'string') setCycleIntervalSec(session.cycleIntervalSec);
    if (typeof session.cooldownSec === 'string') setCooldownSec(session.cooldownSec);
    if (session.backtestGateMode) setBacktestGateMode(session.backtestGateMode);
    if (typeof session.minBacktestReturnPct === 'string') setMinBacktestReturnPct(session.minBacktestReturnPct);
    if (typeof session.minBacktestWinRate === 'string') setMinBacktestWinRate(session.minBacktestWinRate);
    if (typeof session.minBacktestTrades === 'string') setMinBacktestTrades(session.minBacktestTrades);
    if (typeof session.cycleCount === 'number') setCycleCount(session.cycleCount);
    if (typeof session.skippedCycles === 'number') setSkippedCycles(session.skippedCycles);
    if (typeof session.lastCycleAt === 'number' || session.lastCycleAt === null) setLastCycleAt(session.lastCycleAt);
    setDecision(session.decision ?? null);
    setOrders(Array.isArray(session.orders) ? session.orders.slice(0, MAX_AI_ORDERS) : []);
    setEvents(Array.isArray(session.events) && session.events.length > 0 ? session.events.slice(0, MAX_AI_EVENTS) : [{ id: `E-${Date.now()}`, time: new Date().toLocaleTimeString(), level: 'info', message: `Loaded AI trading session from ${source}.` }]);
    setAutoEnabled(false);
    setCycleStatus('idle');
    runningRef.current = false;
    setPersistMessage(`Loaded session from ${source}.`);
  };

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(AI_TRADING_STORAGE_KEY) ?? window.localStorage.getItem(LEGACY_AI_TRADING_STORAGE_KEY);
      if (!raw) return;
      applySession(JSON.parse(raw) as Partial<AiTradingSavedSession>, 'browser storage');
    } catch {
      setPersistMessage('Could not load saved AI trading session.');
    }
  }, []);

  const saveSession = () => {
    const session = buildSession();
    window.localStorage.setItem(AI_TRADING_STORAGE_KEY, JSON.stringify(session));
    setPersistMessage(`Saved at ${new Date(session.savedAt).toLocaleTimeString()}.`);
    appendEvent('success', 'AI trading session saved to browser storage.');
  };

  const exportSession = () => {
    const packet = { ...buildSession(), symbol: symbol.trim().toUpperCase() || 'BTCUSDT', timeframe, assetType: inferAssetType(symbol, assetType), exchange, paperAccount: { cash: paperAccount.cash, equity: paperEquity, marketValue: paperMarketValue, positions: paperAccount.positions, orders: paperAccount.orders }, exportedAt: new Date().toISOString(), note: 'Paper-safe AI trading packet. No live broker orders are included.' };
    const blob = new Blob([JSON.stringify(packet, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `ai-trading-${safeTestId(packet.symbol)}-${Date.now()}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    appendEvent('success', 'Exported AI trading packet with shared paper account snapshot.');
    setPersistMessage('Exported current AI trading packet.');
  };

  const importSession = (file: File | undefined) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        applySession(JSON.parse(String(reader.result)) as Partial<AiTradingSavedSession>, file.name);
        appendEvent('success', `Imported AI trading session from ${file.name}.`);
      } catch {
        appendEvent('error', `Could not import ${file.name}; expected a JSON session packet.`);
      }
    };
    reader.readAsText(file);
  };

  const fillAiPaperOrder = (nextDecision: AiTradingDecision) => {
    if (nextDecision.action === 'hold') {
      appendEvent('info', 'No paper order placed because the model decision was HOLD.');
      return;
    }
    const filled = placePaperOrder({ symbol: nextDecision.symbol, side: nextDecision.action, type: 'market', quantity: nextDecision.quantity, price: nextDecision.entryPrice, source: 'ai' });
    setOrders((items) => [filled, ...items].slice(0, MAX_AI_ORDERS));
    appendEvent(filled.status === 'filled' ? 'success' : 'error', filled.message);
  };

  const runCycle = async (source: 'manual' | 'auto' = 'manual') => {
    if (cycleStatus === 'stopped') { appendEvent('error', 'Emergency stop is active. Reset the session before running another cycle.'); return; }
    if (runningRef.current) { setSkippedCycles((value) => value + 1); appendEvent('warning', 'Skipped cycle because another AI cycle is already running.'); return; }
    const safeCooldown = Number.isFinite(parsedCooldownSec) ? parsedCooldownSec : 120;
    if (source === 'auto' && lastCycleAt && Date.now() - lastCycleAt < safeCooldown * 1000) { setSkippedCycles((value) => value + 1); appendEvent('info', `Skipped auto cycle during cooldown (${formatCountdown(cooldownRemaining)} remaining).`); return; }

    const normalizedSymbol = symbol.trim().toUpperCase() || 'BTCUSDT';
    const resolvedAssetType = inferAssetType(normalizedSymbol, assetType);
    runningRef.current = true;
    setCycleStatus('running');
    setLastCycleAt(Date.now());
    setCycleCount((value) => value + 1);
    appendEvent('info', `${source === 'auto' ? 'Auto' : 'Manual'} AI cycle started for ${normalizedSymbol} on ${timeframe}.`);

    try {
      const chartContext = await workstationApi.chart(normalizedSymbol, timeframe, assetType, 300) as Record<string, unknown>;
      appendEvent('success', 'Market context loaded.');
      const analysisPayload = await workstationApi.analyze({ symbol: normalizedSymbol, asset_type: resolvedAssetType, exchange, timeframe, question: `Create a concise automated trading decision for ${normalizedSymbol}. Return a conservative buy, sell, or hold thesis with entry, stop, target, and risk levels. Strategy=${strategy}. Mode=${mode}.` }) as Record<string, unknown>;
      appendEvent('success', 'LLM analysis completed.');

      const bars = getBars(chartContext);
      const lastBar = bars[bars.length - 1];
      const priorBar = bars[Math.max(0, bars.length - 20)];
      const close = Number(lastBar?.close ?? 100);
      const priorClose = Number(priorBar?.close ?? close);
      const price = Number.isFinite(close) && close > 0 ? close : 100;
      const drift = priorClose > 0 ? (price - priorClose) / priorClose : 0;
      const trend = getStructuredValue(analysisPayload, 'trend').toLowerCase();
      const rawText = `${getStructuredValue(analysisPayload, 'summary')} ${getAnalysisText(analysisPayload)}`.toLowerCase();
      const confidenceFromPayload = Number((analysisPayload.structured_analysis as Record<string, unknown> | undefined)?.confidence);
      const confidence = Number.isFinite(confidenceFromPayload) ? Math.max(0, Math.min(100, confidenceFromPayload > 1 ? confidenceFromPayload : confidenceFromPayload * 100)) : Math.max(45, Math.min(82, 58 + Math.abs(drift) * 450));
      const action: AiDecisionAction = trend.includes('bear') || rawText.includes('sell') || drift < -0.025 ? 'sell' : trend.includes('bull') || rawText.includes('buy') || drift > 0.025 ? 'buy' : 'hold';
      const stopDistance = price * 0.015;
      const safeEquity = paperEquity > 0 ? paperEquity : 100_000;
      const riskBudget = safeEquity * ((Number.isFinite(parsedMaxRiskPct) ? parsedMaxRiskPct : 0.5) / 100);
      const quantity = action === 'hold' ? 0 : Math.max(0.0001, Number((riskBudget / stopDistance).toFixed(resolvedAssetType === 'crypto' ? 5 : 2)));
      const stopLoss = action === 'sell' ? price + stopDistance : price - stopDistance;
      const takeProfit = action === 'sell' ? price - stopDistance * 2 : price + stopDistance * 2;
      const riskReasons: string[] = [];
      const notional = quantity * price;
      const currentPosition = paperAccount.positions.find((position) => position.symbol === normalizedSymbol);
      const backtest = runSmaBacktest(bars, action, backtestGateMode, Number.isFinite(parsedMinBacktestReturnPct) ? parsedMinBacktestReturnPct : 0, Number.isFinite(parsedMinBacktestWinRate) ? parsedMinBacktestWinRate : 45, Number.isFinite(parsedMinBacktestTrades) ? parsedMinBacktestTrades : 2);

      if (action !== 'hold' && confidence < (Number.isFinite(parsedMinConfidence) ? parsedMinConfidence : 65)) riskReasons.push(`Confidence ${formatPercent(confidence)} is below minimum ${minConfidence}%.`);
      if (action !== 'hold' && todayFilledTrades >= (Number.isFinite(parsedMaxTrades) ? parsedMaxTrades : 3)) riskReasons.push(`Max AI trades per day reached (${maxTradesPerDay}).`);
      if (action !== 'hold' && riskBudget > (Number.isFinite(parsedMaxDailyLoss) ? parsedMaxDailyLoss : 500)) riskReasons.push(`Risk budget ${formatCurrency(riskBudget)} exceeds max daily loss ${formatCurrency(Number(maxDailyLoss))}.`);
      if (action === 'buy' && notional > paperAccount.cash) riskReasons.push(`Shared paper cash ${formatCurrency(paperAccount.cash)} is below required notional ${formatCurrency(notional)}.`);
      if (action === 'sell' && (!currentPosition || currentPosition.quantity < quantity)) riskReasons.push('Shared paper account does not have enough position quantity for covered sell.');
      if (action !== 'hold' && backtest.status === 'blocked') riskReasons.push(backtest.reason);

      const nextDecision: AiTradingDecision = { id: `D-${Date.now()}`, time: new Date().toLocaleTimeString(), symbol: normalizedSymbol, timeframe, action, confidence, rationale: getStructuredValue(analysisPayload, 'summary') || getAnalysisText(analysisPayload) || 'Model returned a decision from current market context.', entryPrice: price, stopLoss, takeProfit, quantity, riskStatus: action === 'hold' ? 'not_required' : riskReasons.length === 0 ? 'passed' : 'blocked', riskReasons, backtest };
      setDecision(nextDecision);
      if (backtest.status === 'passed') appendEvent('success', backtest.reason);
      else if (backtest.status === 'warning') appendEvent('warning', backtest.reason);
      else if (backtest.status === 'blocked') appendEvent('error', backtest.reason);
      appendEvent(nextDecision.riskStatus === 'blocked' ? 'warning' : 'success', `Decision: ${nextDecision.action.toUpperCase()} with ${formatPercent(nextDecision.confidence)} confidence.`);
      if (mode === 'auto-paper' && nextDecision.riskStatus === 'passed') fillAiPaperOrder(nextDecision);
      else if (mode === 'suggest' && nextDecision.action !== 'hold') appendEvent('info', 'Trade proposal is waiting for manual approval.');
      else if (mode === 'observe') appendEvent('info', 'Observe mode only: no order created.');
    } catch (error) {
      appendEvent('error', error instanceof Error ? error.message : 'AI trading cycle failed.');
    } finally {
      runningRef.current = false;
      setCycleStatus((value) => (value === 'stopped' || value === 'paused' ? value : 'idle'));
    }
  };

  useEffect(() => {
    if (!autoEnabled || cycleStatus === 'stopped') {
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = null;
      return;
    }
    const safeIntervalMs = Math.max(15, Number.isFinite(parsedIntervalSec) ? parsedIntervalSec : 60) * 1000;
    intervalRef.current = setInterval(() => { void runCycle('auto'); }, safeIntervalMs);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); intervalRef.current = null; };
  }, [autoEnabled, cycleStatus, parsedIntervalSec, parsedCooldownSec, symbol, timeframe, assetType, exchange, mode, strategy, maxRiskPct, maxDailyLoss, minConfidence, maxTradesPerDay, backtestGateMode, minBacktestReturnPct, minBacktestWinRate, minBacktestTrades, paperAccount.cash, paperAccount.positions.length, paperAccount.orders.length]);

  const startAuto = () => { if (cycleStatus === 'stopped') { appendEvent('error', 'Emergency stop is active. Reset before starting auto cycles.'); return; } setAutoEnabled(true); setCycleStatus('idle'); appendEvent('success', `Auto cycle enabled every ${cycleIntervalSec}s with ${cooldownSec}s cooldown.`); };
  const stopAuto = () => { setAutoEnabled(false); setCycleStatus('idle'); appendEvent('warning', 'Auto cycle stopped.'); };
  const pauseSession = () => { setAutoEnabled(false); setCycleStatus('paused'); appendEvent('warning', 'AI trading paused. Auto cycle disabled.'); };
  const emergencyStop = () => { setAutoEnabled(false); setCycleStatus('stopped'); appendEvent('error', 'Emergency stop engaged. AI trading cycle execution disabled until reset.'); };
  const resetSession = () => { setAutoEnabled(false); setCycleStatus('idle'); setDecision(null); setOrders([]); setCycleCount(0); setSkippedCycles(0); setLastCycleAt(null); runningRef.current = false; setEvents([{ id: `E-${Date.now()}`, time: new Date().toLocaleTimeString(), level: 'info', message: 'AI trading session reset.' }]); setPersistMessage('Session reset. Save to persist the reset state.'); };
  const approveDecision = () => { if (!decision || decision.action === 'hold') return; if (decision.riskStatus !== 'passed') { appendEvent('error', 'Approval blocked by deterministic risk/backtest gate.'); return; } fillAiPaperOrder(decision); };
  const rejectDecision = () => { if (!decision) return; appendEvent('warning', `Rejected ${decision.action.toUpperCase()} proposal for ${decision.symbol}.`); setDecision(null); };

  const decisionBacktest = decision?.backtest;

  return (
    <div data-testid="ai-trading-console" className="grid h-full min-h-[260px] gap-4 xl:grid-cols-[1fr_1.1fr_1fr]">
      <section data-testid="ai-trading-controls-card" className="rounded-2xl border border-white/10 bg-white/[0.035] p-4 theme-day:border-slate-200 theme-day:bg-white">
        <div className="mb-3 flex items-start justify-between gap-3"><div><div data-testid="ai-trading-title" className="text-sm font-semibold">Automated AI Trading</div><div data-testid="ai-trading-subtitle" className="text-xs text-muted-foreground">Paper-safe controller using the shared paper account. No live broker orders are sent.</div></div><div data-testid="ai-trading-status-pill" className="rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-primary">{autoEnabled ? 'auto' : cycleStatus}</div></div>
        <div data-testid="ai-trading-session-stats" className="mb-3 grid grid-cols-3 gap-2 text-xs"><div data-testid="ai-trading-cycle-count" className="rounded-xl border border-white/10 p-2 theme-day:border-slate-200">Cycles <b>{cycleCount}</b></div><div data-testid="ai-trading-skipped-count" className="rounded-xl border border-white/10 p-2 theme-day:border-slate-200">Skipped <b>{skippedCycles}</b></div><div data-testid="ai-trading-cooldown-remaining" className="rounded-xl border border-white/10 p-2 theme-day:border-slate-200">Cooldown <b>{formatCountdown(cooldownRemaining)}</b></div></div>
        <div data-testid="ai-trading-shared-account-card" className="mb-3 grid grid-cols-3 gap-2 text-xs"><div data-testid="ai-trading-paper-cash" className="rounded-xl border border-white/10 p-2 theme-day:border-slate-200">Cash <b>{formatCurrency(paperAccount.cash)}</b></div><div data-testid="ai-trading-paper-equity" className="rounded-xl border border-white/10 p-2 theme-day:border-slate-200">Equity <b>{formatCurrency(paperEquity)}</b></div><div data-testid="ai-trading-paper-positions-value" className="rounded-xl border border-white/10 p-2 theme-day:border-slate-200">Positions <b>{formatCurrency(paperMarketValue)}</b></div></div>
        <div className="grid gap-3">
          <label data-testid="ai-trading-mode-control" className="grid gap-1 text-xs text-muted-foreground">Execution mode<select data-testid="ai-trading-mode-select" value={mode} onChange={(event) => setMode(event.target.value as AiTradingMode)} className="rounded-xl border border-white/10 bg-background px-3 py-2 text-sm text-foreground outline-none theme-day:border-slate-200"><option data-testid="ai-trading-mode-option-observe" value="observe">Observe only</option><option data-testid="ai-trading-mode-option-suggest" value="suggest">Suggest trades</option><option data-testid="ai-trading-mode-option-auto-paper" value="auto-paper">Auto-paper trade</option></select></label>
          <label data-testid="ai-trading-strategy-control" className="grid gap-1 text-xs text-muted-foreground">Strategy profile<select data-testid="ai-trading-strategy-select" value={strategy} onChange={(event) => setStrategy(event.target.value)} className="rounded-xl border border-white/10 bg-background px-3 py-2 text-sm text-foreground outline-none theme-day:border-slate-200"><option data-testid="ai-trading-strategy-option-scalp" value="scalp">Scalping</option><option data-testid="ai-trading-strategy-option-intraday" value="intraday">Intraday</option><option data-testid="ai-trading-strategy-option-swing" value="swing">Swing</option><option data-testid="ai-trading-strategy-option-position" value="position">Position</option></select></label>
          <div className="grid grid-cols-2 gap-3"><label data-testid="ai-trading-risk-per-trade-control" className="grid gap-1 text-xs text-muted-foreground">Risk / trade %<input data-testid="ai-trading-risk-per-trade-input" value={maxRiskPct} onChange={(event) => setMaxRiskPct(event.target.value)} inputMode="decimal" className="rounded-xl border border-white/10 bg-background px-3 py-2 text-sm text-foreground outline-none theme-day:border-slate-200" /></label><label data-testid="ai-trading-min-confidence-control" className="grid gap-1 text-xs text-muted-foreground">Min confidence %<input data-testid="ai-trading-min-confidence-input" value={minConfidence} onChange={(event) => setMinConfidence(event.target.value)} inputMode="decimal" className="rounded-xl border border-white/10 bg-background px-3 py-2 text-sm text-foreground outline-none theme-day:border-slate-200" /></label><label data-testid="ai-trading-max-daily-loss-control" className="grid gap-1 text-xs text-muted-foreground">Max daily loss $<input data-testid="ai-trading-max-daily-loss-input" value={maxDailyLoss} onChange={(event) => setMaxDailyLoss(event.target.value)} inputMode="decimal" className="rounded-xl border border-white/10 bg-background px-3 py-2 text-sm text-foreground outline-none theme-day:border-slate-200" /></label><label data-testid="ai-trading-max-trades-control" className="grid gap-1 text-xs text-muted-foreground">Max trades/day<input data-testid="ai-trading-max-trades-input" value={maxTradesPerDay} onChange={(event) => setMaxTradesPerDay(event.target.value)} inputMode="numeric" className="rounded-xl border border-white/10 bg-background px-3 py-2 text-sm text-foreground outline-none theme-day:border-slate-200" /></label><label data-testid="ai-trading-cycle-interval-control" className="grid gap-1 text-xs text-muted-foreground">Cycle interval sec<input data-testid="ai-trading-cycle-interval-input" value={cycleIntervalSec} onChange={(event) => setCycleIntervalSec(event.target.value)} inputMode="numeric" className="rounded-xl border border-white/10 bg-background px-3 py-2 text-sm text-foreground outline-none theme-day:border-slate-200" /></label><label data-testid="ai-trading-cooldown-control" className="grid gap-1 text-xs text-muted-foreground">Cooldown sec<input data-testid="ai-trading-cooldown-input" value={cooldownSec} onChange={(event) => setCooldownSec(event.target.value)} inputMode="numeric" className="rounded-xl border border-white/10 bg-background px-3 py-2 text-sm text-foreground outline-none theme-day:border-slate-200" /></label></div>
          <div data-testid="ai-trading-backtest-gate-card" className="grid gap-3 rounded-xl border border-white/10 p-3 text-xs theme-day:border-slate-200"><div data-testid="ai-trading-backtest-gate-title" className="font-semibold text-foreground">Backtest-before-trade gate</div><label data-testid="ai-trading-backtest-mode-control" className="grid gap-1 text-muted-foreground">Gate mode<select data-testid="ai-trading-backtest-mode-select" value={backtestGateMode} onChange={(event) => setBacktestGateMode(event.target.value as BacktestGateMode)} className="rounded-xl border border-white/10 bg-background px-3 py-2 text-sm text-foreground outline-none theme-day:border-slate-200"><option data-testid="ai-trading-backtest-mode-option-off" value="off">Off</option><option data-testid="ai-trading-backtest-mode-option-warn" value="warn">Warn only</option><option data-testid="ai-trading-backtest-mode-option-required" value="required">Required to trade</option></select></label><div className="grid grid-cols-3 gap-2"><label data-testid="ai-trading-min-backtest-return-control" className="grid gap-1 text-muted-foreground">Min return %<input data-testid="ai-trading-min-backtest-return-input" value={minBacktestReturnPct} onChange={(event) => setMinBacktestReturnPct(event.target.value)} inputMode="decimal" className="rounded-xl border border-white/10 bg-background px-3 py-2 text-sm text-foreground outline-none theme-day:border-slate-200" /></label><label data-testid="ai-trading-min-backtest-winrate-control" className="grid gap-1 text-muted-foreground">Min win %<input data-testid="ai-trading-min-backtest-winrate-input" value={minBacktestWinRate} onChange={(event) => setMinBacktestWinRate(event.target.value)} inputMode="decimal" className="rounded-xl border border-white/10 bg-background px-3 py-2 text-sm text-foreground outline-none theme-day:border-slate-200" /></label><label data-testid="ai-trading-min-backtest-trades-control" className="grid gap-1 text-muted-foreground">Min trades<input data-testid="ai-trading-min-backtest-trades-input" value={minBacktestTrades} onChange={(event) => setMinBacktestTrades(event.target.value)} inputMode="numeric" className="rounded-xl border border-white/10 bg-background px-3 py-2 text-sm text-foreground outline-none theme-day:border-slate-200" /></label></div></div>
          <div className="grid grid-cols-2 gap-2"><Button data-testid="ai-trading-run-cycle-button" disabled={cycleStatus === 'running'} onClick={() => void runCycle('manual')}>{cycleStatus === 'running' ? 'Running...' : 'Run AI cycle'}</Button><Button data-testid="ai-trading-start-auto-button" disabled={autoEnabled || cycleStatus === 'running'} onClick={startAuto}>Start auto</Button><Button data-testid="ai-trading-stop-auto-button" variant="terminal" disabled={!autoEnabled} onClick={stopAuto}>Stop auto</Button><Button data-testid="ai-trading-pause-button" variant="terminal" onClick={pauseSession}>Pause</Button><Button data-testid="ai-trading-emergency-stop-button" variant="terminal" onClick={emergencyStop} className="border-destructive/40 text-destructive"><ShieldAlert size={14} /> E-stop</Button><Button data-testid="ai-trading-reset-session-button" variant="terminal" onClick={resetSession}>Reset</Button></div>
          <div data-testid="ai-trading-persistence-card" className="rounded-xl border border-white/10 p-3 text-xs theme-day:border-slate-200"><div data-testid="ai-trading-persistence-title" className="mb-2 font-semibold text-foreground">Session persistence</div><div data-testid="ai-trading-persistence-message" className="mb-3 text-muted-foreground">{persistMessage}</div><div className="grid grid-cols-3 gap-2"><Button data-testid="ai-trading-save-session-button" variant="terminal" size="sm" onClick={saveSession}><Save size={13} /> Save</Button><Button data-testid="ai-trading-export-session-button" variant="terminal" size="sm" onClick={exportSession}><Download size={13} /> Export</Button><Button data-testid="ai-trading-import-session-button" variant="terminal" size="sm" onClick={() => fileInputRef.current?.click()}><Upload size={13} /> Import</Button></div><input data-testid="ai-trading-import-session-input" ref={fileInputRef} type="file" accept="application/json,.json" className="hidden" onChange={(event) => importSession(event.target.files?.[0])} /></div>
        </div>
      </section>

      <section data-testid="ai-trading-decision-card" className="rounded-2xl border border-white/10 bg-white/[0.035] p-4 theme-day:border-slate-200 theme-day:bg-white">
        <div className="mb-3 flex items-center justify-between gap-3"><div><div data-testid="ai-trading-decision-title" className="text-sm font-semibold">Decision</div><div data-testid="ai-trading-symbol-timeframe" className="text-xs text-muted-foreground">{symbol} · {timeframe} · {inferAssetType(symbol, assetType)}</div></div><div data-testid="ai-trading-decision-action" className="rounded-full border border-white/10 px-3 py-1 text-xs font-semibold uppercase theme-day:border-slate-200">{decision?.action ?? 'none'}</div></div>
        {decision ? <div className="grid gap-3"><div className="grid gap-2 sm:grid-cols-3"><div data-testid="ai-trading-decision-confidence" className="rounded-xl border border-white/10 p-3 theme-day:border-slate-200"><div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Confidence</div><div className="mt-1 text-lg font-semibold">{formatPercent(decision.confidence)}</div></div><div data-testid="ai-trading-risk-gate-status" className="rounded-xl border border-white/10 p-3 theme-day:border-slate-200"><div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Risk gate</div><div className={decision.riskStatus === 'blocked' ? 'mt-1 text-lg font-semibold text-destructive' : 'mt-1 text-lg font-semibold text-primary'}>{decision.riskStatus}</div></div><div data-testid="ai-trading-proposed-size" className="rounded-xl border border-white/10 p-3 theme-day:border-slate-200"><div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Size</div><div className="mt-1 text-lg font-semibold">{decision.quantity}</div></div></div><div data-testid="ai-trading-decision-rationale" className="max-h-24 overflow-auto rounded-xl border border-white/10 p-3 text-xs text-muted-foreground theme-day:border-slate-200">{decision.rationale}</div><div data-testid="ai-trading-proposed-order-card" className="grid gap-2 rounded-xl border border-primary/20 bg-primary/10 p-3 text-xs sm:grid-cols-2"><div>Entry: <span data-testid="ai-trading-entry-price" className="font-semibold text-foreground">{formatCurrency(decision.entryPrice)}</span></div><div>Stop: <span data-testid="ai-trading-stop-loss" className="font-semibold text-foreground">{formatCurrency(decision.stopLoss)}</span></div><div>Target: <span data-testid="ai-trading-take-profit" className="font-semibold text-foreground">{formatCurrency(decision.takeProfit)}</span></div><div>Mode: <span data-testid="ai-trading-current-mode" className="font-semibold text-foreground">{mode}</span></div></div>{decisionBacktest && <div data-testid="ai-trading-backtest-result-card" className="grid gap-2 rounded-xl border border-white/10 p-3 text-xs theme-day:border-slate-200"><div className="flex items-center justify-between gap-2"><span className="font-semibold text-foreground">Backtest gate</span><span data-testid="ai-trading-backtest-status" className={decisionBacktest.status === 'blocked' ? 'font-semibold text-destructive' : decisionBacktest.status === 'passed' ? 'font-semibold text-primary' : 'font-semibold text-muted-foreground'}>{decisionBacktest.status}</span></div><div data-testid="ai-trading-backtest-reason" className="text-muted-foreground">{decisionBacktest.reason}</div><div className="grid grid-cols-3 gap-2"><span data-testid="ai-trading-backtest-trades">Trades {decisionBacktest.tradeCount}</span><span data-testid="ai-trading-backtest-winrate">Win {formatPercent(decisionBacktest.winRate)}</span><span data-testid="ai-trading-backtest-return">Return {decisionBacktest.totalReturnPct.toFixed(2)}%</span></div></div>}{decision.riskReasons.length > 0 && <ul data-testid="ai-trading-risk-reasons" className="grid gap-1 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">{decision.riskReasons.map((reason) => <li key={reason}>• {reason}</li>)}</ul>}<div className="grid grid-cols-2 gap-2"><Button data-testid="ai-trading-approve-order-button" disabled={!decision || decision.action === 'hold' || decision.riskStatus !== 'passed'} onClick={approveDecision}>Approve to paper</Button><Button data-testid="ai-trading-reject-order-button" variant="terminal" disabled={!decision} onClick={rejectDecision}>Reject</Button></div></div> : <div data-testid="ai-trading-decision-empty" className="grid min-h-[210px] place-items-center rounded-2xl border border-dashed border-white/10 text-center text-sm text-muted-foreground theme-day:border-slate-200">Run an AI cycle to generate a paper-safe trade decision.</div>}
      </section>

      <section data-testid="ai-trading-activity-card" className="grid min-h-0 gap-3 rounded-2xl border border-white/10 bg-white/[0.035] p-4 theme-day:border-slate-200 theme-day:bg-white">
        <div><div data-testid="ai-trading-paper-orders-title" className="text-sm font-semibold">AI paper orders</div><div data-testid="ai-trading-paper-orders-list" className="mt-2 max-h-28 overflow-auto rounded-xl border border-white/10 theme-day:border-slate-200">{orders.length === 0 ? <div data-testid="ai-trading-paper-orders-empty" className="p-3 text-xs text-muted-foreground">No AI paper orders yet.</div> : orders.map((order) => <div key={order.id} data-testid={`ai-trading-order-${safeTestId(order.id)}`} className="border-b border-white/10 p-3 text-xs last:border-b-0 theme-day:border-slate-200"><div className="flex items-center justify-between gap-2"><span className="font-semibold text-foreground">{order.side.toUpperCase()} {order.quantity} {order.symbol}</span><span className={order.status === 'filled' ? 'text-primary' : 'text-destructive'}>{order.status}</span></div><div className="mt-1 text-muted-foreground">{order.time} · {formatCurrency(order.price)}</div></div>)}</div></div>
        <div className="min-h-0"><div data-testid="ai-trading-event-log-title" className="text-sm font-semibold">Event log</div><div data-testid="ai-trading-event-log" className="mt-2 max-h-48 overflow-auto rounded-xl border border-white/10 theme-day:border-slate-200">{events.map((event) => <div key={event.id} data-testid={`ai-trading-event-${safeTestId(event.id)}`} className="border-b border-white/10 p-3 text-xs last:border-b-0 theme-day:border-slate-200"><div className="flex items-center justify-between gap-2"><span className={event.level === 'error' ? 'font-semibold text-destructive' : event.level === 'success' ? 'font-semibold text-primary' : 'font-semibold text-foreground'}>{event.level}</span><span className="text-muted-foreground">{event.time}</span></div><div className="mt-1 text-muted-foreground">{event.message}</div></div>)}</div></div>
      </section>
    </div>
  );
}
