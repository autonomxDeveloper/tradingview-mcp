from __future__ import annotations

from fastapi.testclient import TestClient

import tradingview_mcp.core.services.ai_market_context_service as market_context_service
from tradingview_mcp.workstation_app import create_app


def test_default_app_exposes_ai_market_context_route(monkeypatch, tmp_path):
    monkeypatch.setenv("TRADING_WORKSTATION_JOURNAL", str(tmp_path / "journal.jsonl"))

    def fake_context(**kwargs):
        return {
            "symbol": kwargs["symbol"].upper(),
            "asset_type": kwargs["asset_type"],
            "exchange": kwargs["exchange"],
            "timeframes": kwargs["timeframes"],
            "paper_only": True,
            "live_execution": False,
            "summary": {"valid_timeframe_count": 2, "trend_alignment": "mixed", "errors": []},
            "contexts": [],
        }

    monkeypatch.setattr(market_context_service, "build_multi_timeframe_market_context", fake_context)
    client = TestClient(create_app())

    response = client.post(
        "/api/ai/market-context",
        json={"symbol": "aapl", "asset_type": "stock", "exchange": "NASDAQ", "timeframes": ["5m", "1h"], "limit": 80},
    )
    payload = response.json()

    assert response.status_code == 200
    assert payload["paper_only"] is True
    assert payload["live_execution"] is False
    assert payload["context"]["symbol"] == "AAPL"
    assert payload["context"]["summary"]["valid_timeframe_count"] == 2
    assert payload["journal_event"]["event_type"] == "ai_multi_timeframe_market_context"
