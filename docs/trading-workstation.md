# Trading Research Workstation

This branch adds a local browser workstation for stocks and crypto research.

Run:

```bash
uv run tradingview-workstation
```

Open:

```text
http://127.0.0.1:8088
```

## Scope

The workstation is research-only. It supports:

- watchlist
- TradingView Lightweight Charts browser chart
- public crypto ticker, book, and candles from Binance, Coinbase, and Kraken
- stock quotes and bars through the existing Yahoo/Alpaca read paths
- existing TradingView-style technical analysis
- LM Studio local model analysis
- strategy backtests and strategy comparison
- local research journal

The workstation does not submit or simulate broker actions.

## LM Studio

Start LM Studio's local server and load a model. The workstation defaults to:

```text
http://localhost:1234/v1
```

Optional environment:

```bash
LMSTUDIO_BASE_URL=http://localhost:1234/v1
LMSTUDIO_MODEL=
LMSTUDIO_TIMEOUT_SECONDS=120
```

## Watchlist

Optional environment:

```bash
TRADING_WORKSTATION_WATCHLIST=AAPL,NVDA,TSLA,MSFT,SPY,QQQ,BTCUSDT,ETHUSDT,SOLUSDT
```

## Endpoints

```text
GET  /
GET  /api/health
GET  /api/watchlist
GET  /api/stock/quote
GET  /api/stock/alpaca-quote
GET  /api/stock/alpaca-bars
GET  /api/crypto/ticker
GET  /api/crypto/book
GET  /api/crypto/candles
GET  /api/technical
POST /api/ai/analyze
POST /api/backtest/run
GET  /api/backtest/compare
GET  /api/journal
POST /api/journal
```

## Notes

This UI is meant to be the trading cockpit while LM Studio remains the local model runtime.
The app owns chart state, prompts, watchlists, backtest workflows, and the research journal.
