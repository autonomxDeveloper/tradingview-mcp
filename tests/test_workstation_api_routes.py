from __future__ import annotations

from fastapi.testclient import TestClient

from tradingview_mcp import workstation_app


def _client(monkeypatch, tmp_path) -> TestClient:
    monkeypatch.setenv("TRADING_WORKSTATION_JOURNAL", str(tmp_path / "journal.jsonl"))
    monkeypatch.setenv("TRADING_WORKSTATION_IDEAS", str(tmp_path / "ideas.jsonl"))
    monkeypatch.setenv("TRADING_WORKSTATION_BACKTESTS", str(tmp_path / "backtests.jsonl"))
    return TestClient(workstation_app.create_app())


def test_core_workstation_routes(monkeypatch, tmp_path):
    client = _client(monkeypatch, tmp_path)

    index_response = client.get("/")
    health_response = client.get("/api/health")
    watchlist_response = client.get("/api/watchlist")

    assert index_response.status_code == 200
    assert "Autonomx Trading Research Workstation" in index_response.text
    assert health_response.status_code == 200
    assert health_response.json()["ok"] is True
    assert "workstation" in health_response.json()
    assert watchlist_response.status_code == 200
    assert "AAPL" in watchlist_response.json()["symbols"]


def test_journal_routes_round_trip(monkeypatch, tmp_path):
    client = _client(monkeypatch, tmp_path)

    create_response = client.post("/api/journal", json={"event_type": "note", "payload": {"value": 1}})
    list_response = client.get("/api/journal")

    assert create_response.status_code == 200
    assert create_response.json()["event_type"] == "note"
    assert list_response.status_code == 200
    assert list_response.json()["events"][-1]["payload"] == {"value": 1}


def test_idea_routes_round_trip(monkeypatch, tmp_path):
    client = _client(monkeypatch, tmp_path)

    create_response = client.post(
        "/api/ideas",
        json={
            "symbol": "AAPL",
            "asset_type": "stock",
            "timeframe": "1D",
            "bias": "neutral",
            "hypothesis": "Price may consolidate above support.",
            "invalidation": "Daily close below support.",
            "backtest_plan": "Compare trend-following and mean-reversion baselines.",
        },
    )
    list_response = client.get("/api/ideas?symbol=AAPL")

    assert create_response.status_code == 200
    assert create_response.json()["accepted"] is True
    assert list_response.status_code == 200
    assert list_response.json()["ideas"][-1]["symbol"] == "AAPL"


def test_backtest_record_list_route(monkeypatch, tmp_path):
    client = _client(monkeypatch, tmp_path)

    response = client.get("/api/backtests")

    assert response.status_code == 200
    assert response.json() == {"records": []}


def test_yahoo_chart_route_with_mock(monkeypatch, tmp_path):
    client = _client(monkeypatch, tmp_path)

    def fake_get_yahoo_chart(symbol: str, timeframe: str = "1D", limit: int = 300):
        return {
            "symbol": symbol.upper(),
            "timeframe": timeframe,
            "candles": [
                {"time": 1, "open": 100.0, "high": 101.0, "low": 99.0, "close": 100.5, "volume": 1000}
            ],
            "source": "test",
        }

    monkeypatch.setattr(workstation_app, "get_yahoo_chart", fake_get_yahoo_chart)

    response = client.get("/api/stock/yahoo-chart?symbol=AAPL&timeframe=1D&limit=1")

    assert response.status_code == 200
    assert response.json()["symbol"] == "AAPL"
    assert response.json()["candles"][0]["close"] == 100.5


def test_ai_analysis_route_with_mocks(monkeypatch, tmp_path):
    client = _client(monkeypatch, tmp_path)

    monkeypatch.setattr(workstation_app, "get_price", lambda symbol: {"symbol": symbol, "price": 100})
    monkeypatch.setattr(workstation_app, "get_yahoo_chart", lambda symbol, timeframe, limit: {"symbol": symbol, "candles": []})
    monkeypatch.setattr(workstation_app, "get_alpaca_stock_bars", lambda symbol, timeframe, limit, feed: {"bars": []})
    monkeypatch.setattr(workstation_app, "analyze_coin", lambda symbol, exchange, timeframe: {"summary": "neutral"})
    monkeypatch.setattr(workstation_app, "_call_lmstudio", lambda messages: {"content": "analysis text"})

    response = client.post(
        "/api/ai/analyze",
        json={"symbol": "AAPL", "asset_type": "stock", "exchange": "NASDAQ", "timeframe": "1D", "question": "Analyze."},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["analysis"]["content"] == "analysis text"
    assert payload["market"]["symbol"] == "AAPL"


def test_backtest_run_route_with_mock(monkeypatch, tmp_path):
    client = _client(monkeypatch, tmp_path)

    monkeypatch.setattr(
        workstation_app,
        "run_backtest",
        lambda *args, **kwargs: {"symbol": args[0], "strategy": args[1], "total_return_pct": 5.0},
    )

    response = client.post(
        "/api/backtest/run",
        json={"symbol": "AAPL", "strategy": "ema_cross", "period": "1y", "idea_id": "idea-1"},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["result"]["total_return_pct"] == 5.0
    assert payload["record"]["record"]["idea_id"] == "idea-1"
