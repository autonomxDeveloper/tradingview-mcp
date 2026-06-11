from __future__ import annotations

import os
from typing import Any

import pytest
import requests
from fastapi.testclient import TestClient

from tradingview_mcp import workstation_app


RUN_LIVE_LMSTUDIO = os.environ.get("RUN_LMSTUDIO_API_TESTS") == "1"

pytestmark = pytest.mark.skipif(
    not RUN_LIVE_LMSTUDIO,
    reason="Set RUN_LMSTUDIO_API_TESTS=1 to run live LM Studio workstation API tests.",
)


class ProviderUnavailable(RuntimeError):
    pass


def lmstudio_base_url() -> str:
    return os.environ.get("LMSTUDIO_BASE_URL", "http://localhost:1234/v1").rstrip("/")


def detect_lmstudio_model() -> str:
    configured = os.environ.get("LMSTUDIO_MODEL")
    if configured:
        return configured

    try:
        response = requests.get(
            f"{lmstudio_base_url()}/models",
            timeout=float(os.environ.get("LMSTUDIO_MODEL_DETECT_TIMEOUT_SECONDS", "10")),
        )
        response.raise_for_status()
        payload = response.json()
    except requests.RequestException as exc:
        raise ProviderUnavailable(f"Unable to auto-detect LM Studio model from /models: {exc}") from exc
    except ValueError as exc:
        raise ProviderUnavailable("LM Studio /models did not return valid JSON.") from exc

    models = payload.get("data", []) if isinstance(payload, dict) else []
    if not isinstance(models, list):
        raise ProviderUnavailable("LM Studio /models response did not include a data list.")

    for model in models:
        if not isinstance(model, dict):
            continue
        model_id = str(model.get("id") or model.get("name") or "").strip()
        if model_id:
            return model_id

    raise ProviderUnavailable("LM Studio is running but /models returned no loaded model id.")


def require_lmstudio_ready(monkeypatch: pytest.MonkeyPatch) -> str:
    detected_model = detect_lmstudio_model()
    monkeypatch.setenv("LMSTUDIO_MODEL", detected_model)

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
    return detected_model


def make_live_client(monkeypatch: pytest.MonkeyPatch) -> TestClient:
    detected_model = require_lmstudio_ready(monkeypatch)

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
    monkeypatch.setattr(workstation_app, "_lmstudio_model", lambda: detected_model)

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


def assert_model_was_detected(payload: dict[str, Any]) -> None:
    model = payload.get("ai", {}).get("model") or payload.get("trade_idea", {}).get("model") or payload.get("ai_response", {}).get("model")
    assert str(model or "").strip()


def test_live_lmstudio_analyze_endpoint_returns_model_content(monkeypatch: pytest.MonkeyPatch):
    client = make_live_client(monkeypatch)

    response = client.post("/api/ai/analyze", json=live_ai_request())
    assert response.status_code == 200
    payload = response.json()

    assert "error" not in payload.get("ai", {})
    assert str(payload["ai"].get("content") or "").strip()
    assert_model_was_detected(payload)
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
    assert_model_was_detected(payload)
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
    assert_model_was_detected(payload)
    assert payload["paper_only"] is True
    assert payload["live_execution"] is False
    assert payload["execution_submitted"] is False
    assert payload["decision"]["paper_only"] is True
    assert payload["decision"]["live_execution"] is False
