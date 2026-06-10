from __future__ import annotations

from tradingview_mcp.core.services.ai_paper_strategy_evaluation_service import evaluate_ai_paper_strategy_packets


def packet(label: str, *, symbol: str, decisions: int, replayed: int, wins: int, pnl: float, timeframe: str = "1h") -> dict:
    return {
        "packet_type": "ai_paper_review_packet",
        "metadata": {"strategy": label, "symbol": symbol, "timeframe": timeframe, "profile": "intraday_paper"},
        "summary": {"decision_count": decisions, "symbols": [symbol]},
        "performance": {
            "summary": {
                "decision_count": decisions,
                "replayed_count": replayed,
                "win_count": wins,
                "loss_count": max(replayed - wins, 0),
                "flat_count": 0,
                "missed_entry_count": 0,
                "not_replayed_count": max(decisions - replayed, 0),
                "win_rate": round(wins / replayed, 6) if replayed else 0,
                "total_realized_pnl": pnl,
                "average_realized_pnl": round(pnl / replayed, 6) if replayed else 0,
            },
            "replays": [
                {"symbol": symbol, "outcome": "win" if index < wins else "loss", "realized_pnl": 10 if index < wins else -5}
                for index in range(replayed)
            ],
            "paper_only": True,
            "live_execution": False,
            "execution_submitted": False,
            "read_only": True,
        },
        "paper_only": True,
        "live_execution": False,
        "execution_submitted": False,
        "background_loop_enabled": False,
        "read_only": True,
    }


def test_strategy_evaluation_ranks_packets_and_summarizes_totals():
    result = evaluate_ai_paper_strategy_packets(
        [
            packet("breakout", symbol="BTCUSDT", decisions=5, replayed=5, wins=3, pnl=25.0),
            packet("mean_reversion", symbol="ETHUSDT", decisions=4, replayed=4, wins=3, pnl=40.0),
        ],
        groups=["strategy", "symbol"],
    )

    assert result["evaluation_type"] == "ai_paper_strategy_evaluation_bundle"
    assert result["summary"]["packet_count"] == 2
    assert result["summary"]["decision_count"] == 9
    assert result["summary"]["replayed_count"] == 9
    assert result["summary"]["win_count"] == 6
    assert result["summary"]["total_realized_pnl"] == 65.0
    assert result["ranked_strategies"][0]["label"] == "mean_reversion"
    assert result["groups"]["strategy"][0]["key"] == "mean_reversion"
    assert result["groups"]["symbol"][0]["key"] == "ETHUSDT"


def test_strategy_evaluation_is_read_only_and_handles_empty_input():
    result = evaluate_ai_paper_strategy_packets([], groups=["unknown", "strategy"])

    assert result["summary"]["packet_count"] == 0
    assert result["ranked_strategies"] == []
    assert result["groups"] == {"strategy": []}
    assert result["paper_only"] is True
    assert result["live_execution"] is False
    assert result["execution_submitted"] is False
    assert result["background_loop_enabled"] is False
    assert result["read_only"] is True
