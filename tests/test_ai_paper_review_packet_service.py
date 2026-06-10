from __future__ import annotations

from tradingview_mcp.core.services.ai_paper_review_packet_service import build_ai_paper_review_packet
from tradingview_mcp.core.services.workstation_journal_service import append_journal_event


def test_review_packet_bundles_history_replay_and_performance(monkeypatch, tmp_path):
    monkeypatch.setenv("TRADING_WORKSTATION_JOURNAL", str(tmp_path / "journal.jsonl"))
    append_journal_event(
        "ai_paper_trader_decision",
        {
            "context": {"symbol": "AAPL", "asset_type": "stock", "profile": "intraday_paper"},
            "decision": {
                "symbol": "AAPL",
                "action": "open_trade",
                "side": "buy",
                "quantity": 2,
                "order_type": "market",
                "entry_price": 100,
                "stop_price": 95,
                "take_profit": 110,
                "confidence": "high",
                "paper_trade_candidate": True,
                "paper_only": True,
                "live_execution": False,
                "execution_submitted": False,
            },
        },
    )

    packet = build_ai_paper_review_packet(
        limit=10,
        marks_by_symbol={"AAPL": [{"timestamp": "2026-01-01T00:00:00Z", "close": 100, "high": 111, "low": 99}]},
        groups=["symbol", "confidence", "outcome"],
    )

    assert packet["packet_type"] == "ai_paper_review_packet"
    assert packet["summary"]["decision_count"] == 1
    assert packet["summary"]["replayed_count"] == 1
    assert packet["summary"]["win_count"] == 1
    assert packet["performance"]["groups"]["symbol"][0]["key"] == "AAPL"
    assert packet["performance"]["groups"]["confidence"][0]["key"] == "high"
    assert packet["replay"]["replays"][0]["outcome"] == "win"
    assert packet["paper_only"] is True
    assert packet["live_execution"] is False
    assert packet["execution_submitted"] is False
    assert packet["background_loop_enabled"] is False
    assert packet["read_only"] is True


def test_review_packet_can_omit_decision_payloads(monkeypatch, tmp_path):
    monkeypatch.setenv("TRADING_WORKSTATION_JOURNAL", str(tmp_path / "journal.jsonl"))
    append_journal_event(
        "ai_paper_trader_decision",
        {
            "context": {"symbol": "MSFT"},
            "decision": {"action": "no_trade", "side": "none", "paper_only": True, "live_execution": False},
        },
    )

    packet = build_ai_paper_review_packet(include_decisions=False, include_replay_records=False)

    assert packet["summary"]["decision_count"] == 1
    assert packet["decisions"] == []
    assert packet["replay_records"] == []
    assert packet["read_only"] is True
