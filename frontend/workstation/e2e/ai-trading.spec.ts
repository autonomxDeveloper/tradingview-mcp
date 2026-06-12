import { expect, test } from '@playwright/test';

const runLlmCycle = process.env.AI_TRADING_LLM === '1';
const serverBaseUrl = process.env.WORKSTATION_SERVER_URL ?? 'http://127.0.0.1:8765';

async function openAiTradingTab(page: import('@playwright/test').Page) {
  await page.goto('/react/');
  const consoleHandle = page.getByTestId('bottom-console-reopen-button');
  if (await consoleHandle.isVisible().catch(() => false)) {
    await consoleHandle.click();
  }
  await page.getByTestId('bottom-console-tab-ai-trading').click();
  await expect(page.getByTestId('ai-trading-console')).toBeVisible();
}

test.describe('AI Trading workstation controls', () => {
  test('renders paper-only AI trading controls and guardrails', async ({ page }) => {
    await openAiTradingTab(page);

    await expect(page.getByTestId('ai-trading-title')).toContainText('Automated AI Trading');
    await expect(page.getByTestId('ai-trading-subtitle')).toContainText('Paper-safe');
    await expect(page.getByTestId('ai-trading-mode-select')).toBeVisible();
    await expect(page.getByTestId('ai-trading-start-auto-button')).toBeVisible();
    await expect(page.getByTestId('ai-trading-stop-auto-button')).toBeVisible();
    await expect(page.getByTestId('ai-trading-emergency-stop-button')).toBeVisible();
    await expect(page.getByTestId('ai-trading-backtest-gate-card')).toBeVisible();

    await page.getByTestId('ai-trading-mode-select').selectOption('auto-paper');
    await page.getByTestId('ai-trading-backtest-mode-select').selectOption('required');
    await page.getByTestId('ai-trading-risk-per-trade-input').fill('0.25');
    await page.getByTestId('ai-trading-min-confidence-input').fill('70');
    await page.getByTestId('ai-trading-cycle-interval-input').fill('15');
    await page.getByTestId('ai-trading-cooldown-input').fill('30');

    await expect(page.getByTestId('ai-trading-mode-select')).toHaveValue('auto-paper');
    await expect(page.getByTestId('ai-trading-backtest-mode-select')).toHaveValue('required');
    await expect(page.getByTestId('ai-trading-risk-per-trade-input')).toHaveValue('0.25');
  });

  test('emergency stop blocks auto cycles until reset', async ({ page }) => {
    await openAiTradingTab(page);

    await page.getByTestId('ai-trading-emergency-stop-button').click();
    await expect(page.getByTestId('ai-trading-status-pill')).toContainText('stopped');

    await page.getByTestId('ai-trading-start-auto-button').click();
    await expect(page.getByTestId('ai-trading-event-log')).toContainText('Emergency stop is active');

    await page.getByTestId('ai-trading-reset-session-button').click();
    await expect(page.getByTestId('ai-trading-status-pill')).toContainText('idle');
  });

  test('shared paper account accepts manual order and exposes state to AI trading', async ({ page }) => {
    await openAiTradingTab(page);
    const initialEquity = await page.getByTestId('ai-trading-paper-equity').innerText();
    expect(initialEquity).toContain('$');

    await page.getByTestId('bottom-console-tab-paper').click();
    await expect(page.getByTestId('paper-trading-console')).toBeVisible();
    await page.getByTestId('paper-side-select').selectOption('buy');
    await page.getByTestId('paper-order-type-select').selectOption('market');
    await page.getByTestId('paper-quantity-input').fill('1');
    await page.getByTestId('paper-limit-price-input').fill('100');
    await page.getByTestId('paper-place-order-button').click();
    await expect(page.getByTestId('paper-orders-list')).toContainText('filled');

    await page.getByTestId('bottom-console-tab-ai-trading').click();
    await expect(page.getByTestId('ai-trading-paper-cash')).toContainText('$');
    await expect(page.getByTestId('ai-trading-paper-positions-value')).toContainText('$');
  });

  test('external execution guard remains locked and paper-only', async ({ page }) => {
    await page.goto('/react/');
    await page.getByTestId('toggle-external-execution-guard-button').click();

    await expect(page.getByTestId('external-execution-guard-region')).toBeVisible();
    await expect(page.getByTestId('external-execution-guard-card')).toContainText('locked');
    await page.getByTestId('external-execution-confirmation-input').fill('PAPER ONLY');
    await page.getByTestId('external-execution-keep-locked-button').click();
    await expect(page.getByTestId('external-execution-guard-card')).toContainText('paper');
  });
});

test.describe('AI Trading backend storage', () => {
  test('storage card can status check, save heartbeat, load, and export backend packet', async ({ page }) => {
    await page.goto('/react/');
    await page.getByTestId('toolbar-ai-button').click();
    await expect(page.getByTestId('ai-trading-storage-card')).toBeVisible();

    await page.getByTestId('ai-trading-storage-status-button').click();
    await expect(page.getByTestId('ai-trading-storage-message')).toContainText(/status|ready|backend/i);

    await page.getByTestId('ai-trading-storage-save-button').click();
    await expect(page.getByTestId('ai-trading-storage-message')).toContainText(/saved|session|heartbeat/i);

    await page.getByTestId('ai-trading-storage-load-button').click();
    await expect(page.getByTestId('ai-trading-storage-json')).toContainText(/paperOnly|paper_only/);
    await expect(page.getByTestId('ai-trading-storage-export-button')).toBeEnabled();
  });

  test('backend API is paper-only', async ({ request }) => {
    const response = await request.get(`${serverBaseUrl}/api/ai-trading/status`);
    expect(response.ok()).toBeTruthy();
    const payload = await response.json();
    expect(payload.paper_only).toBe(true);
    expect(payload.live_execution).toBe(false);
  });
});

test.describe('AI Trading LLM cycle', () => {
  test.skip(!runLlmCycle, 'Set AI_TRADING_LLM=1 and run against a local workstation + LM Studio server to exercise the real LLM cycle.');

  test('runs one real AI trading analysis cycle', async ({ page }) => {
    test.setTimeout(120_000);
    await openAiTradingTab(page);

    await page.getByTestId('symbol-input').fill(process.env.AI_TRADING_SYMBOL ?? 'BTCUSDT');
    await page.getByTestId('timeframe-select').selectOption(process.env.AI_TRADING_TIMEFRAME ?? '1D');
    await page.getByTestId('ai-trading-mode-select').selectOption('suggest');
    await page.getByTestId('ai-trading-backtest-mode-select').selectOption('warn');
    await page.getByTestId('ai-trading-min-confidence-input').fill('1');

    await page.getByTestId('ai-trading-run-cycle-button').click();
    await expect(page.getByTestId('ai-trading-decision-card')).toBeVisible({ timeout: 120_000 });
    await expect(page.getByTestId('ai-trading-decision-action')).toContainText(/BUY|SELL|HOLD/i);
    await expect(page.getByTestId('ai-trading-event-log')).toContainText(/LLM analysis completed|Decision:/i, { timeout: 120_000 });
  });
});
