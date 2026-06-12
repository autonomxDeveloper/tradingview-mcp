export type HealthPayload = {
  ok: boolean;
  watchlist?: string[];
  lmstudio_model?: string | null;
  paper_trading?: Record<string, unknown>;
  alpaca?: Record<string, unknown>;
};

export type Candle = {
  time?: string | number;
  timestamp?: string | number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
};

export type ChartPayload = {
  symbol?: string;
  timeframe?: string;
  candles?: Candle[];
  data?: Candle[];
  error?: { code?: string; message?: string };
};

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

export const workstationApi = {
  health: () => requestJson<HealthPayload>('/api/health'),
  watchlist: () => requestJson<{ symbols: string[] }>('/api/watchlist'),
  stockChart: (symbol: string, timeframe = '1D', limit = 300) =>
    requestJson<ChartPayload>(`/api/stock/yahoo-chart?symbol=${encodeURIComponent(symbol)}&timeframe=${encodeURIComponent(timeframe)}&limit=${limit}`),
  cryptoChart: (symbol: string, interval = '1h', limit = 300) =>
    requestJson<ChartPayload>(`/api/crypto/candles?symbol=${encodeURIComponent(symbol)}&interval=${encodeURIComponent(interval)}&limit=${limit}`),
  analyze: (body: { symbol: string; asset_type: string; exchange: string; timeframe: string; question: string }) =>
    requestJson<Record<string, unknown>>('/api/ai/analyze', { method: 'POST', body: JSON.stringify(body) }),
  backtest: (body: { symbol: string; strategy: string; period: string; interval: string }) =>
    requestJson<Record<string, unknown>>('/api/backtest/run', { method: 'POST', body: JSON.stringify(body) }),
  paperAccount: () => requestJson<Record<string, unknown>>('/api/paper/account'),
  ideas: () => requestJson<{ ideas: unknown[] }>('/api/ideas'),
  journal: () => requestJson<{ events: unknown[] }>('/api/journal?limit=50'),
};
