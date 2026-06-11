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


def _lmstudio_timeout() -> float:
    return float(os.environ.get("LMSTUDIO_MODEL_DETECT_TIMEOUT_SECONDS", os.environ.get("LMSTUDIO_TIMEOUT_SECONDS", "120")))


def _probe_lmstudio_chat(model_id: str | None) -> tuple[str, str]:
    body: dict[str, Any] = {
        "messages": [
            {
                "role": "user",
                "content": (
                    "Reply with exactly this JSON and no markdown: "
                    '{"summary":"lmstudio_ready","not_financial_advice":true}'
                ),
            }
        ],
        "temperature": 0.1,
        "max_tokens": 80,
    }
    if model_id:
        body["model"] = model_id

    try:
        response = requests.post(
            f"{lmstudio_base_url()}/chat/completions",
            json=body,
            timeout=_lmstudio_timeout(),
        )
        response.raise_for_status()
        payload = response.json()
    except requests.RequestException as exc:
        raise ProviderUnavailable(f"LM Studio chat probe failed for {model_id or 'default loaded model'}: {exc}") from exc
    except ValueError as exc:
        raise ProviderUnavailable(f"LM Studio chat probe returned non-JSON for {model_id or 'default loaded model'}.") from exc

    choices = payload.get("choices") or []
    message = choices[0].get("message", {}) if choices and isinstance(choices[0], dict) else {}
    content = str(message.get("content") or "").strip()
    response_model = str(payload.get("model") or model_id or "").strip()
    if not content:
        raise ProviderUnavailable(f"LM Studio returned an empty response for {model_id or 'default loaded model'}.")
    if not response_model:
        raise ProviderUnavailable(f"LM Studio returned content but no model id for {model_id or 'default loaded model'}.")
    return response_model, content


def _lmstudio_model_ids() -> list[str]:
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

    model_ids: list[str] = []
    for model in models:
        if not isinstance(model, dict):
            continue
        model_id = str(model.get("id") or model.get("name") or "").strip()
        if model_id and model_id not in model_ids:
            model_ids.append(model_id)
    return model_ids


def detect_lmstudio_model() -> tuple[str | None, str]:
    configured = os.environ.get("LMSTUDIO_MODEL")
    if configured:
        response_model, _ = _probe_lmstudio_chat(configured)
        return configured, response_model

    probe_errors: list[str] = []

    try:
        response_model, _ = _probe_lmstudio_chat(None)
        return None, response_model
    except ProviderUnavailable as exc:
        probe_errors.append(str(exc))

    for model_id in _lmstudio_model_ids():
        try:
            response_model, _ = _probe_lmstudio_chat(model_id)
            return model_id, response_model
        except ProviderUnavailable as exc:
            probe_errors.append(str(exc))

    details = "; ".join(probe_errors[-5:]) if probe_errors else "No model ids were returned from /models."
    raise ProviderUnavailable(f"LM Studio is running, but no probed model returned non-empty chat content. {details}")


def require_lmstudio_ready(monkeypatch: pytest.MonkeyPatch) -> tuple[str | None, str]:
    model_param, response_model = detect_lmstudio_model()
    if model_param:
        monkeypatch.setenv("LMSTUDIO_MODEL", model_param)
    else:
        monkeypatch.delenv("LMSTUDIO_MODEL", raising=False)
    return model_param, response_model


def make_live_client(monkeypatch: pytest.MonkeyPatch) -> TestClient:
    model_param, _response_model = require_lmstudio_ready(monkeypatch)

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
    monkeypatch.setattr(workstation_app, "_lmstudio_model", lambda: model_param)

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


def ai_envelope(payload: dict[str, Any], key: str) -> dict[str, Any]:
    value = payload.get(key)
    assert isinstance(value, dict), f"Expected {key} response envelope, got keys={sorted(payload)}"
    return value


def assert_lmstudio_envelope_has_content(payload: dict[str, Any], key: str) -> None:
    envelope = ai_envelope(payload, key)
    assert "error" not in envelope
    assert str(envelope.get("content") or "").strip()
    assert str(envelope.get("model") or "").strip()


def test_live_lmstudio_analyze_endpoint_returns_model_content(monkeypatch: pytest.MonkeyPatch):
    client = make_live_client(monkeypatch)

    response = client.post("/api/ai/analyze", json=live_ai_request())
    assert response.status_code == 200
    payload = response.json()

    assert_lmstudio_envelope_has_content(payload, "analysis")
    assert payload["market"]["symbol"] == "AAPL"
    assert payload["market"]["asset_type"] == "stock"
    assert payload["structured_analysis"].get("not_financial_advice") is True


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

    assert_lmstudio_envelope_has_content(payload, "trade_idea")
    assert payload["journal_event"]["payload"]["live_execution"] is False
    assert payload["journal_event"]["payload"].get("simulated_only") is True
    assert payload["structured_trade_idea"].get("not_financial_advice") is True


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

    assert_lmstudio_envelope_has_content(payload, "ai_response")
    assert payload["paper_only"] is True
    assert payload["live_execution"] is False
    assert payload["execution_submitted"] is False
    assert payload["decision"]["paper_only"] is True
    assert payload["decision"]["live_execution"] is False
