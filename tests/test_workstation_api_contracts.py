from __future__ import annotations

from typing import Any

from fastapi.testclient import TestClient

from tradingview_mcp import workstation_app


class FakeResponse:
    status_code = 200

    def json(self) -> dict[str, Any]:
        return {
            "choices": [
                {
                    "message": {
                        "content": '{"summary":"ok","trend":"neutral","key_levels":["100"],"risks":["test risk"],"invalidation":"below 90","backtest_ideas":["ema_cross"],"confidence":"low","not_financial_advice":true}'
                    }
                }
            ],
            "model": "fake-local-model",
        }


def make_client(monkeypatch) -> TestClient:
    monkeypatch.setattr(workstation_app, "_watchlist", lambda: ["AAPL", "NVDA", "BTCUSDT"])
    monkeypatch.setattr(workstation_app, "watchlist_status", lambda default=None: {"ok": True, "symbols": ["AAPL", "NVDA", "BTCUSDT"]})
    monkeypatch.setattr(workstation_app, "paper_trading_status", lambda: {"execution_enabled": False, "paper_only": True})
    monkeypatch.setattr(workstation_app, "workstation_status", lambda: {"mode": "test"})
    monkeypatch.setattr(workstation_app, "idea_registry_status", lambda: {"count": 0})
    monkeypatch.setattr(workstation_app, "backtest_registry_status", lambda: {"count": 0})
    monkeypatch.setattr(workstation_app, "layout_status", lambda: {"count": 0})
    monkeypatch.setattr(workstation_app, "drawing_status", lambda: {"count": 0})
    monkeypatch.setattr(workstation_app, "export_status", lambda: {"count": 0})
    monkeypatch.setattr(workstation_app, "snapshot_status", lambda: {"count": 0})
    monkeypatch.setattr(workstation_app, "get_alpaca_safety_status", lambda: {"configured": False, "live_execution": False})
    monkeypatch.setattr(workstation_app, "append_journal_event", lambda event_type, payload: {"id": "evt-test", "type": event_type, "payload": payload})
    monkeypatch.setattr(workstation_app, "read_journal_events", lambda limit=100: [{"id": "evt-test", "type": "research_note"}])
    return TestClient(workstation_app.create_app())


def sample_chart(symbol: str = "AAPL") -> dict[str, Any]:
    return {
        "symbol": symbol,
        "timeframe": "1D",
        "candles": [
            {"time": 1700000000, "open": 100.0, "high": 105.0, "low": 99.0, "close": 104.0, "volume": 1000},
            {"time": 1700086400, "open": 104.0, "high": 106.0, "low": 101.0, "close": 102.0, "volume": 900},
        ],
        "source": "test",
    }


def test_health_and_watchlist_apis_are_available(monkeypatch):
    client = make_client(monkeypatch)

    health = client.get("/api/health")
    assert health.status_code == 200
    health_payload = health.json()
    assert health_payload["ok"] is True
    assert health_payload["watchlist"] == ["AAPL", "NVDA", "BTCUSDT"]
    assert health_payload["paper_trading"]["paper_only"] is True
    assert health_payload["alpaca"]["live_execution"] is False

    watchlist = client.get("/api/watchlist")
    assert watchlist.status_code == 200
    assert watchlist.json()["symbols"] == ["AAPL", "NVDA", "BTCUSDT"]


def test_market_data_routes_use_provider_adapters(monkeypatch):
    monkeypatch.setattr(workstation_app, "get_price", lambda symbol: {"symbol": symbol, "price": 123.45, "source": "test"})
    monkeypatch.setattr(workstation_app, "get_yahoo_chart", lambda symbol, timeframe, limit: sample_chart(symbol))
    monkeypatch.setattr(workstation_app, "get_alpaca_stock_quote", lambda symbol, feed: {"symbol": symbol, "feed": feed, "bid": 123.0, "ask": 124.0})
    monkeypatch.setattr(workstation_app, "get_alpaca_stock_bars", lambda symbol, timeframe, limit, feed: {"symbol": symbol, "bars": sample_chart(symbol)["candles"]})
    monkeypatch.setattr(workstation_app, "get_crypto_live_ticker", lambda symbol, venue: {"symbol": symbol, "venue": venue, "price": 65000.0})
    monkeypatch.setattr(workstation_app, "get_crypto_order_book", lambda symbol, venue, limit: {"symbol": symbol, "venue": venue, "bids": [], "asks": [], "limit": limit})
    monkeypatch.setattr(workstation_app, "get_crypto_candles", lambda symbol, venue, interval, limit: {"symbol": symbol, "venue": venue, "interval": interval, "candles": sample_chart(symbol)["candles"]})
    monkeypatch.setattr(workstation_app, "analyze_coin", lambda symbol, exchange, timeframe: {"symbol": symbol, "exchange": exchange, "timeframe": timeframe, "summary": "ok"})
    client = make_client(monkeypatch)

    assert client.get("/api/stock/quote", params={"symbol": "AAPL"}).json()["price"] == 123.45
    chart = client.get("/api/stock/yahoo-chart", params={"symbol": "AAPL", "timeframe": "1D", "limit": 5}).json()
    assert chart["symbol"] == "AAPL"
    assert len(chart["candles"]) == 2
    assert client.get("/api/stock/alpaca-quote", params={"symbol": "AAPL", "feed": "iex"}).json()["feed"] == "iex"
    assert client.get("/api/stock/alpaca-bars", params={"symbol": "AAPL", "timeframe": "1Day", "limit": 2, "feed": "iex"}).json()["symbol"] == "AAPL"
    assert client.get("/api/crypto/ticker", params={"symbol": "BTCUSDT", "venue": "binance"}).json()["price"] == 65000.0
    assert client.get("/api/crypto/book", params={"symbol": "BTCUSDT", "venue": "binance", "limit": 3}).json()["limit"] == 3
    assert client.get("/api/crypto/candles", params={"symbol": "BTCUSDT", "venue": "binance", "interval": "1h", "limit": 2}).json()["interval"] == "1h"
    technical = client.get("/api/technical", params={"symbol": "AAPL", "exchange": "NASDAQ", "timeframe": "1D"}).json()
    assert technical["summary"] == "ok"


def test_research_artifact_routes_are_round_tripped(monkeypatch):
    saved: dict[str, Any] = {}
    monkeypatch.setattr(workstation_app, "save_drawings", lambda symbol, timeframe, drawings: {"symbol": symbol.upper(), "timeframe": timeframe, "drawings": drawings})
    monkeypatch.setattr(workstation_app, "load_drawings", lambda symbol, timeframe: {"levels": [101.5]})
    monkeypatch.setattr(workstation_app, "save_snapshot", lambda snapshot: {"id": "snap-test", "snapshot": snapshot})
    monkeypatch.setattr(workstation_app, "list_snapshots", lambda limit=100: [{"id": "snap-test"}])
    monkeypatch.setattr(workstation_app, "save_layout", lambda name, state: {"name": name, "state": state})
    monkeypatch.setattr(workstation_app, "list_layouts", lambda: [{"name": "default"}])
    monkeypatch.setattr(workstation_app, "save_export_packet", lambda name, packet, markdown: {"name": name, "packet": packet, "markdown": markdown, "filename": f"{name}.json"})
    monkeypatch.setattr(workstation_app, "list_export_files", lambda: [{"filename": "packet.json"}])
    monkeypatch.setattr(workstation_app, "create_research_idea", lambda payload: saved.setdefault("idea", {"idea_id": "idea-test", "payload": payload}))
    monkeypatch.setattr(workstation_app, "update_research_idea_status", lambda idea_id, status, note: {"idea_id": idea_id, "status": status, "note": note})
    monkeypatch.setattr(workstation_app, "list_research_ideas", lambda symbol=None, status=None, asset_type=None, limit=100: [{"idea_id": "idea-test", "symbol": symbol or "AAPL"}])
    client = make_client(monkeypatch)

    assert client.post("/api/drawings", json={"symbol": "aapl", "timeframe": "1D", "drawings": {"levels": [101.5]}}).json()["drawing_record"]["symbol"] == "AAPL"
    assert client.get("/api/drawings", params={"symbol": "AAPL", "timeframe": "1D"}).json()["drawings"]["levels"] == [101.5]
    assert client.post("/api/snapshots", json={"snapshot": {"symbol": "AAPL"}}).json()["snapshot"]["id"] == "snap-test"
    assert client.get("/api/snapshots").json()["snapshots"][0]["id"] == "snap-test"
    assert client.post("/api/layouts", json={"name": "default", "state": {"symbol": "AAPL"}}).json()["layout"]["name"] == "default"
    assert client.get("/api/layouts").json()["layouts"][0]["name"] == "default"
    assert client.post("/api/exports", json={"name": "packet", "packet": {"symbol": "AAPL"}, "markdown": "# Packet"}).json()["export"]["filename"] == "packet.json"
    assert client.get("/api/exports").json()["exports"][0]["filename"] == "packet.json"

    idea_payload = {
        "symbol": "AAPL",
        "asset_type": "stock",
        "timeframe": "1D",
        "status": "draft",
        "bias": "neutral",
        "setup_type": "range",
        "hypothesis": "Range hypothesis",
        "invalidation": "Breakdown",
        "risk_notes": "Small size",
        "backtest_plan": "Compare EMA cross",
    }
    assert client.post("/api/ideas", json=idea_payload).json()["idea_id"] == "idea-test"
    assert client.post("/api/ideas/status", json={"idea_id": "idea-test", "status": "watching", "note": "monitor"}).json()["status"] == "watching"
    assert client.get("/api/ideas", params={"symbol": "AAPL"}).json()["ideas"][0]["symbol"] == "AAPL"
    assert client.post("/api/journal", json={"event_type": "research_note", "payload": {"note": "ok"}}).json()["type"] == "research_note"
    assert client.get("/api/journal").json()["events"][0]["type"] == "research_note"


def test_backtest_and_compare_routes(monkeypatch):
    monkeypatch.setattr(workstation_app, "run_backtest", lambda *args, **kwargs: {"strategy": args[1], "total_return_pct": 12.5, "trades": []})
    monkeypatch.setattr(workstation_app, "create_backtest_record", lambda request, result, idea_id=None, notes="": {"record": {"id": "bt-test", "request": request, "result": result}})
    monkeypatch.setattr(workstation_app, "compare_backtest_strategies", lambda symbol, period, initial_capital, interval="1d": {"symbol": symbol, "rankings": [{"strategy": "ema_cross"}]})
    monkeypatch.setattr(workstation_app, "list_backtest_records", lambda symbol=None, strategy=None, idea_id=None, limit=100: [{"id": "bt-test", "symbol": symbol or "AAPL"}])
    client = make_client(monkeypatch)

    result = client.post("/api/backtest/run", json={"symbol": "AAPL", "strategy": "ema_cross", "period": "1y"}).json()
    assert result["result"]["strategy"] == "ema_cross"
    assert result["record"]["record"]["id"] == "bt-test"
    assert client.get("/api/backtest/compare", params={"symbol": "AAPL"}).json()["rankings"][0]["strategy"] == "ema_cross"
    assert client.get("/api/backtests", params={"symbol": "AAPL"}).json()["records"][0]["id"] == "bt-test"


def test_ai_routes_are_deterministic_and_preserve_safety_flags(monkeypatch):
    monkeypatch.setattr(workstation_app.requests, "post", lambda *args, **kwargs: FakeResponse())
    monkeypatch.setattr(workstation_app, "get_price", lambda symbol: {"symbol": symbol, "price": 123.45})
    monkeypatch.setattr(workstation_app, "get_yahoo_chart", lambda symbol, timeframe, limit: sample_chart(symbol))
    monkeypatch.setattr(workstation_app, "get_alpaca_stock_bars", lambda symbol, timeframe, limit, feed: {"bars": []})
    monkeypatch.setattr(workstation_app, "analyze_coin", lambda symbol, exchange, timeframe: {"symbol": symbol, "summary": "technical ok"})
    monkeypatch.setattr(workstation_app, "paper_account_snapshot", lambda marks=None: {"account": {"cash": 10000.0}, "positions": []})
    monkeypatch.setattr(workstation_app, "list_paper_orders", lambda limit=100: [])
    monkeypatch.setattr(workstation_app, "list_paper_fills", lambda limit=100: [])
    client = make_client(monkeypatch)

    ai_request = {"symbol": "AAPL", "asset_type": "stock", "exchange": "NASDAQ", "timeframe": "1D", "question": "Observe only."}
    analysis = client.post("/api/ai/analyze", json=ai_request).json()
    assert analysis["structured_analysis"]["parsed"] is True
    assert analysis["structured_analysis"]["not_financial_advice"] is True

    trade_idea = client.post("/api/ai/trade-idea", json={**ai_request, "profile": "swing", "mode": "research_trade_idea", "chart_context": {}}).json()
    assert trade_idea["structured_trade_idea"]["not_financial_advice"] is True
    assert trade_idea["journal_event"]["payload"]["live_execution"] is False

    decision = client.post(
        "/api/ai/paper-trader/decision",
        json={**ai_request, "chart_context": {}, "timeframes": ["5m", "1h", "1d"], "profile": "intraday_paper", "mode": "paper_trader_decision", "risk": {}},
    ).json()
    assert decision["paper_only"] is True
    assert decision["live_execution"] is False
    assert decision["execution_submitted"] is False
    assert decision["decision"]["paper_only"] is True


def test_paper_trading_routes_are_simulated(monkeypatch):
    monkeypatch.setattr(workstation_app, "paper_account_snapshot", lambda marks=None: {"account": {"cash": 10000.0}, "positions": [], "marks": marks or {}})
    monkeypatch.setattr(workstation_app, "list_paper_orders", lambda limit=100: [{"id": "order-test", "symbol": "AAPL"}])
    monkeypatch.setattr(workstation_app, "list_paper_fills", lambda limit=100: [{"id": "fill-test", "symbol": "AAPL"}])
    monkeypatch.setattr(workstation_app, "submit_paper_order", lambda symbol, side, quantity, order_type, asset_type, limit_price, stop_price, idea_id, notes: {"id": "order-test", "symbol": symbol, "side": side, "quantity": quantity, "live_execution": False})
    monkeypatch.setattr(workstation_app, "fill_paper_order", lambda order_id, fill_price, fill_quantity=None, source="manual_api": {"order": {"id": order_id, "status": "filled"}, "fill": {"price": fill_price, "quantity": fill_quantity}})
    monkeypatch.setattr(workstation_app, "cancel_paper_order", lambda order_id: {"id": order_id, "status": "cancelled"})
    monkeypatch.setattr(workstation_app, "reset_paper_account", lambda initial_cash, currency: {"account": {"cash": initial_cash, "currency": currency}})
    client = make_client(monkeypatch)

    assert client.get("/api/paper/account").json()["account"]["cash"] == 10000.0
    assert client.post("/api/paper/account/mark-to-market", json={"marks": {"AAPL": 200.0}}).json()["marks"]["AAPL"] == 200.0
    assert client.get("/api/paper/positions").json()["account"]["cash"] == 10000.0
    assert client.get("/api/paper/orders").json()["orders"][0]["id"] == "order-test"
    assert client.get("/api/paper/fills").json()["fills"][0]["id"] == "fill-test"
    order = client.post("/api/paper/orders", json={"symbol": "AAPL", "side": "buy", "quantity": 1, "order_type": "market", "asset_type": "stock"}).json()
    assert order["order"]["live_execution"] is False
    assert order["order"]["id"] == "order-test"
    assert client.post("/api/paper/orders/order-test/fill", json={"fill_price": 123.45, "fill_quantity": 1}).json()["order"]["status"] == "filled"
    assert client.post("/api/paper/orders/order-test/cancel").json()["order"]["status"] == "cancelled"
    assert client.post("/api/paper/reset", json={"initial_cash": 5000, "currency": "USD"}).json()["state"]["account"]["cash"] == 5000


def test_missing_alpaca_credentials_return_structured_errors(monkeypatch):
    def raise_missing(*args, **kwargs):
        raise RuntimeError("missing credentials")

    monkeypatch.setattr(workstation_app, "get_alpaca_account", raise_missing)
    monkeypatch.setattr(workstation_app, "get_alpaca_positions", raise_missing)
    monkeypatch.setattr(workstation_app, "get_alpaca_stock_quote", raise_missing)
    monkeypatch.setattr(workstation_app, "get_alpaca_stock_bars", raise_missing)
    client = make_client(monkeypatch)

    assert client.get("/api/alpaca/account").json()["error"]["code"] == "MISSING_ALPACA_CREDENTIALS"
    assert client.get("/api/alpaca/positions").json()["error"]["code"] == "MISSING_ALPACA_CREDENTIALS"
    assert client.get("/api/stock/alpaca-quote", params={"symbol": "AAPL"}).json()["error"]["code"] == "MISSING_ALPACA_CREDENTIALS"
    assert client.get("/api/stock/alpaca-bars", params={"symbol": "AAPL"}).json()["error"]["code"] == "MISSING_ALPACA_CREDENTIALS"
