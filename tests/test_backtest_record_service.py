from __future__ import annotations

from tradingview_mcp.core.services import backtest_record_service


def test_backtest_record_round_trip(monkeypatch, tmp_path):
    monkeypatch.setenv("TRADING_WORKSTATION_BACKTESTS", str(tmp_path / "backtests.jsonl"))

    event = backtest_record_service.create_backtest_record(
        request={"symbol": "AAPL", "strategy": "ema_cross", "period": "1y"},
        result={"symbol": "AAPL", "strategy": "ema_cross", "total_return_pct": 12.5, "trade_log": [{"x": 1}]},
        idea_id="idea-1",
        notes="first pass",
    )
    records = backtest_record_service.list_backtest_records(symbol="AAPL")

    assert event["event_type"] == "backtest_record_created"
    assert records[-1]["idea_id"] == "idea-1"
    assert records[-1]["summary"]["total_return_pct"] == 12.5
    assert records[-1]["summary"]["trade_log_rows"] == 1


def test_backtest_record_filters(monkeypatch, tmp_path):
    monkeypatch.setenv("TRADING_WORKSTATION_BACKTESTS", str(tmp_path / "backtests.jsonl"))

    backtest_record_service.create_backtest_record(
        request={"symbol": "AAPL", "strategy": "ema_cross"},
        result={"symbol": "AAPL", "strategy": "ema_cross"},
        idea_id="idea-a",
    )
    backtest_record_service.create_backtest_record(
        request={"symbol": "BTCUSDT", "strategy": "rsi"},
        result={"symbol": "BTCUSDT", "strategy": "rsi"},
        idea_id="idea-b",
    )

    assert len(backtest_record_service.list_backtest_records(strategy="ema_cross")) == 1
    assert len(backtest_record_service.list_backtest_records(idea_id="idea-b")) == 1
    assert backtest_record_service.list_backtest_records(symbol="BTCUSDT")[0]["request"]["strategy"] == "rsi"


def test_backtest_registry_status(monkeypatch, tmp_path):
    monkeypatch.setenv("TRADING_WORKSTATION_BACKTESTS", str(tmp_path / "backtests.jsonl"))

    status = backtest_record_service.backtest_registry_status()

    assert status["mode"] == "research_only"
    assert status["supports_idea_links"] is True
