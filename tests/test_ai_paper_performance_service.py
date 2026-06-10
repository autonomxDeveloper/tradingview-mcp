from __future__ import annotations

from tradingview_mcp.core.services.ai_paper_performance_service import summarize_ai_paper_performance


def test_performance_summary_groups_replay_metrics_by_symbol_and_confidence():
    replay_payload = {
        "replays": [
            {
                "symbol": "AAPL",
                "action": "open_trade",
                "side": "buy",
                "outcome": "win",
                "exit_reason": "target_hit",
                "realized_pnl": 12,
                "realized_pnl_pct": 6,
                "max_favorable_excursion_pct": 7,
                "max_adverse_excursion_pct": -1,
            },
            {
                "symbol": "AAPL",
                "action": "open_trade",
                "side": "buy",
                "outcome": "loss",
                "exit_reason": "stop_hit",
                "realized_pnl": -4,
                "realized_pnl_pct": -2,
                "max_favorable_excursion_pct": 1,
                "max_adverse_excursion_pct": -3,
            },
            {
                "symbol": "MSFT",
                "action": "open_trade",
                "side": "sell",
                "outcome": "missed_entry",
                "exit_reason": "entry_not_reached",
                "realized_pnl": 0,
            },
        ]
    }
    history = [
        {"symbol": "AAPL", "action": "open_trade", "side": "buy", "confidence": "high", "guardrail_warnings": [], "paper_trade_candidate": True},
        {"symbol": "MSFT", "action": "open_trade", "side": "sell", "confidence": "medium", "guardrail_warnings": [], "paper_trade_candidate": True},
    ]

    result = summarize_ai_paper_performance(replay_payload, decision_history=history, groups=["symbol", "confidence", "exit_reason"])

    assert result["summary"]["decision_count"] == 3
    assert result["summary"]["replayed_count"] == 2
    assert result["summary"]["win_count"] == 1
    assert result["summary"]["loss_count"] == 1
    assert result["summary"]["missed_entry_count"] == 1
    assert result["summary"]["win_rate"] == 0.5
    assert result["summary"]["total_realized_pnl"] == 8
    assert result["paper_only"] is True
    assert result["live_execution"] is False
    assert result["execution_submitted"] is False
    assert result["read_only"] is True

    by_symbol = {item["key"]: item for item in result["groups"]["symbol"]}
    assert by_symbol["AAPL"]["decision_count"] == 2
    assert by_symbol["AAPL"]["replayed_count"] == 2
    assert by_symbol["AAPL"]["win_rate"] == 0.5
    assert by_symbol["AAPL"]["total_realized_pnl"] == 8
    assert by_symbol["AAPL"]["average_realized_pnl"] == 4
    assert by_symbol["AAPL"]["average_realized_pnl_pct"] == 2
    assert by_symbol["AAPL"]["average_mfe_pct"] == 4
    assert by_symbol["AAPL"]["average_mae_pct"] == -2
    assert by_symbol["MSFT"]["missed_entry_count"] == 1
    assert by_symbol["MSFT"]["replayed_count"] == 0

    by_confidence = {item["key"]: item for item in result["groups"]["confidence"]}
    assert by_confidence["high"]["decision_count"] == 2
    assert by_confidence["medium"]["missed_entry_count"] == 1


def test_performance_summary_accepts_raw_replay_list_and_filters_unknown_groups():
    result = summarize_ai_paper_performance(
        [
            {"symbol": "BTCUSDT", "action": "open_trade", "side": "buy", "outcome": "flat", "realized_pnl": 0},
        ],
        groups=["invalid", "symbol"],
    )

    assert list(result["groups"].keys()) == ["symbol"]
    assert result["summary"]["flat_count"] == 1
    assert result["summary"]["replayed_count"] == 1
    assert result["background_loop_enabled"] is False
