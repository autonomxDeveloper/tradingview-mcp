"""Local browser workstation for charting, research, backtests, ideas, and LM Studio analysis.

The workstation is research-first. It can simulate local paper-trading actions,
but it does not submit live broker orders.
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

from tradingview_mcp.core.services.ai_paper_trader_service import (
    ai_paper_trader_prompt,
    build_ai_paper_trader_context,
    parse_ai_paper_trader_decision,
    validate_ai_paper_trader_decision,
)
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
from tradingview_mcp.core.services.paper_trading_service import (
    cancel_paper_order,
    fill_paper_order,
    list_paper_fills,
    list_paper_orders,
    paper_account_snapshot,
    paper_trading_status,
    reset_paper_account,
    submit_paper_order,
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


class TradeIdeaRequest(AnalyzeRequest):
    chart_context: dict[str, Any] = Field(default_factory=dict)
    profile: str = "swing"
    mode: str = "research_trade_idea"


class PaperTraderDecisionRequest(AnalyzeRequest):
    chart_context: dict[str, Any] = Field(default_factory=dict)
    timeframes: list[str] = Field(default_factory=lambda: ["5m", "15m", "1h", "1d"])
    profile: str = "intraday_paper"
    mode: str = "paper_trader_decision"
    risk: dict[str, Any] = Field(default_factory=dict)


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


class PaperOrderRequest(BaseModel):
    symbol: str = Field(..., min_length=1, max_length=32)
    side: Literal["buy", "sell"]
    quantity: float = Field(..., gt=0)
    order_type: Literal["market", "limit", "stop"] = "market"
    asset_type: Literal["stock", "crypto", "other"] = "stock"
    limit_price: float | None = Field(default=None, gt=0)
    stop_price: float | None = Field(default=None, gt=0)
    idea_id: str | None = None
    notes: str = ""


class PaperFillRequest(BaseModel):
    fill_price: float = Field(..., gt=0)
    fill_quantity: float | None = Field(default=None, gt=0)
    source: str = "manual_api"


class PaperResetRequest(BaseModel):
    initial_cash: float = Field(default=10000.0, ge=0)
    currency: str = "USD"


class PaperMarksRequest(BaseModel):
    marks: dict[str, float] = Field(default_factory=dict)


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


def _load_json_object(content: str) -> dict[str, Any] | None:
    if not content.strip():
        return None
    cleaned = content.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.strip("`").strip()
        if cleaned.lower().startswith("json"):
            cleaned = cleaned[4:].strip()
    try:
        payload = json.loads(cleaned)
    except json.JSONDecodeError:
        return None
    return payload if isinstance(payload, dict) else None


def _parse_structured_analysis(content: str) -> dict[str, Any]:
    payload = _load_json_object(content)
    if payload is None:
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


def _string_list(value: Any) -> list[str]:
    if value is None or value == "":
        return []
    if isinstance(value, list):
        return [str(item) for item in value if item is not None and str(item).strip()]
    return [str(value)]


def _normalize_direction(value: Any) -> str:
    clean = str(value or "").lower().replace(" ", "_")
    if clean in {"long", "buy", "bullish"}:
        return "long"
    if clean in {"short", "sell", "bearish"}:
        return "short"
    return "no_trade"


def _normalize_confidence(value: Any) -> str:
    clean = str(value or "").lower()
    return clean if clean in {"low", "medium", "high"} else "low"


def _normalize_bias(value: Any) -> str:
    clean = str(value or "").lower()
    return clean if clean in {"bullish", "bearish", "neutral", "range"} else "neutral"


def _parse_structured_trade_idea(content: str) -> dict[str, Any]:
    payload = _load_json_object(content)
    if payload is None:
        return {
            "parsed": False,
            "summary": "AI did not return valid JSON.",
            "trend": "unknown",
            "key_levels": [],
            "risks": ["Invalid or non-JSON model response."],
            "invalidation": "",
            "backtest_ideas": [],
            "confidence": "low",
            "not_financial_advice": True,
            "trade_idea": {
                "bias": "neutral",
                "setup_type": "no_trade",
                "direction": "no_trade",
                "entry_zone": "wait for valid structured output",
                "stop_or_invalidation": "not applicable",
                "targets": [],
                "risk_reward": "unknown",
                "sizing_note": "No simulated paper order should be created from invalid AI output.",
                "timeframe": "unknown",
                "paper_trade_candidate": False,
                "no_trade_reason": "AI response was not valid JSON.",
            },
            "raw": content,
        }
    trade = payload.get("trade_idea") or payload.get("trade_plan") or payload.get("tradePlan") or {}
    if not isinstance(trade, dict):
        trade = {}
    direction = _normalize_direction(trade.get("direction") or payload.get("direction"))
    no_trade_reason = str(trade.get("no_trade_reason") or payload.get("no_trade_reason") or "")
    return {
        "parsed": True,
        "summary": str(payload.get("summary", "")),
        "trend": str(payload.get("trend", "unknown")),
        "key_levels": _string_list(payload.get("key_levels")),
        "risks": _string_list(payload.get("risks")),
        "invalidation": str(payload.get("invalidation", "")),
        "backtest_ideas": _string_list(payload.get("backtest_ideas")),
        "confidence": _normalize_confidence(payload.get("confidence")),
        "not_financial_advice": payload.get("not_financial_advice") is not False,
        "trade_idea": {
            "bias": _normalize_bias(trade.get("bias") or payload.get("trend")),
            "setup_type": str(trade.get("setup_type") or ("no_trade" if direction == "no_trade" else "unspecified")),
            "direction": direction,
            "entry_zone": str(trade.get("entry_zone") or ("wait for confirmation" if direction == "no_trade" else "not specified")),
            "stop_or_invalidation": str(trade.get("stop_or_invalidation") or payload.get("invalidation") or ("not applicable" if direction == "no_trade" else "not specified")),
            "targets": _string_list(trade.get("targets")),
            "risk_reward": str(trade.get("risk_reward") or "unknown"),
            "sizing_note": str(trade.get("sizing_note") or "Paper simulation only; size manually after review."),
            "timeframe": str(trade.get("timeframe") or payload.get("timeframe") or "unknown"),
            "paper_trade_candidate": direction != "no_trade" and trade.get("paper_trade_candidate") is not False,
            "no_trade_reason": no_trade_reason if direction == "no_trade" else no_trade_reason,
        },
        "raw": payload,
    }


def _is_crypto_symbol(symbol: str, asset_type: str = "auto") -> bool:
    clean = symbol.upper()
    return asset_type == "crypto" or clean.endswith(("USDT", "USDC", "-USD", "/USD")) or clean in {"BTC", "ETH", "SOL"}


def _stock_yahoo_symbol(symbol: str) -> str:
    return normalize_yahoo_symbol(symbol.strip().upper())


def _market_context(symbol: str, asset_type: str, exchange: str, timeframe: str) -> dict[str, Any]:
    is_crypto = _is_crypto_symbol(symbol, asset_type)
    market: dict[str, Any] = {"symbol": symbol.upper(), "asset_type": "crypto" if is_crypto else "stock", "timeframe": timeframe}
    if is_crypto:
        market["ticker"] = get_crypto_live_ticker(symbol, "binance")
        market["candles"] = get_crypto_candles(symbol, "binance", timeframe.lower(), 120)
    else:
        market["quote"] = get_price(_stock_yahoo_symbol(symbol))
        market["chart"] = get_yahoo_chart(symbol, timeframe, 120)
        try:
            market["alpaca_bars"] = get_alpaca_stock_bars(symbol, "1Day", 120, "iex")
        except RuntimeError:
            market["alpaca_bars"] = {"note": "Alpaca credentials not configured"}
    try:
        tv_symbol = symbol.replace("-USD", "USDT") if is_crypto else symbol
        market["technical"] = analyze_coin(tv_symbol, sanitize_exchange(exchange, "BINANCE" if is_crypto else "NASDAQ"), sanitize_timeframe(timeframe, "1D"))
    except Exception as exc:
        market["technical_error"] = str(exc)
    return market


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
            "paper_trading": paper_trading_status(),
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
        market = _market_context(request.symbol, request.asset_type, request.exchange, request.timeframe)
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

    @app.post("/api/ai/trade-idea")
    def ai_trade_idea(request: TradeIdeaRequest) -> dict[str, Any]:
        market = _market_context(request.symbol, request.asset_type, request.exchange, request.timeframe)
        prompt = (
            "You are a cautious trading research assistant generating research-only paper-trading ideas. "
            "Do not provide financial advice and do not instruct the user to place a live trade. "
            "Return only valid JSON with these keys: summary, trend, key_levels, risks, invalidation, backtest_ideas, confidence, not_financial_advice, trade_idea. "
            "trade_idea must include: bias, setup_type, direction, entry_zone, stop_or_invalidation, targets, risk_reward, sizing_note, timeframe, paper_trade_candidate, no_trade_reason. "
            "Allowed direction values are long, short, no_trade. Allowed bias values are bullish, bearish, neutral, range. confidence must be low, medium, or high. "
            "Use direction=no_trade and paper_trade_candidate=false when the setup is unclear, extended, stale, illiquid, or not worth simulating. "
            "Entries and targets must be zones or confirmation conditions, not guarantees.\n\n"
            f"Market context:\n{market}\n\nVisible chart/workstation context:\n{request.chart_context}\n\nUser request/profile:\n{request.question}\nProfile: {request.profile}\nMode: {request.mode}"
        )
        trade_idea = _call_lmstudio([
            {"role": "system", "content": "You return strict JSON for research-only trade ideas. No live order advice."},
            {"role": "user", "content": prompt},
        ], max_tokens=1100)
        structured_trade_idea = _parse_structured_trade_idea(str(trade_idea.get("content", "")))
        event = append_journal_event("ai_trade_idea", {"request": request.model_dump(), "market": market, "trade_idea": trade_idea.get("content", ""), "structured_trade_idea": structured_trade_idea, "simulated_only": True, "live_execution": False})
        return {"market": market, "trade_idea": trade_idea, "structured_trade_idea": structured_trade_idea, "journal_event": event}

    @app.post("/api/ai/paper-trader/decision")
    def ai_paper_trader_decision(request: PaperTraderDecisionRequest) -> dict[str, Any]:
        market = _market_context(request.symbol, request.asset_type, request.exchange, request.timeframe)
        paper_account = paper_account_snapshot()
        context = build_ai_paper_trader_context(
            symbol=request.symbol,
            asset_type=market.get("asset_type", request.asset_type),
            exchange=request.exchange,
            active_timeframe=request.timeframe,
            timeframes=request.timeframes,
            profile=request.profile,
            mode=request.mode,
            market=market,
            chart_context=request.chart_context,
            paper_account=paper_account,
            open_orders=list_paper_orders(50),
            recent_fills=list_paper_fills(50),
            risk=request.risk,
        )
        ai_response = _call_lmstudio(ai_paper_trader_prompt(context), max_tokens=1000)
        parsed_decision = parse_ai_paper_trader_decision(str(ai_response.get("content", "")))
        decision = validate_ai_paper_trader_decision(parsed_decision, context)
        event = append_journal_event(
            "ai_paper_trader_decision",
            {
                "request": request.model_dump(),
                "context": context,
                "ai_response": ai_response.get("content", ""),
                "decision": decision,
                "paper_only": True,
                "live_execution": False,
                "execution_submitted": False,
            },
        )
        return {
            "context": context,
            "ai_response": ai_response,
            "decision": decision,
            "journal_event": event,
            "paper_only": True,
            "live_execution": False,
            "execution_submitted": False,
        }

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

    @app.get("/api/paper/account")
    def paper_account() -> dict[str, Any]:
        return paper_account_snapshot()

    @app.post("/api/paper/account/mark-to-market")
    def paper_account_mark_to_market(request: PaperMarksRequest) -> dict[str, Any]:
        return paper_account_snapshot(request.marks)

    @app.get("/api/paper/positions")
    def paper_positions() -> dict[str, Any]:
        snapshot = paper_account_snapshot()
        return {"positions": snapshot.get("positions", []), "account": snapshot.get("account", {})}

    @app.get("/api/paper/orders")
    def paper_orders(limit: int = 100) -> dict[str, Any]:
        return {"orders": list_paper_orders(limit)}

    @app.get("/api/paper/fills")
    def paper_fills(limit: int = 100) -> dict[str, Any]:
        return {"fills": list_paper_fills(limit)}

    @app.post("/api/paper/orders")
    def paper_order_submit(request: PaperOrderRequest) -> dict[str, Any]:
        try:
            order = submit_paper_order(request.symbol, request.side, request.quantity, request.order_type, request.asset_type, request.limit_price, request.stop_price, request.idea_id, request.notes)
        except ValueError as exc:
            return _json_error("PAPER_ORDER_REJECTED", str(exc))
        append_journal_event("paper_order_submitted", {"order": order, "simulated": True, "live_execution": False})
        return {"order": order, "account": paper_account_snapshot()}

    @app.post("/api/paper/orders/{order_id}/fill")
    def paper_order_fill(order_id: str, request: PaperFillRequest) -> dict[str, Any]:
        try:
            result = fill_paper_order(order_id, request.fill_price, request.fill_quantity, request.source)
        except ValueError as exc:
            return _json_error("PAPER_FILL_REJECTED", str(exc), order_id=order_id)
        append_journal_event("paper_order_filled", {"order_id": order_id, "fill": result.get("fill"), "simulated": True, "live_execution": False})
        return result

    @app.post("/api/paper/orders/{order_id}/cancel")
    def paper_order_cancel(order_id: str) -> dict[str, Any]:
        try:
            order = cancel_paper_order(order_id)
        except ValueError as exc:
            return _json_error("PAPER_CANCEL_REJECTED", str(exc), order_id=order_id)
        append_journal_event("paper_order_cancelled", {"order": order, "simulated": True, "live_execution": False})
        return {"order": order, "account": paper_account_snapshot()}

    @app.post("/api/paper/reset")
    def paper_reset(request: PaperResetRequest) -> dict[str, Any]:
        state = reset_paper_account(request.initial_cash, request.currency)
        snapshot = paper_account_snapshot()
        append_journal_event("paper_account_reset", {"initial_cash": request.initial_cash, "currency": request.currency, "simulated": True, "live_execution": False})
        return {"state": state, "account": snapshot}

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
