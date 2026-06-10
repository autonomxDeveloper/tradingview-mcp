from __future__ import annotations

import importlib


def load_modules(monkeypatch, tmp_path):
    monkeypatch.setenv("TRADING_WORKSTATION_JOURNAL", str(tmp_path / "journal.jsonl"))
    journal = importlib.import_module("tradingview_mcp.core.services.workstation_journal_service")
    history = importlib.import_module("tradingview_mcp.core.services.ai_paper_decision_history_service")
    return importlib.reload(journal), importlib.reload(history)


def test_decision_history_extracts_replay_records_from_journal(monkeypatch, tmp_path):
    journal, history = load_modules(monkeypatch, tmp_path)

    journal.append_journal_event(
        "ai_paper_trader_decision",
        {
            "request": {"symbol": "aapl", "timeframe": "5m"},
            "context": {"symbol": "AAPL", "asset_type": "stock", "exchange": "NASDAQ", "active_timeframe": "5m", "profile": "intraday_paper"},
            "decision": {
                "action": "open_trade",
                "side": "buy",
                "quantity": 2,
                "order_type": "market",
                "confidence": "medium",
                "paper_trade_candidate": True,
                "guardrail_warnings": [],
                "paper_only": True,
                "live_execution": False,
            },
            "paper_only": True,
            "live_execution": False,
            "execution_submitted": False,
        },
    )

    result = history.list_ai_paper_decision_history(limit=10)

    assert result["paper_only"] is True
    assert result["live_execution"] is False
    assert result["execution_submitted"] is False
    assert result["read_only"] is True
    assert result["summary"]["decision_count"] == 1
    assert result["summary"]["trade_candidate_count"] == 1
    record = result["decisions"][0]
    assert record["symbol"] == "AAPL"
    assert record["action"] == "open_trade"
    assert record["paper_trade_candidate"] is True
    assert result["replay_records"] == [{"symbol": "AAPL", "decision": record["decision"]}]


def test_decision_history_filters_symbol_blocked_and_non_trade(monkeypatch, tmp_path):
    journal, history = load_modules(monkeypatch, tmp_path)

    journal.append_journal_event(
        "ai_paper_trader_decision",
        {
            "request": {"symbol": "AAPL"},
            "decision": {"action": "no_trade", "side": "none", "guardrail_warnings": ["blocked"], "paper_only": True, "live_execution": False},
        },
    )
    journal.append_journal_event(
        "ai_paper_trader_decision",
        {
            "request": {"symbol": "MSFT"},
            "decision": {"action": "open_trade", "side": "buy", "quantity": 1, "paper_trade_candidate": True, "paper_only": True, "live_execution": False},
        },
    )

    filtered = history.list_ai_paper_decision_history(symbol="MSFT", include_blocked=False, include_non_trade=False)

    assert filtered["summary"]["decision_count"] == 1
    assert filtered["decisions"][0]["symbol"] == "MSFT"
    assert filtered["decisions"][0]["action"] == "open_trade"
