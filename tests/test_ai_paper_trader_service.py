from __future__ import annotations

from tradingview_mcp.core.services.ai_paper_trader_service import (
    ai_paper_trader_prompt,
    build_ai_paper_trader_context,
    parse_ai_paper_trader_decision,
    validate_ai_paper_trader_decision,
)


def minimal_context(**overrides):
    base = build_ai_paper_trader_context(
        symbol="AAPL",
        asset_type="stock",
        exchange="NASDAQ",
        active_timeframe="5m",
        timeframes=["5m", "15m", "1h"],
        profile="intraday_paper",
        mode="paper_trader_decision",
        market={"symbol": "AAPL", "asset_type": "stock", "timeframe": "5m"},
        chart_context={"latest_bar": {"close": 100}},
        paper_account={"account": {"cash": 10000}, "positions": []},
        open_orders=[],
        recent_fills=[],
        risk={"max_position_value": 1000, "require_confirmation": True},
    )
    base.update(overrides)
    return base


def test_parse_invalid_ai_response_returns_safe_no_trade():
    decision = parse_ai_paper_trader_decision("not json")

    assert decision["action"] == "no_trade"
    assert decision["side"] == "none"
    assert decision["quantity"] == 0.0
    assert decision["paper_trade_candidate"] is False
    assert decision["paper_only"] is True
    assert decision["live_execution"] is False
    assert decision["not_financial_advice"] is True


def test_parse_open_trade_normalizes_aliases_and_safety_flags():
    decision = parse_ai_paper_trader_decision(
        '{"action":"buy","side":"long","order_type":"limit","quantity":2,"limit_price":99.5,'
        '"stop_loss":95,"target_price":110,"confidence":"HIGH","risk_reward":"2:1",'
        '"reasoning_summary":"trend aligned","invalidation":"break below 95",'
        '"required_confirmations":["hold VWAP"],"paper_trade_candidate":true}'
    )

    assert decision["action"] == "open_trade"
    assert decision["side"] == "buy"
    assert decision["order_type"] == "limit"
    assert decision["quantity"] == 2
    assert decision["limit_price"] == 99.5
    assert decision["stop_price"] == 95
    assert decision["take_profit"] == 110
    assert decision["confidence"] == "high"
    assert decision["paper_only"] is True
    assert decision["live_execution"] is False


def test_guardrails_block_open_trade_without_invalidation_or_confirmation():
    decision = parse_ai_paper_trader_decision(
        '{"action":"open_trade","side":"buy","quantity":1,"confidence":"medium",'
        '"reasoning_summary":"maybe breakout","paper_trade_candidate":true}'
    )

    guarded = validate_ai_paper_trader_decision(decision, minimal_context())

    assert guarded["action"] == "no_trade"
    assert guarded["side"] == "none"
    assert guarded["quantity"] == 0.0
    assert guarded["paper_trade_candidate"] is False
    assert any("invalidation" in warning for warning in guarded["guardrail_warnings"])
    assert any("confirmation" in warning for warning in guarded["guardrail_warnings"])


def test_guardrails_allow_valid_paper_open_trade_decision_without_execution():
    decision = parse_ai_paper_trader_decision(
        '{"action":"open_trade","side":"buy","quantity":2,"limit_price":100,"confidence":"medium",'
        '"reasoning_summary":"pullback held support","invalidation":"close below 96",'
        '"required_confirmations":["RSI reclaim"],"paper_trade_candidate":true}'
    )

    guarded = validate_ai_paper_trader_decision(decision, minimal_context())

    assert guarded["action"] == "open_trade"
    assert guarded["side"] == "buy"
    assert guarded["quantity"] == 2
    assert guarded["paper_trade_candidate"] is True
    assert guarded["paper_only"] is True
    assert guarded["live_execution"] is False
    assert guarded["guardrail_warnings"] == []


def test_prompt_is_strict_json_and_paper_only():
    context = minimal_context()
    messages = ai_paper_trader_prompt(context)
    joined = "\n".join(message["content"] for message in messages)

    assert "strict JSON" in joined
    assert "simulated paper trading" in joined
    assert "never recommend or place live broker orders" in joined
    assert "open_trade | close_trade | hold | no_trade" in joined
    assert "execution_adapter_enabled" in joined
