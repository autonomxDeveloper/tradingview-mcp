from __future__ import annotations

from tradingview_mcp.core.services import research_idea_service


def test_research_idea_round_trip(monkeypatch, tmp_path):
    monkeypatch.setenv("TRADING_WORKSTATION_IDEAS", str(tmp_path / "ideas.jsonl"))

    event = research_idea_service.create_research_idea(
        {
            "symbol": "aapl",
            "asset_type": "stock",
            "timeframe": "1D",
            "bias": "bullish",
            "hypothesis": "Momentum may continue after a base breakout.",
            "invalidation": "Close back below the base.",
            "backtest_plan": "Compare EMA cross and Donchian breakout on daily data.",
        }
    )
    ideas = research_idea_service.list_research_ideas(symbol="AAPL")

    assert event["accepted"] is True
    assert ideas[-1]["symbol"] == "AAPL"
    assert ideas[-1]["status"] == "draft"
    assert ideas[-1]["bias"] == "bullish"


def test_research_idea_requires_core_fields(monkeypatch, tmp_path):
    monkeypatch.setenv("TRADING_WORKSTATION_IDEAS", str(tmp_path / "ideas.jsonl"))

    event = research_idea_service.create_research_idea({"symbol": "AAPL"})

    assert event["accepted"] is False
    assert "timeframe is required" in event["errors"]
    assert "hypothesis is required" in event["errors"]
    assert "invalidation is required" in event["errors"]
    assert "backtest_plan is required" in event["errors"]


def test_research_idea_filters(monkeypatch, tmp_path):
    monkeypatch.setenv("TRADING_WORKSTATION_IDEAS", str(tmp_path / "ideas.jsonl"))
    base = {
        "timeframe": "1D",
        "hypothesis": "h",
        "invalidation": "i",
        "backtest_plan": "b",
    }
    research_idea_service.create_research_idea({**base, "symbol": "AAPL", "asset_type": "stock", "status": "watching"})
    research_idea_service.create_research_idea({**base, "symbol": "BTCUSDT", "asset_type": "crypto", "status": "draft"})

    assert len(research_idea_service.list_research_ideas(asset_type="stock")) == 1
    assert len(research_idea_service.list_research_ideas(status="draft")) == 1
    assert research_idea_service.list_research_ideas(symbol="BTCUSDT")[0]["asset_type"] == "crypto"
