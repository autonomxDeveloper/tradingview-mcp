import { expect, request, test } from '@playwright/test';

const BASE_URL = process.env.WORKSTATION_SERVER_URL ?? 'http://127.0.0.1:8765';

function uniqueSessionId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

test.describe('AI Trading API', () => {
  test('status endpoint is paper-only and live execution disabled', async () => {
    const api = await request.newContext({ baseURL: BASE_URL });

    const response = await api.get('/api/ai-trading/status');
    expect(response.ok()).toBeTruthy();

    const body = await response.json();
    expect(body).toMatchObject({
      paper_only: true,
      live_execution: false,
    });

    await api.dispose();
  });

  test('saves and loads an AI trading session snapshot', async () => {
    const api = await request.newContext({ baseURL: BASE_URL });
    const sessionId = uniqueSessionId('api-session');

    const payload = {
      session_id: sessionId,
      paper_only: true,
      live_execution: false,
      symbol: 'BTCUSDT',
      timeframe: '1D',
      asset_type: 'crypto',
      exchange: 'BINANCE',
      mode: 'observe',
      strategy: 'swing',
      risk: {
        risk_per_trade_pct: 0.5,
        min_confidence_pct: 65,
        max_daily_loss: 250,
        max_trades_per_day: 3,
      },
      counters: {
        completed_cycles: 1,
        skipped_cycles: 0,
      },
      last_decision: {
        action: 'hold',
        confidence: 0.62,
        rationale: 'API test session snapshot',
      },
    };

    const saveResponse = await api.post('/api/ai-trading/session', {
      data: payload,
    });
    expect(saveResponse.ok()).toBeTruthy();

    const loadResponse = await api.get('/api/ai-trading/session', {
      params: { session_id: sessionId },
    });
    expect(loadResponse.ok()).toBeTruthy();

    const loaded = await loadResponse.json();
    expect(loaded.session_id).toBe(sessionId);
    expect(loaded.paper_only).toBe(true);
    expect(loaded.live_execution).toBe(false);
    expect(loaded.symbol).toBe('BTCUSDT');
    expect(loaded.timeframe).toBe('1D');
    expect(loaded.mode).toBe('observe');
    expect(loaded.strategy).toBe('swing');

    await api.dispose();
  });

  test('appends and reads AI trading event log entries', async () => {
    const api = await request.newContext({ baseURL: BASE_URL });
    const sessionId = uniqueSessionId('api-events');

    const event = {
      session_id: sessionId,
      type: 'api_test',
      message: 'API test event append',
      symbol: 'BTCUSDT',
      timeframe: '1D',
      paper_only: true,
      live_execution: false,
      metadata: {
        source: 'playwright-api',
      },
    };

    const appendResponse = await api.post('/api/ai-trading/events', {
      data: event,
    });
    expect(appendResponse.ok()).toBeTruthy();

    const listResponse = await api.get('/api/ai-trading/events', {
      params: { session_id: sessionId },
    });
    expect(listResponse.ok()).toBeTruthy();

    const body = await listResponse.json();
    const events = Array.isArray(body) ? body : body.events;

    expect(Array.isArray(events)).toBeTruthy();
    expect(events.some((item: any) => item.message === event.message)).toBeTruthy();

    await api.dispose();
  });

  test('appends and reads paper-only AI order records', async () => {
    const api = await request.newContext({ baseURL: BASE_URL });
    const sessionId = uniqueSessionId('api-orders');
    const orderId = `paper-ai-${Date.now()}`;

    const order = {
      session_id: sessionId,
      order_id: orderId,
      source: 'ai',
      paper_only: true,
      live_execution: false,
      symbol: 'BTCUSDT',
      side: 'buy',
      order_type: 'market',
      quantity: 0.01,
      reference_price: 63000,
      status: 'paper_filled',
      rationale: 'API test paper-only order record',
    };

    const appendResponse = await api.post('/api/ai-trading/orders', {
      data: order,
    });
    expect(appendResponse.ok()).toBeTruthy();

    const listResponse = await api.get('/api/ai-trading/orders', {
      params: { session_id: sessionId },
    });
    expect(listResponse.ok()).toBeTruthy();

    const body = await listResponse.json();
    const orders = Array.isArray(body) ? body : body.orders;

    expect(Array.isArray(orders)).toBeTruthy();

    const savedOrder = orders.find((item: any) => item.order_id === orderId);
    expect(savedOrder).toBeTruthy();
    expect(savedOrder.paper_only).toBe(true);
    expect(savedOrder.live_execution).toBe(false);
    expect(savedOrder.source).toBe('ai');

    await api.dispose();
  });

  test('LLM analysis endpoint returns analysis when explicitly enabled', async () => {
    test.skip(
      process.env.AI_TRADING_API_LLM !== '1',
      'Set AI_TRADING_API_LLM=1 to run the real LLM API test.',
    );

    const api = await request.newContext({ baseURL: BASE_URL });

    const response = await api.post('/api/ai/analyze', {
      data: {
        symbol: process.env.AI_TRADING_SYMBOL ?? 'BTCUSDT',
        timeframe: process.env.AI_TRADING_TIMEFRAME ?? '1D',
        asset_type: 'crypto',
      },
      timeout: 120_000,
    });

    expect(response.ok()).toBeTruthy();

    const body = await response.json();
    expect(body).toHaveProperty('analysis');

    const analysisText =
      typeof body.analysis === 'string'
        ? body.analysis
        : body.analysis?.content ?? body.structured_analysis?.summary ?? '';

    expect(String(analysisText).length).toBeGreaterThan(20);

    await api.dispose();
  });
});
