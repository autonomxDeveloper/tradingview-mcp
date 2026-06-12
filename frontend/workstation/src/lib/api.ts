export type HealthPayload = {
  ok: boolean;
  watchlist?: string[];
  lmstudio_model?: string | null;
  paper_trading?: Record<string, unknown>;
  alpaca?: Record<string, unknown>;
};

export type AssetType = 'auto' | 'stock' | 'crypto';

export type Candle = {
  time?: string | number;
  timestamp?: string | number;
  open_time?: string | number;
  open: number | string;
  high: number | string;
  low: number | string;
  close: number | string;
  volume?: number | string;
};

export type ChartPayload = {
  symbol?: string;
  timeframe?: string;
  interval?: string;
  candles?: Candle[];
  bars?: Candle[];
  data?: Candle[];
  error?: { code?: string; message?: string };
};

const cryptoQuoteSuffixes = ['USDT', 'USDC', 'BTC', 'ETH'];

export function inferAssetType(symbol: string, selectedAssetType: AssetType = 'auto'): Exclude<AssetType, 'auto'> {
  const clean = symbol.trim().toUpperCase();
  const hasPairSeparator = clean.includes('-') || clean.includes('/');
  const hasCryptoQuoteSuffix = cryptoQuoteSuffixes.some((suffix) => clean.endsWith(suffix));
  const isKnownCryptoTicker = ['BTC', 'ETH', 'SOL'].includes(clean);

  if (selectedAssetType === 'stock') return 'stock';
  if (selectedAssetType === 'crypto' && (hasPairSeparator || hasCryptoQuoteSuffix || isKnownCryptoTicker)) return 'crypto';

  return hasPairSeparator || hasCryptoQuoteSuffix || isKnownCryptoTicker ? 'crypto' : 'stock';
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) },
    ...init,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload?.error) {
    const message = payload?.error?.message ?? `Request failed: ${response.status}`;
    throw new Error(message);
  }
  return payload as T;
}

export function chartBars(payload?: ChartPayload): Candle[] {
  return payload?.candles ?? payload?.bars ?? payload?.data ?? [];
}

export const workstationApi = {
  health: () => requestJson<HealthPayload>('/api/health'),
  watchlist: () => requestJson<{ symbols: string[] }>('/api/watchlist'),
  stockChart: (symbol: string, timeframe = '1D', limit = 300) =>
    requestJson<ChartPayload>(`/api/stock/yahoo-chart?symbol=${encodeURIComponent(symbol)}&timeframe=${encodeURIComponent(timeframe)}&limit=${limit}`),
  cryptoChart: (symbol: string, interval = '1h', limit = 300) =>
    requestJson<ChartPayload>(`/api/crypto/candles?symbol=${encodeURIComponent(symbol)}&interval=${encodeURIComponent(interval)}&limit=${limit}`),
  chart: (symbol: string, timeframe = '1D', assetType: AssetType = 'auto', limit = 300) => {
    const resolvedAssetType = inferAssetType(symbol, assetType);
    return resolvedAssetType === 'crypto'
      ? workstationApi.cryptoChart(symbol, timeframe.toLowerCase(), limit)
      : workstationApi.stockChart(symbol, timeframe, limit);
  },
  analyze: (body: { symbol: string; asset_type: string; exchange: string; timeframe: string; question: string }) =>
    requestJson<Record<string, unknown>>('/api/ai/analyze', { method: 'POST', body: JSON.stringify(body) }),
  tradeIdea: (body: { symbol: string; asset_type: string; exchange: string; timeframe: string; question: string; chart_context?: Record<string, unknown>; profile?: string; mode?: string }) =>
    requestJson<Record<string, unknown>>('/api/ai/trade-idea', { method: 'POST', body: JSON.stringify(body) }),
  paperDecision: (body: { symbol: string; asset_type: string; exchange: string; timeframe: string; chart_context?: Record<string, unknown>; timeframes?: string[]; profile?: string; mode?: string; risk?: Record<string, unknown> }) =>
    requestJson<Record<string, unknown>>('/api/ai/paper-trader/decision', { method: 'POST', body: JSON.stringify(body) }),
  backtest: (body: { symbol: string; strategy: string; period: string; interval: string }) =>
    requestJson<Record<string, unknown>>('/api/backtest/run', { method: 'POST', body: JSON.stringify(body) }),
  paperAccount: () => requestJson<Record<string, unknown>>('/api/paper/account'),
  aiTradingStatus: () => requestJson<Record<string, unknown>>('/api/ai-trading/status'),
  loadAiTradingSession: (sessionId = 'default') =>
    requestJson<Record<string, unknown>>(`/api/ai-trading/session?session_id=${encodeURIComponent(sessionId)}`),
  saveAiTradingSession: (session: Record<string, unknown>, sessionId = 'default') =>
    requestJson<Record<string, unknown>>('/api/ai-trading/session', { method: 'POST', body: JSON.stringify({ session_id: sessionId, session }) }),
  appendAiTradingEvent: (body: { session_id?: string; level: 'info' | 'success' | 'warning' | 'error'; message: string; payload?: Record<string, unknown> }) =>
    requestJson<Record<string, unknown>>('/api/ai-trading/events', { method: 'POST', body: JSON.stringify(body) }),
  listAiTradingEvents: (sessionId = 'default', limit = 100) =>
    requestJson<Record<string, unknown>>(`/api/ai-trading/events?session_id=${encodeURIComponent(sessionId)}&limit=${limit}`),
  appendAiTradingOrder: (order: Record<string, unknown>, sessionId = 'default') =>
    requestJson<Record<string, unknown>>('/api/ai-trading/orders', { method: 'POST', body: JSON.stringify({ session_id: sessionId, order }) }),
  listAiTradingOrders: (sessionId = 'default', limit = 100) =>
    requestJson<Record<string, unknown>>(`/api/ai-trading/orders?session_id=${encodeURIComponent(sessionId)}&limit=${limit}`),
  ideas: () => requestJson<{ ideas: unknown[] }>('/api/ideas'),
  journal: () => requestJson<{ events: unknown[] }>('/api/journal?limit=50'),
};
