from __future__ import annotations

from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
FRONTEND = ROOT / "frontend" / "workstation" / "src"


def read_frontend(path: str) -> str:
    return (FRONTEND / path).read_text(encoding="utf-8")


def test_chart_api_accepts_existing_stock_and_crypto_payload_shapes():
    api = read_frontend("lib/api.ts")
    chart = read_frontend("components/ChartWorkspace.tsx")

    assert "bars?: Candle[]" in api
    assert "open_time?: string | number" in api
    assert "payload?.candles ?? payload?.bars ?? payload?.data ?? []" in api
    assert "chartBars(chartQuery.data)" in chart
    assert "candle.time ?? candle.timestamp ?? candle.open_time" in chart
    assert "epochSeconds > 10_000_000_000" in chart


def test_react_client_calls_existing_workstation_api_routes():
    api = read_frontend("lib/api.ts")

    for route in [
        "/api/health",
        "/api/watchlist",
        "/api/stock/yahoo-chart",
        "/api/crypto/candles",
        "/api/ai/analyze",
        "/api/ai/trade-idea",
        "/api/ai/paper-trader/decision",
        "/api/backtest/run",
        "/api/paper/account",
        "/api/ideas",
        "/api/journal?limit=50",
    ]:
        assert route in api
