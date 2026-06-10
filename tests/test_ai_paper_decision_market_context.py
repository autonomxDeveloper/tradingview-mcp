from __future__ import annotations

from fastapi.testclient import TestClient

from tradingview_mcp.workstation_app import create_app


def test_ai_paper_decision_includes_multi_timeframe_context(monkeypatch, tmp_path):
    monkeypatch.setenv("TRADING_WORKSTATION_JOURNAL", str(tmp_path / "journal.jsonl"))
    monkeypatch.setenv("TRADING_WORKSTATION_PAPER_TRADING", str(tmp_path / "paper.json"))

    import tradingview_mcp.workstation_app as workstation_app
    from tradingview_mcp.core.services import ai_market_context_service

    def fake_market_context(symbol: str, asset_type: str, exchange: str, timeframe: str):
        return {"symbol": symbol.upper(), "asset_type": "stock", "timeframe": timeframe, "quote": {"price": 100}}

    def fake_lmstudio(messages, max_tokens=900):
        joined = "\n".join(message["content"] for message in messages)
        assert "multi_timeframe_market_context" in joined
        assert "bullish_aligned" in joined
        return {
            "content": '{"action":"no_trade","side":"none","quantity":0,"confidence":"low","reasoning_summary":"wait","invalidation":"not applicable","paper_trade_candidate":false,"not_financial_advice":true,"paper_only":true,"live_execution":false}',
            "model": "test-model",
            "raw": {},
        }

    def fake_multi_timeframe_context(**kwargs):
        return {
            "symbol": kwargs["symbol"].upper(),
            "asset_type": kwargs["asset_type"],
            "exchange": kwargs["exchange"],
            "timeframes": kwargs["timeframes"],
            "paper_only": True,
            "live_execution": False,
            "summary": {
                "timeframe_count": 2,
                "valid_timeframe_count": 2,
                "trend_alignment": "bullish_aligned",
                "trend_votes": ["uptrend", "uptrend"],
                "momentum_votes": ["bullish", "neutral"],
                "latest_close": 100,
                "errors": [],
            },
            "contexts": [
                {"timeframe": "5m", "trend": "uptrend", "momentum": "bullish", "latest": {"close": 100}},
                {"timeframe": "15m", "trend": "uptrend", "momentum": "neutral", "latest": {"close": 101}},
            ],
        }

    monkeypatch.setattr(workstation_app, "_market_context", fake_market_context)
    monkeypatch.setattr(workstation_app, "_call_lmstudio", fake_lmstudio)
    monkeypatch.setattr(ai_market_context_service, "build_multi_timeframe_market_context", fake_multi_timeframe_context)

    response = TestClient(create_app()).post(
        "/api/ai/paper-trader/decision",
        json={
            "symbol": "AAPL",
            "asset_type": "stock",
            "exchange": "NASDAQ",
            "timeframe": "5m",
            "chart_context": {"visible_range": "test"},
            "timeframes": ["5m", "15m"],
            "risk": {"require_confirmation": False},
            "market_context_limit": 50,
        },
    )
    payload = response.json()

    assert response.status_code == 200
    assert payload["paper_only"] is True
    assert payload["live_execution"] is False
    assert payload["execution_submitted"] is False
    assert payload["multi_timeframe_market_context"]["summary"]["trend_alignment"] == "bullish_aligned"
    assert payload["context"]["multi_timeframe_market_context"]["summary"]["valid_timeframe_count"] == 2
    assert payload["context"]["chart_context"]["multi_timeframe_summary"]["trend_alignment"] == "bullish_aligned"
    assert payload["decision"]["action"] == "no_trade"
    assert payload["decision"]["paper_only"] is True
    assert payload["decision"]["live_execution"] is False


def test_ai_paper_decision_market_context_failure_is_safe(monkeypatch, tmp_path):
    monkeypatch.setenv("TRADING_WORKSTATION_JOURNAL", str(tmp_path / "journal.jsonl"))
    monkeypatch.setenv("TRADING_WORKSTATION_PAPER_TRADING", str(tmp_path / "paper.json"))

    import tradingview_mcp.workstation_app as workstation_app
    from tradingview_mcp.core.services import ai_market_context_service

    monkeypatch.setattr(workstation_app, "_market_context", lambda symbol, asset_type, exchange, timeframe: {"symbol": symbol, "asset_type": "stock"})
    monkeypatch.setattr(
        workstation_app,
        "_call_lmstudio",
        lambda messages, max_tokens=900: {
            "content": '{"action":"no_trade","side":"none","quantity":0,"confidence":"low","reasoning_summary":"market context unavailable","paper_trade_candidate":false}',
            "model": "test-model",
            "raw": {},
        },
    )

    def failing_context(**_kwargs):
        raise RuntimeError("market data offline")

    monkeypatch.setattr(ai_market_context_service, "build_multi_timeframe_market_context", failing_context)

    response = TestClient(create_app()).post(
        "/api/ai/paper-trader/decision",
        json={"symbol": "AAPL", "asset_type": "stock", "exchange": "NASDAQ", "timeframe": "5m", "timeframes": ["5m"]},
    )
    payload = response.json()

    assert response.status_code == 200
    assert payload["paper_only"] is True
    assert payload["live_execution"] is False
    assert payload["multi_timeframe_market_context"]["summary"]["valid_timeframe_count"] == 0
    assert payload["multi_timeframe_market_context"]["summary"]["errors"][0]["error"] == "market data offline"
    assert payload["decision"]["action"] == "no_trade"
