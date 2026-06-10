from __future__ import annotations

from datetime import datetime, timedelta, timezone

from tradingview_mcp.core.services.ai_paper_lifecycle_service import review_ai_paper_lifecycle


def snapshot_with_position(symbol="AAPL", average=100, quantity=2):
    return {
        "account": {"cash": 1000},
        "positions": [{"symbol": symbol, "quantity": quantity, "average_price": average}],
        "open_orders": [],
    }


def market_context(symbol="AAPL", close=100, trend_alignment="mixed", momentum_votes=None):
    return {
        "symbol": symbol,
        "summary": {
            "latest_close": close,
            "trend_alignment": trend_alignment,
            "momentum_votes": momentum_votes or ["neutral"],
        },
        "contexts": [{"timeframe": "5m", "latest": {"close": close}}],
        "paper_only": True,
        "live_execution": False,
    }


def test_lifecycle_holds_position_inside_thresholds():
    lifecycle = review_ai_paper_lifecycle(snapshot_with_position(), market_context=market_context(close=102))

    review = lifecycle["position_reviews"][0]
    assert review["recommendation"] == "hold"
    assert review["paper_only"] is True
    assert review["live_execution"] is False
    assert review["execution_submitted"] is False
    assert lifecycle["summary"]["requires_attention"] is False


def test_lifecycle_recommends_close_review_on_loss_threshold():
    lifecycle = review_ai_paper_lifecycle(
        snapshot_with_position(),
        market_context=market_context(close=92),
        risk={"max_unrealized_loss_pct": 5},
    )

    review = lifecycle["position_reviews"][0]
    assert review["recommendation"] == "review_close"
    assert review["unrealized_pnl_pct"] == -8
    assert "loss_threshold_exceeded" in review["warnings"]
    assert lifecycle["summary"]["requires_attention"] is True


def test_lifecycle_recommends_take_profit_review():
    lifecycle = review_ai_paper_lifecycle(
        snapshot_with_position(),
        market_context=market_context(close=112),
        risk={"take_profit_review_pct": 8},
    )

    review = lifecycle["position_reviews"][0]
    assert review["recommendation"] == "take_profit_review"
    assert "profit_review_threshold_reached" in review["warnings"]


def test_lifecycle_recommends_tighten_stop_on_bearish_context():
    lifecycle = review_ai_paper_lifecycle(
        snapshot_with_position(),
        market_context=market_context(close=101, trend_alignment="bearish_aligned", momentum_votes=["bearish", "neutral"]),
    )

    review = lifecycle["position_reviews"][0]
    assert review["recommendation"] == "tighten_stop_review"
    assert "momentum_or_trend_weakening" in review["warnings"]


def test_lifecycle_recommends_risk_review_when_position_value_exceeds_limit():
    lifecycle = review_ai_paper_lifecycle(
        snapshot_with_position(quantity=20),
        market_context=market_context(close=100),
        risk={"max_position_value": 1000},
    )

    review = lifecycle["position_reviews"][0]
    assert review["recommendation"] == "risk_review"
    assert review["market_value"] == 2000
    assert "position_value_exceeds_limit" in review["warnings"]


def test_lifecycle_recommends_cancel_stale_order_review():
    now = datetime(2026, 6, 10, 15, 0, tzinfo=timezone.utc)
    old = (now - timedelta(minutes=90)).isoformat()
    snapshot = {
        "positions": [],
        "open_orders": [
            {"id": "order-1", "symbol": "AAPL", "side": "buy", "quantity": 1, "order_type": "limit", "status": "open", "created_at_utc": old}
        ],
    }

    lifecycle = review_ai_paper_lifecycle(snapshot, risk={"stale_order_minutes": 60}, now=now)

    review = lifecycle["order_reviews"][0]
    assert review["recommendation"] == "cancel_stale_order_review"
    assert review["age_minutes"] == 90
    assert "stale_order_review" in review["warnings"]
    assert lifecycle["paper_only"] is True
    assert lifecycle["live_execution"] is False
    assert lifecycle["execution_submitted"] is False
    assert lifecycle["background_loop_enabled"] is False
