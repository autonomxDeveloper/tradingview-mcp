from __future__ import annotations

from tradingview_mcp.core.services.ai_paper_replay_service import replay_ai_paper_decision, replay_ai_paper_decisions


def test_replay_buy_decision_hits_target():
    decision = {
        "symbol": "AAPL",
        "action": "open_trade",
        "side": "buy",
        "quantity": 2,
        "order_type": "market",
        "limit_price": 100,
        "stop_price": 95,
        "take_profit": 110,
    }
    marks = [
        {"timestamp": "2026-06-10T14:30:00Z", "open": 100, "high": 104, "low": 99, "close": 102},
        {"timestamp": "2026-06-10T15:30:00Z", "open": 102, "high": 111, "low": 101, "close": 110},
    ]

    replay = replay_ai_paper_decision(decision, marks)

    assert replay["outcome"] == "win"
    assert replay["exit_reason"] == "target_hit"
    assert replay["realized_pnl"] == 20
    assert replay["realized_pnl_pct"] == 10
    assert replay["paper_only"] is True
    assert replay["live_execution"] is False
    assert replay["execution_submitted"] is False


def test_replay_sell_decision_hits_stop():
    decision = {
        "symbol": "BTCUSDT",
        "action": "open_trade",
        "side": "sell",
        "quantity": 0.5,
        "order_type": "market",
        "limit_price": 100,
        "stop_price": 106,
        "take_profit": 90,
    }
    marks = [
        {"timestamp": "2026-06-10T00:00:00Z", "high": 103, "low": 98, "close": 101},
        {"timestamp": "2026-06-10T01:00:00Z", "high": 107, "low": 96, "close": 105},
    ]

    replay = replay_ai_paper_decision(decision, marks)

    assert replay["outcome"] == "loss"
    assert replay["exit_reason"] == "stop_before_target_same_bar"
    assert replay["exit_price"] == 106
    assert replay["realized_pnl"] == -3


def test_replay_limit_entry_not_reached_is_missed_entry():
    decision = {
        "symbol": "MSFT",
        "action": "open_trade",
        "side": "buy",
        "quantity": 1,
        "order_type": "limit",
        "limit_price": 90,
    }
    marks = [
        {"timestamp": "2026-06-10T14:30:00Z", "high": 101, "low": 99, "close": 100},
        {"timestamp": "2026-06-10T15:30:00Z", "high": 103, "low": 98, "close": 102},
    ]

    replay = replay_ai_paper_decision(decision, marks)

    assert replay["outcome"] == "missed_entry"
    assert replay["exit_reason"] == "entry_not_reached"
    assert replay["realized_pnl"] == 0


def test_replay_multiple_decisions_summarizes_results():
    records = [
        {"symbol": "AAPL", "decision": {"action": "open_trade", "side": "buy", "quantity": 1, "limit_price": 100, "take_profit": 105}},
        {"symbol": "MSFT", "decision": {"action": "no_trade", "side": "none", "quantity": 0}},
    ]
    marks = {
        "AAPL": [{"timestamp": "2026-06-10T14:30:00Z", "high": 106, "low": 99, "close": 104}],
        "MSFT": [{"timestamp": "2026-06-10T14:30:00Z", "close": 300}],
    }

    replay = replay_ai_paper_decisions(records, marks)

    assert replay["summary"]["decision_count"] == 2
    assert replay["summary"]["replayed_count"] == 2
    assert replay["summary"]["win_count"] == 1
    assert replay["summary"]["flat_count"] == 1
    assert replay["summary"]["total_realized_pnl"] == 5
    assert replay["paper_only"] is True
    assert replay["live_execution"] is False
    assert replay["execution_submitted"] is False
    assert replay["background_loop_enabled"] is False
