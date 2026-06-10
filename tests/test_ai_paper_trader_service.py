from __future__ import annotations

from datetime import datetime, timezone

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


def valid_open_decision(**overrides):
    payload = {
        "action": "open_trade",
        "side": "buy",
        "quantity": 2,
        "limit_price": 100,
        "stop_price": 96,
        "confidence": "medium",
        "risk_reward": "2:1",
        "reasoning_summary": "pullback held support",
        "invalidation": "close below 96",
        "required_confirmations": ["RSI reclaim"],
        "paper_trade_candidate": True,
    }
    payload.update(overrides)
    import json

    return parse_ai_paper_trader_decision(json.dumps(payload))


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
    guarded = validate_ai_paper_trader_decision(valid_open_decision(), minimal_context())

    assert guarded["action"] == "open_trade"
    assert guarded["side"] == "buy"
    assert guarded["quantity"] == 2
    assert guarded["paper_trade_candidate"] is True
    assert guarded["paper_only"] is True
    assert guarded["live_execution"] is False
    assert guarded["execution_submitted"] is False
    assert guarded["guardrail_warnings"] == []


def test_guardrails_block_symbol_not_allowed_or_blocked():
    allowed_context = minimal_context(risk={"allowed_symbols": ["MSFT"], "require_confirmation": True})
    blocked_context = minimal_context(risk={"blocked_symbols": ["AAPL"], "require_confirmation": True})

    allowed_guarded = validate_ai_paper_trader_decision(valid_open_decision(), allowed_context)
    blocked_guarded = validate_ai_paper_trader_decision(valid_open_decision(), blocked_context)

    assert allowed_guarded["action"] == "no_trade"
    assert any("allowed_symbols" in warning for warning in allowed_guarded["guardrail_warnings"])
    assert blocked_guarded["action"] == "no_trade"
    assert any("blocked" in warning for warning in blocked_guarded["guardrail_warnings"])


def test_guardrails_block_daily_trade_limit_and_open_order_duplicates():
    today = datetime.now(timezone.utc).isoformat()
    context = minimal_context(
        recent_fills=[{"symbol": "AAPL", "filled_at": today}, {"symbol": "MSFT", "filled_at": today}],
        open_orders=[{"symbol": "AAPL", "status": "open"}],
        risk={"max_trades_per_day": 2, "max_open_orders": 5, "require_confirmation": True},
    )

    guarded = validate_ai_paper_trader_decision(valid_open_decision(), context)

    assert guarded["action"] == "no_trade"
    assert guarded["trade_count_today"] == 2
    assert any("max_trades_per_day" in warning for warning in guarded["guardrail_warnings"])
    assert any("already has" in warning for warning in guarded["guardrail_warnings"])


def test_guardrails_block_market_closed_when_required():
    context = minimal_context(risk={"require_market_open": True, "market_session": "closed", "require_confirmation": True})

    guarded = validate_ai_paper_trader_decision(valid_open_decision(), context)

    assert guarded["action"] == "no_trade"
    assert any("market_session" in warning for warning in guarded["guardrail_warnings"])


def test_guardrails_block_short_when_disabled():
    context = minimal_context(risk={"allow_short": False, "require_confirmation": True})

    guarded = validate_ai_paper_trader_decision(valid_open_decision(side="sell"), context)

    assert guarded["action"] == "no_trade"
    assert any("allow_short=false" in warning for warning in guarded["guardrail_warnings"])


def test_guardrails_block_low_confidence_and_weak_risk_reward():
    context = minimal_context(risk={"min_confidence_for_open": "high", "min_risk_reward": 2.0, "require_confirmation": True})

    guarded = validate_ai_paper_trader_decision(valid_open_decision(confidence="medium", risk_reward="1.2:1"), context)

    assert guarded["action"] == "no_trade"
    assert any("min_confidence_for_open" in warning for warning in guarded["guardrail_warnings"])
    assert any("min_risk_reward" in warning for warning in guarded["guardrail_warnings"])


def test_guardrails_block_excess_position_and_risk_values():
    context = minimal_context(risk={"max_position_value": 100, "max_risk_per_trade_value": 5, "require_confirmation": True})

    guarded = validate_ai_paper_trader_decision(valid_open_decision(quantity=2, limit_price=100, stop_price=90), context)

    assert guarded["action"] == "no_trade"
    assert guarded["estimated_position_value"] == 200
    assert guarded["estimated_risk_value"] == 20
    assert any("max_position_value" in warning for warning in guarded["guardrail_warnings"])
    assert any("max_risk_per_trade_value" in warning for warning in guarded["guardrail_warnings"])


def test_guardrails_require_stop_price_when_configured():
    context = minimal_context(risk={"require_stop_price": True, "require_confirmation": True})

    guarded = validate_ai_paper_trader_decision(valid_open_decision(stop_price=None), context)

    assert guarded["action"] == "no_trade"
    assert any("require_stop_price" in warning for warning in guarded["guardrail_warnings"])


def test_guardrails_close_trade_requires_matching_symbol_position():
    close_decision = parse_ai_paper_trader_decision(
        '{"action":"close_trade","side":"sell","quantity":1,"reasoning_summary":"exit",'
        '"invalidation":"target hit","paper_trade_candidate":false}'
    )
    wrong_symbol_context = minimal_context(paper_account={"account": {"cash": 10000}, "positions": [{"symbol": "MSFT", "quantity": 1}]})
    matching_context = minimal_context(paper_account={"account": {"cash": 10000}, "positions": [{"symbol": "AAPL", "quantity": 3}]})

    blocked = validate_ai_paper_trader_decision(close_decision, wrong_symbol_context)
    allowed = validate_ai_paper_trader_decision(parse_ai_paper_trader_decision('{"action":"close_trade","side":"sell","reasoning_summary":"exit"}'), matching_context)

    assert blocked["action"] == "no_trade"
    assert any("existing paper position" in warning for warning in blocked["guardrail_warnings"])
    assert allowed["action"] == "close_trade"
    assert allowed["side"] == "sell"
    assert allowed["quantity"] == 3


def test_prompt_is_strict_json_and_paper_only():
    context = minimal_context()
    messages = ai_paper_trader_prompt(context)
    joined = "\n".join(message["content"] for message in messages)

    assert "strict JSON" in joined
    assert "simulated paper trading" in joined
    assert "never recommend or place live broker orders" in joined
    assert "open_trade | close_trade | hold | no_trade" in joined
    assert "execution_adapter_enabled" in joined
    assert "allowed/blocked symbols" in joined
