from __future__ import annotations

from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
STATIC = ROOT / "src" / "tradingview_mcp" / "workstation_static"


def read_static(name: str) -> str:
    return (STATIC / name).read_text(encoding="utf-8")


def test_stock_symbol_context_shim_loads_after_app_before_chrome_controls():
    index = read_static("index.html")

    assert "/static/stock_symbol_context_shim.js" in index
    assert index.index("/static/app.js") < index.index("/static/stock_symbol_context_shim.js")
    assert index.index("/static/stock_symbol_context_shim.js") < index.index("/static/workstation_chrome_controls.js")


def test_stock_symbol_context_shim_switches_non_crypto_symbols_back_to_stock():
    shim = read_static("stock_symbol_context_shim.js")

    for expected in [
        "installStockSymbolContextShim",
        "function symbolLooksCrypto(symbol)",
        "function normalizeMarketContext()",
        "asset.value = 'stock'",
        "exchange.value = stockExchangeFor(symbol)",
        "ETF_EXCHANGE_HINTS",
        "'SPY'",
        "'QQQ'",
        "function stockAwareLoadMarket()",
        "window.loadMarket.__stockSymbolContextShim = true",
        "window.workstationStockSymbolContextShim",
    ]:
        assert expected in shim

    assert "asset.value === 'crypto' || exchange.value.toUpperCase() === 'BINANCE'" in shim
    assert "return ETF_EXCHANGE_HINTS.has(symbol) ? 'AMEX' : 'NASDAQ';" in shim


def test_stock_symbol_context_shim_preserves_crypto_symbols():
    shim = read_static("stock_symbol_context_shim.js")

    for expected in [
        "CRYPTO_BASE_SYMBOLS",
        "normalized.endsWith('USDT')",
        "normalized.endsWith('USDC')",
        "asset.value = 'crypto'",
        "exchange.value = 'BINANCE'",
    ]:
        assert expected in shim
