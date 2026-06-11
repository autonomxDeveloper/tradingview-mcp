from __future__ import annotations

import os

import pytest
from fastapi.testclient import TestClient

from tradingview_mcp import workstation_app


RUN_LIVE_LMSTUDIO = os.environ.get("RUN_LMSTUDIO_API_TESTS") == "1"

pytestmark = pytest.mark.skipif(
    not RUN_LIVE_LMSTUDIO,
    reason="Set RUN_LMSTUDIO_API_TESTS=1 to run live LM Studio workstation API tests.",
)


class ProviderUnavailable(RuntimeError):
    pass


def require_lmstudio_ready() -> None:
    result = workstation_app._call_lmstudio(
        [
            {
                "role": "user",
                "content": (
                    "Reply with exactly this JSON and no markdown: "
                    '{"summary":"lmstudio_ready","not_financial_advice":true}'
                ),
            }
        ],
        max_tokens=80,
    )
    if "error" in result:
        raise ProviderUnavailable(str(result["error"]))
    if not str(result.get("content") or "").strip():
        raise ProviderUnavailable("LM Studio returned an empty response.")


def make_live_client(monkeypatch: pytest.MonkeyPatch) -> TestClient:
    require_lmstudio_ready()

    monkeypatch.setenv("LMSTUDIO_TIMEOUT_SECONDS", os.environ.get("LMSTUDIO_TIMEOUT_SECONDS", "120"))
    monkeypatch.setattr(workstation_app, "get_price", lambda symbol: {"symbol": symbol, "price": 123.45, "source": "live-lmstudio-test"})
    monkeypatch.setattr(
        workstation_app,
        "get_yahoo_chart",
        lambda symbol, timeframe, limit: {
            "symbol": symbol,
            "timeframe": timeframe,
            "candles": [
                {"time": 1700000000, "open": 100.0, "high": 105.0, "low": 99.0, "close": 104.0, "volume": 1000},
                {"time": 1700086400, "open": 104.0, "high": 106.0, "low": 101.0, "close": 102.0, "volume": 900},
            ],
            "source": "live-lmstudio-test",
        },
    )
    monkeypatch.setattr(workstation_app, "get_alpaca_stock_bars", lambda symbol, timeframe, limit, feed: {"bars": []})
    monkeypatch.setattr(workstation_app, "analyze_coin", lambda symbol, exchange, timeframe: {"symbol": symbol, "exchange": exchange, "timeframe": timeframe, "summary": "technical ok"})
    monkeypatch.setattr(workstation_app, "paper_account_snapshot", lambda marks=None: {"account": {"cash": 10000.0}, "positions": [], "marks": marks or {}})
    monkeypatch.setattr(workstation_app, "list_paper_orders", lambda limit=100: [])
    monkeypatch.setattr(workstation_app, "list_paper_fills", lambda limit=100: [])
    monkeypatch.setattr(workstation_app, "append_journal_event", lambda event_type, payload: {"id": "lmstudio-live-event", "type": event_type, "payload": payload})

    return TestClient(workstation_app.create_app())


def live_ai_request() -> dict[str, object]:
    return {
        "symbol": "AAPL",
        "asset_type": "stock",
        "exchange": "NASDAQ",
        "timeframe": "1D",
        "question": (
            "Return concise JSON only. Observe the provided market context, list risks, "
            "and keep not_financial_advice true. Do not recommend taking a position."
        ),
    }


def test_live_lmstudio_analyze_endpoint_returns_model_content(monkeypatch: pytest.MonkeyPatch):
    client = make_live_client(monkeypatch)

    response = client.post("/api/ai/analyze", json=live_ai_request())
    assert response.status_code == 200
    payload = response.json()

    assert "error" not in payload.get("ai", {})
    assert str(payload["ai"].get("content") or "").strip()
    assert payload["market"]["symbol"] == "AAPL"
    assert payload["market"]["asset_type"] == "stock"


def test_live_lmstudio_trade_idea_endpoint_preserves_research_boundary(monkeypatch: pytest.MonkeyPatch):
    client = make_live_client(monkeypatch)

    response = client.post(
        "/api/ai/trade-idea",
        json={
            **live_ai_request(),
            "chart_context": {"notes": "live LM Studio API test with deterministic market adapters"},
            "profile": "swing",
            "mode": "research_trade_idea",
        },
    )
    assert response.status_code == 200
    payload = response.json()

    assert "error" not in payload.get("ai", {})
    assert str(payload["ai"].get("content") or "").strip()
    assert payload["journal_event"]["payload"]["live_execution"] is False
    assert payload["journal_event"]["payload"]["not_financial_advice"] is True


def test_live_lmstudio_paper_decision_endpoint_stays_paper_only(monkeypatch: pytest.MonkeyPatch):
    client = make_live_client(monkeypatch)

    response = client.post(
        "/api/ai/paper-trader/decision",
        json={
            **live_ai_request(),
            "chart_context": {"notes": "live LM Studio API test with deterministic market adapters"},
            "timeframes": ["5m", "1h", "1d"],
            "profile": "intraday_paper",
            "mode": "paper_trader_decision",
            "risk": {"max_risk_pct": 0.5},
        },
    )
    assert response.status_code == 200
    payload = response.json()

    assert "error" not in payload.get("ai", {})
    assert str(payload["ai"].get("content") or "").strip()
    assert payload["paper_only"] is True
    assert payload["live_execution"] is False
    assert payload["execution_submitted"] is False
    assert payload["decision"]["paper_only"] is True
    assert payload["decision"]["live_execution"] is False
