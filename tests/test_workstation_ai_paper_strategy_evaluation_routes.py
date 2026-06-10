from __future__ import annotations

from fastapi import FastAPI
from fastapi.testclient import TestClient

from tradingview_mcp.workstation_ai_paper_strategy_evaluation_routes import register_ai_paper_strategy_evaluation_routes


def test_strategy_evaluation_route_is_read_only_and_ranks_packets():
    app = FastAPI(title="Autonomx Trading Research Workstation")
    register_ai_paper_strategy_evaluation_routes(app)
    client = TestClient(app)

    response = client.post(
        "/api/ai/paper-trader/strategy-evaluation",
        json={
            "groups": ["strategy", "symbol"],
            "packets": [
                {
                    "metadata": {"strategy": "breakout", "symbol": "BTCUSDT", "timeframe": "1h"},
                    "summary": {"decision_count": 2, "symbols": ["BTCUSDT"]},
                    "performance": {"summary": {"decision_count": 2, "replayed_count": 2, "win_count": 1, "loss_count": 1, "total_realized_pnl": 5.0}},
                    "paper_only": True,
                    "live_execution": False,
                    "execution_submitted": False,
                    "read_only": True,
                },
                {
                    "metadata": {"strategy": "pullback", "symbol": "ETHUSDT", "timeframe": "1h"},
                    "summary": {"decision_count": 2, "symbols": ["ETHUSDT"]},
                    "performance": {"summary": {"decision_count": 2, "replayed_count": 2, "win_count": 2, "loss_count": 0, "total_realized_pnl": 20.0}},
                    "paper_only": True,
                    "live_execution": False,
                    "execution_submitted": False,
                    "read_only": True,
                },
            ],
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["evaluation_type"] == "ai_paper_strategy_evaluation_bundle"
    assert payload["summary"]["best_strategy"] == "pullback"
    assert payload["ranked_strategies"][0]["label"] == "pullback"
    assert payload["groups"]["strategy"][0]["key"] == "pullback"
    assert payload["paper_only"] is True
    assert payload["live_execution"] is False
    assert payload["execution_submitted"] is False
    assert payload["background_loop_enabled"] is False
    assert payload["read_only"] is True


def test_strategy_evaluation_route_registration_is_idempotent():
    app = FastAPI(title="Autonomx Trading Research Workstation")
    register_ai_paper_strategy_evaluation_routes(app)
    register_ai_paper_strategy_evaluation_routes(app)

    matching = [route for route in app.routes if getattr(route, "path", None) == "/api/ai/paper-trader/strategy-evaluation"]
    assert len(matching) == 1
