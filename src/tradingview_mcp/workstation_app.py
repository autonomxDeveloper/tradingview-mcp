"""Local browser workstation for charting, research, backtests, ideas, and LM Studio analysis.

The workstation is research-only. It does not submit or simulate broker actions.
"""
from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
from typing import Any, Literal

import requests
import uvicorn
from fastapi import FastAPI, Query
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from tradingview_mcp.core.services.alpaca_service import (
    get_alpaca_account,
    get_alpaca_positions,
    get_alpaca_safety_status,
    get_alpaca_stock_bars,
    get_alpaca_stock_quote,
)
from tradingview_mcp.core.services.backtest_record_service import (
    backtest_registry_status,
    create_backtest_record,
    list_backtest_records,
)
from tradingview_mcp.core.services.backtest_service import compare_strategies as compare_backtest_strategies
from tradingview_mcp.core.services.backtest_service import run_backtest
from tradingview_mcp.core.services.crypto_live_service import (
    SUPPORTED_CRYPTO_VENUES,
    get_crypto_candles,
    get_crypto_live_ticker,
    get_crypto_order_book,
)
from tradingview_mcp.core.services.research_idea_service import (
    create_research_idea,
    idea_registry_status,
    list_research_ideas,
    update_research_idea_status,
)
from tradingview_mcp.core.services.screener_service import analyze_coin
from tradingview_mcp.core.services.workstation_chart_service import get_yahoo_chart
from tradingview_mcp.core.services.workstation_drawing_service import drawing_status, load_drawings, save_drawings
from tradingview_mcp.core.services.workstation_export_service import export_status, list_export_files, resolve_export_file, save_export_packet
from tradingview_mcp.core.services.workstation_journal_service import append_journal_event, read_journal_events, workstation_status
from tradingview_mcp.core.services.workstation_layout_service import layout_status, list_layouts, save_layout
from tradingview_mcp.core.services.workstation_snapshot_service import list_snapshots, save_snapshot, snapshot_status
from tradingview_mcp.core.services.workstation_watchlist_service import read_watchlist, save_watchlist, watchlist_status
from tradingview_mcp.core.services.yahoo_finance_service import get_price
from tradingview_mcp.core.utils.validators import normalize_yahoo_symbol, sanitize_exchange, sanitize_timeframe


DEFAULT_WATCHLIST = ["AAPL", "NVDA", "TSLA", "SPY", "QQQ", "BTCUSDT", "ETHUSDT", "SOLUSDT"]
STATIC_DIR = Path(__file__).with_name("workstation_static")
INDEX_FILE = STATIC_DIR / "index.html"


class AnalyzeRequest(BaseModel):
    symbol: str = Field(..., min_length=1, max_length=32)
    asset_type: Literal["stock", "crypto", "auto"] = "auto"
    exchange: str = "NASDAQ"
    timeframe: str = "1D"
    question: str = "Give observations, risks, invalidation levels, and what to backtest next."


class BacktestRequest(BaseModel):
    symbol: str
    strategy: str = "ema_cross"
    period: str = "1y"
    initial_capital: float = 10000.0
    commission_pct: float = 0.1
    slippage_pct: float = 0.05
    interval: str = "1d"
    include_trade_log: bool = True
    include_equity_curve: bool = True
    idea_id: str | None = None
    notes: str = ""


class JournalRequest(BaseModel):
    event_type: str = "research_note"
    payload: dict[str, Any]


class LayoutRequest(BaseModel):
    name: str = "default"
    state: dict[str, Any]


class DrawingRequest(BaseModel):
    symbol: str
    timeframe: str
    drawings: dict[str, Any] = Field(default_factory=dict)


class SnapshotRequest(BaseModel):
    snapshot: dict[str, Any] = Field(default_factory=dict)


class ExportRequest(BaseModel):
    name: str = "research-packet"
    packet: dict[str, Any]
    markdown: str = ""


class WatchlistRequest(BaseModel):
    symbols: list[str] = Field(default_factory=list)


class IdeaStatusRequest(BaseModel):
    idea_id: str
    status: Literal["draft", "watching", "invalidated", "backtested", "archived"]
    note: str = ""


class ResearchIdeaRequest(BaseModel):
    symbol: str
    asset_type: Literal["stock", "crypto", "other"] = "stock"
    timeframe: str = "1D"
    status: Literal["draft", "watching", "invalidated", "backtested", "archived"] = "draft"
    bias: Literal["bullish", "bearish", "neutral", "range", "unknown"] = "unknown"
    setup_type: str = ""
    hypothesis: str
    invalidation: str
    risk_notes: str = ""
    backtest_plan: str
    source: str = "manual"
    links: list[dict[str, Any]] = Field(default_factory=list)
    metadata: dict[str, Any] = Field(default_factory=dict)


def _json_error(code: str, message: str, **extra: Any) -> dict[str, Any]:
    payload: dict[str, Any] = {"error": {"code": code, "message": message}}
    payload["error"].update(extra)
    return payload


def _watchlist() -> list[str]:
    raw = os.environ.get("TRADING_WORKSTATION_WATCHLIST", "")
    env_items = [item.strip().upper() for item in raw.split(",") if item.strip()]
    return read_watchlist(env_items or DEFAULT_WATCHLIST)


def _lmstudio_base_url() -> str:
    return os.environ.get("LMSTUDIO_BASE_URL", "http://localhost:1234/v1").rstrip("/")


def _lmstudio_model() -> str | None:
    return os.environ.get("LMSTUDIO_MODEL") or None


def _call_lmstudio(messages: list[dict[str, str]], max_tokens: int = 900) -> dict[str, Any]:
    body: dict[str, Any] = {"messages": messages, "temperature": 0.2, "max_tokens": max_tokens}
    model = _lmstudio_model()
    if model:
        body["model"] = model
    try:
        response = requests.post(f"{_lmstudio_base_url()}/chat/completions", json=body, timeout=float(os.environ.get("LMSTUDIO_TIMEOUT_SECONDS", "120")))
    except requests.RequestException as exc:
        return _json_error("LMSTUDIO_REQUEST_FAILED", str(exc), base_url=_lmstudio_base_url())
    try:
        payload = response.json()
    except ValueError:
        payload = {"raw": response.text[:500]}
    if response.status_code >= 400:
        return _json_error("LMSTUDIO_UPSTREAM_ERROR", "LM Studio returned an error", upstream_payload=payload)
    choices = payload.get("choices") or []
    return {"content": choices[0].get("message", {}).get("content", "") if choices else "", "model": payload.get("model") or model, "raw": payload}


def _parse_structured_analysis(content: str) -> dict[str, Any]:
    if not content.strip():
        return {"parsed": False, "raw": content}
    cleaned = content.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.strip("`").strip()
        if cleaned.lower().startswith("json"):
            cleaned = cleaned[4:].strip()
    try:
        payload = json.loads(cleaned)
    except json.JSONDecodeError:
        return {"parsed": False, "raw": content}
    if not isinstance(payload, dict):
        return {"parsed": False, "raw": content}
    return {
        "parsed": True,
        "summary": str(payload.get("summary", "")),
        "trend": str(payload.get("trend", "")),
        "key_levels": payload.get("key_levels", []),
        "risks": payload.get("risks", []),
        "invalidation": str(payload.get("invalidation", "")),
        "backtest_ideas": payload.get("backtest_ideas", []),
        "confidence": str(payload.get("confidence", "unknown")),
        "not_financial_advice": bool(payload.get("not_financial_advice", True)),
        "raw": payload,
    }


def _is_crypto_symbol(symbol: str, asset_type: str = "auto") -> bool:
    clean = symbol.upper()
    return asset_type == "crypto" or clean.endswith(("USDT", "USDC", "-USD", "/USD")) or clean in {"BTC", "ETH", "SOL"}


def _stock_yahoo_symbol(symbol: str) -> str:
    return normalize_yahoo_symbol(symbol.strip().upper())


def create_app() -> FastAPI:
    app = FastAPI(title="Autonomx Trading Research Workstation", version="1.3.0")
    app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="workstation-static")

    @app.get("/")
    def index() -> FileResponse:
        return FileResponse(INDEX_FILE)

    @app.get("/api/health")
    def health() -> dict[str, Any]:
        return {
            "ok": True,
            "lmstudio_base_url": _lmstudio_base_url(),
            "lmstudio_model": _lmstudio_model(),
            "watchlist": _watchlist(),
            "watchlist_registry": watchlist_status(DEFAULT_WATCHLIST),
            "crypto_venues": sorted(SUPPORTED_CRYPTO_VENUES),
            "alpaca": get_alpaca_safety_status(),
            "workstation": workstation_status(),
            "ideas": idea_registry_status(),
            "backtests": backtest_registry_status(),
            "layouts": layout_status(),
            "drawings": drawing_status(),
            "exports": export_status(),
            "snapshots": snapshot_status(),
            "static_dir": str(STATIC_DIR),
        }

    @app.get("/api/watchlist")
    def watchlist() -> dict[str, Any]:
        return {"symbols": _watchlist()}

    @app.post("/api/watchlist")
    def watchlist_save(request: WatchlistRequest) -> dict[str, Any]:
        record = save_watchlist(request.symbols)
        append_journal_event("watchlist_saved", {"count": len(record.get("symbols", []))})
        return {"watchlist": record}

    @app.get("/api/drawings")
    def drawings_load(symbol: str, timeframe: str = "1D") -> dict[str, Any]:
        return {"symbol": symbol.strip().upper(), "timeframe": timeframe, "drawings": load_drawings(symbol, timeframe)}

    @app.post("/api/drawings")
    def drawings_save(request: DrawingRequest) -> dict[str, Any]:
        record = save_drawings(request.symbol, request.timeframe, request.drawings)
        append_journal_event("drawings_saved", {"symbol": request.symbol.upper(), "timeframe": request.timeframe})
        return {"drawing_record": record}

    @app.get("/api/snapshots")
    def snapshots_list(limit: int = 100) -> dict[str, Any]:
        return {"snapshots": list_snapshots(limit)}

    @app.post("/api/snapshots")
    def snapshots_save(request: SnapshotRequest) -> dict[str, Any]:
        record = save_snapshot(request.snapshot)
        append_journal_event("research_session_snapshot", record)
        return {"snapshot": record, "snapshots": list_snapshots(100)}

    @app.get("/api/exports")
    def exports_list() -> dict[str, Any]:
        return {"exports": list_export_files()}

    @app.get("/api/exports/download/{filename}")
    def exports_download(filename: str):
        try:
            path = resolve_export_file(filename)
        except FileNotFoundError:
            return _json_error("EXPORT_FILE_NOT_FOUND", "Export file was not found")
        return FileResponse(path, filename=path.name)

    @app.post("/api/exports")
    def exports_save(request: ExportRequest) -> dict[str, Any]:
        record = save_export_packet(request.name, request.packet, request.markdown)
        append_journal_event("research_packet_file_saved", record)
        return {"export": record, "exports": list_export_files()}

    @app.get("/api/layouts")
    def layouts_list() -> dict[str, Any]:
        return {"layouts": list_layouts()}

    @app.post("/api/layouts")
    def layouts_save(request: LayoutRequest) -> dict[str, Any]:
        record = save_layout(request.name, request.state)
        append_journal_event("layout_saved", {"name": record.get("name")})
        return {"layout": record}

    @app.get("/api/stock/quote")
    def stock_quote(symbol: str = Query(..., min_length=1, max_length=32)) -> dict[str, Any]:
        return get_price(_stock_yahoo_symbol(symbol))

    @app.get("/api/stock/yahoo-chart")
    def stock_yahoo_chart(symbol: str, timeframe: str = "1D", limit: int = 300) -> dict[str, Any]:
        return get_yahoo_chart(symbol, timeframe, limit)

    @app.get("/api/stock/alpaca-quote")
    def stock_alpaca_quote(symbol: str, feed: str = "iex") -> dict[str, Any]:
        try:
            return get_alpaca_stock_quote(symbol, feed)
        except RuntimeError as exc:
            return _json_error("MISSING_ALPACA_CREDENTIALS", str(exc))

    @app.get("/api/stock/alpaca-bars")
    def stock_alpaca_bars(symbol: str, timeframe: str = "1Day", limit: int = 200, feed: str = "iex") -> dict[str, Any]:
        try:
            return get_alpaca_stock_bars(symbol, timeframe, limit, feed)
        except RuntimeError as exc:
            return _json_error("MISSING_ALPACA_CREDENTIALS", str(exc))

    @app.get("/api/crypto/ticker")
    def crypto_ticker(symbol: str, venue: str = "binance") -> dict[str, Any]:
        return get_crypto_live_ticker(symbol, venue)

    @app.get("/api/crypto/book")
    def crypto_book(symbol: str, venue: str = "binance", limit: int = 20) -> dict[str, Any]:
        return get_crypto_order_book(symbol, venue, limit)

    @app.get("/api/crypto/candles")
    def crypto_candles(symbol: str, venue: str = "binance", interval: str = "1h", limit: int = 200) -> dict[str, Any]:
        return get_crypto_candles(symbol, venue, interval, limit)

    @app.get("/api/technical")
    def technical(symbol: str, exchange: str = "NASDAQ", timeframe: str = "1D") -> dict[str, Any]:
        try:
            return analyze_coin(symbol, sanitize_exchange(exchange, "NASDAQ"), sanitize_timeframe(timeframe, "1D"))
        except Exception as exc:
            return _json_error("TECHNICAL_ANALYSIS_FAILED", str(exc))

    @app.post("/api/ai/analyze")
    def ai_analyze(request: AnalyzeRequest) -> dict[str, Any]:
        is_crypto = _is_crypto_symbol(request.symbol, request.asset_type)
        market: dict[str, Any] = {"symbol": request.symbol.upper(), "asset_type": "crypto" if is_crypto else "stock", "timeframe": request.timeframe}
        if is_crypto:
            market["ticker"] = get_crypto_live_ticker(request.symbol, "binance")
            market["candles"] = get_crypto_candles(request.symbol, "binance", request.timeframe.lower(), 120)
        else:
            market["quote"] = get_price(_stock_yahoo_symbol(request.symbol))
            market["chart"] = get_yahoo_chart(request.symbol, request.timeframe, 120)
            try:
                market["alpaca_bars"] = get_alpaca_stock_bars(request.symbol, "1Day", 120, "iex")
            except RuntimeError:
                market["alpaca_bars"] = {"note": "Alpaca credentials not configured"}
        try:
            tv_symbol = request.symbol.replace("-USD", "USDT") if is_crypto else request.symbol
            market["technical"] = analyze_coin(tv_symbol, sanitize_exchange(request.exchange, "BINANCE" if is_crypto else "NASDAQ"), sanitize_timeframe(request.timeframe, "1D"))
        except Exception as exc:
            market["technical_error"] = str(exc)
        prompt = (
            "You are a cautious trading research assistant. Do not provide financial advice or tell the user to take a position. "
            "Return only valid JSON with these keys: summary, trend, key_levels, risks, invalidation, backtest_ideas, confidence, not_financial_advice. "
            "Use observations, hypotheses, invalidation levels, risks, and backtest ideas only. confidence must be low, medium, or high. not_financial_advice must be true.\n\n"
            f"Market context:\n{market}\n\nUser question: {request.question}"
        )
        analysis = _call_lmstudio([
            {"role": "system", "content": "You analyze stocks and crypto with risk-first language and return strict JSON only."},
            {"role": "user", "content": prompt},
        ])
        structured_analysis = _parse_structured_analysis(str(analysis.get("content", "")))
        event = append_journal_event("ai_analysis", {"request": request.model_dump(), "market": market, "analysis": analysis.get("content", ""), "structured_analysis": structured_analysis})
        return {"market": market, "analysis": analysis, "structured_analysis": structured_analysis, "journal_event": event}

    @app.post("/api/backtest/run")
    def backtest_run(request: BacktestRequest) -> dict[str, Any]:
        request_payload = request.model_dump()
        append_journal_event("backtest_run_requested", request_payload)
        result = run_backtest(request.symbol, request.strategy, request.period, request.initial_capital, request.commission_pct, request.slippage_pct, request.interval, request.include_trade_log, request.include_equity_curve)
        record = create_backtest_record(request=request_payload, result=result, idea_id=request.idea_id, notes=request.notes)
        record_id = record.get("record", {}).get("id")
        append_journal_event("backtest_record_created", {"record_id": record_id, "idea_id": request.idea_id})
        promotion_event = None
        if request.idea_id:
            promotion_event = update_research_idea_status(request.idea_id, "backtested", f"Backtest record {record_id} completed for {request.symbol}.")
            append_journal_event("backtest_promoted_idea", {"record_id": record_id, "idea_id": request.idea_id, "status_event": promotion_event})
        return {"result": result, "record": record, "idea_promotion": promotion_event}

    @app.get("/api/backtest/compare")
    def backtest_compare(symbol: str, period: str = "1y", initial_capital: float = 10000.0, interval: str = "1d") -> dict[str, Any]:
        append_journal_event("backtest_compare_requested", {"symbol": symbol, "period": period, "interval": interval})
        return compare_backtest_strategies(symbol, period, initial_capital, interval=interval)

    @app.get("/api/backtests")
    def backtests_list(symbol: str | None = None, strategy: str | None = None, idea_id: str | None = None, limit: int = 100) -> dict[str, Any]:
        return {"records": list_backtest_records(symbol=symbol, strategy=strategy, idea_id=idea_id, limit=limit)}

    @app.get("/api/alpaca/account")
    def alpaca_account() -> dict[str, Any]:
        try:
            return get_alpaca_account()
        except RuntimeError as exc:
            return _json_error("MISSING_ALPACA_CREDENTIALS", str(exc))

    @app.get("/api/alpaca/positions")
    def alpaca_positions() -> dict[str, Any]:
        try:
            return get_alpaca_positions()
        except RuntimeError as exc:
            return _json_error("MISSING_ALPACA_CREDENTIALS", str(exc))

    @app.post("/api/ideas")
    def ideas_create(request: ResearchIdeaRequest) -> dict[str, Any]:
        event = create_research_idea(request.model_dump())
        append_journal_event("research_idea_created", event)
        return event

    @app.post("/api/ideas/status")
    def ideas_update_status(request: IdeaStatusRequest) -> dict[str, Any]:
        event = update_research_idea_status(request.idea_id, request.status, request.note)
        append_journal_event("research_idea_status_updated", event)
        return event

    @app.get("/api/ideas")
    def ideas_list(symbol: str | None = None, status: str | None = None, asset_type: str | None = None, limit: int = 100) -> dict[str, Any]:
        return {"ideas": list_research_ideas(symbol=symbol, status=status, asset_type=asset_type, limit=limit)}

    @app.post("/api/journal")
    def journal_write(request: JournalRequest) -> dict[str, Any]:
        return append_journal_event(request.event_type, request.payload)

    @app.get("/api/journal")
    def journal_read(limit: int = 100) -> dict[str, Any]:
        return {"events": read_journal_events(limit)}

    return app


app = create_app()


def main() -> None:
    parser = argparse.ArgumentParser(description="Local trading research workstation")
    parser.add_argument("--host", default=os.environ.get("TRADING_WORKSTATION_HOST", "127.0.0.1"))
    parser.add_argument("--port", type=int, default=int(os.environ.get("TRADING_WORKSTATION_PORT", "8088")))
    parser.add_argument("--reload", action="store_true")
    args = parser.parse_args()
    uvicorn.run("tradingview_mcp.workstation_app:app", host=args.host, port=args.port, reload=args.reload)


if __name__ == "__main__":
    main()
