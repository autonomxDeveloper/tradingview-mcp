"""Local browser workstation for charting, research, backtests, ideas, and LM Studio analysis.

The workstation is research-only. It does not submit or simulate broker actions.
"""
from __future__ import annotations

import argparse
import os
from typing import Any, Literal

import requests
import uvicorn
from fastapi import FastAPI, Query
from fastapi.responses import HTMLResponse
from pydantic import BaseModel, Field

from tradingview_mcp.core.services.alpaca_service import (
    get_alpaca_account,
    get_alpaca_positions,
    get_alpaca_safety_status,
    get_alpaca_stock_bars,
    get_alpaca_stock_quote,
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
)
from tradingview_mcp.core.services.screener_service import analyze_coin
from tradingview_mcp.core.services.workstation_chart_service import get_yahoo_chart
from tradingview_mcp.core.services.workstation_journal_service import (
    append_journal_event,
    read_journal_events,
    workstation_status,
)
from tradingview_mcp.core.services.yahoo_finance_service import get_price
from tradingview_mcp.core.utils.validators import normalize_yahoo_symbol, sanitize_exchange, sanitize_timeframe


DEFAULT_WATCHLIST = ["AAPL", "NVDA", "TSLA", "SPY", "QQQ", "BTCUSDT", "ETHUSDT", "SOLUSDT"]


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


class JournalRequest(BaseModel):
    event_type: str = "research_note"
    payload: dict[str, Any]


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
    items = [item.strip().upper() for item in raw.split(",") if item.strip()]
    return items or DEFAULT_WATCHLIST


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
        response = requests.post(
            f"{_lmstudio_base_url()}/chat/completions",
            json=body,
            timeout=float(os.environ.get("LMSTUDIO_TIMEOUT_SECONDS", "120")),
        )
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


def _is_crypto_symbol(symbol: str, asset_type: str = "auto") -> bool:
    clean = symbol.upper()
    return asset_type == "crypto" or clean.endswith(("USDT", "USDC", "-USD", "/USD")) or clean in {"BTC", "ETH", "SOL"}


def _stock_yahoo_symbol(symbol: str) -> str:
    return normalize_yahoo_symbol(symbol.strip().upper())


def create_app() -> FastAPI:
    app = FastAPI(title="Autonomx Trading Research Workstation", version="1.1.0")

    @app.get("/", response_class=HTMLResponse)
    def index() -> str:
        return INDEX_HTML

    @app.get("/api/health")
    def health() -> dict[str, Any]:
        return {
            "ok": True,
            "lmstudio_base_url": _lmstudio_base_url(),
            "lmstudio_model": _lmstudio_model(),
            "watchlist": _watchlist(),
            "crypto_venues": sorted(SUPPORTED_CRYPTO_VENUES),
            "alpaca": get_alpaca_safety_status(),
            "workstation": workstation_status(),
            "ideas": idea_registry_status(),
        }

    @app.get("/api/watchlist")
    def watchlist() -> dict[str, Any]:
        return {"symbols": _watchlist()}

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
            "Give observations, hypotheses, invalidation levels, risks, and backtest ideas.\n\n"
            f"Market context:\n{market}\n\nUser question: {request.question}"
        )
        analysis = _call_lmstudio([
            {"role": "system", "content": "You analyze stocks and crypto with risk-first language."},
            {"role": "user", "content": prompt},
        ])
        event = append_journal_event("ai_analysis", {"request": request.model_dump(), "market": market, "analysis": analysis.get("content", "")})
        return {"market": market, "analysis": analysis, "journal_event": event}

    @app.post("/api/backtest/run")
    def backtest_run(request: BacktestRequest) -> dict[str, Any]:
        append_journal_event("backtest_run_requested", request.model_dump())
        return run_backtest(
            request.symbol,
            request.strategy,
            request.period,
            request.initial_capital,
            request.commission_pct,
            request.slippage_pct,
            request.interval,
            request.include_trade_log,
            request.include_equity_curve,
        )

    @app.get("/api/backtest/compare")
    def backtest_compare(symbol: str, period: str = "1y", initial_capital: float = 10000.0, interval: str = "1d") -> dict[str, Any]:
        append_journal_event("backtest_compare_requested", {"symbol": symbol, "period": period, "interval": interval})
        return compare_backtest_strategies(symbol, period, initial_capital, interval=interval)

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


INDEX_HTML = """<!doctype html><html><head><meta charset='utf-8' /><meta name='viewport' content='width=device-width, initial-scale=1' /><title>Autonomx Trading Research Workstation</title><script src='https://unpkg.com/lightweight-charts@4.2.3/dist/lightweight-charts.standalone.production.js'></script><style>body{margin:0;background:#0b1020;color:#e5e7eb;font-family:system-ui,Segoe UI,sans-serif}header{padding:10px 14px;border-bottom:1px solid #263044;background:#080d18;display:flex;justify-content:space-between}main{display:grid;grid-template-columns:210px 1fr 430px;height:calc(100vh - 43px)}aside,section{border-right:1px solid #263044;min-width:0;overflow:auto}aside{padding:12px;background:#111827}.center{display:grid;grid-template-rows:auto 1fr 210px}.right{display:grid;grid-template-rows:auto 1fr;border-right:0}.bar{display:flex;gap:8px;flex-wrap:wrap;padding:10px;background:#131c2f;border-bottom:1px solid #263044}input,select,textarea,button{background:#0b1220;color:#e5e7eb;border:1px solid #334155;border-radius:7px;padding:7px;font:inherit}button{background:#1d4ed8;cursor:pointer;font-weight:600}button.secondary{background:#111827}.watch button{display:block;width:100%;text-align:left;margin:0 0 6px;background:#0b1220}.watch button.active{border-color:#60a5fa}#chart{height:100%;width:100%}.bottom,.panel{padding:10px;background:#080d18;border-top:1px solid #263044}.right .panel{border-top:0;border-bottom:1px solid #263044;background:#131c2f}textarea{width:100%;min-height:80px}.tabs{display:flex;gap:6px;margin-bottom:8px}.tabs button{font-size:12px}pre{white-space:pre-wrap;word-break:break-word;margin:0;font-size:12px;line-height:1.45}.muted{color:#94a3b8;font-size:12px}.label{font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:.06em;margin:10px 0 6px}</style></head><body><header><b>Autonomx Trading Research Workstation</b><span id='status' class='muted'>loading...</span></header><main><aside><div class='label'>Watchlist</div><div class='watch' id='watch'></div><div class='label'>Status</div><pre id='risk'></pre></aside><section class='center'><div class='bar'><input id='symbol' value='AAPL'><select id='asset'><option>auto</option><option>stock</option><option>crypto</option></select><input id='exchange' value='NASDAQ'><select id='tf'><option>1m</option><option>5m</option><option>15m</option><option>1h</option><option selected>1D</option><option>1W</option></select><button onclick='loadMarket()'>Load</button><button class='secondary' onclick='analyze()'>AI analyze</button></div><div id='chart'></div><div class='bottom'><div class='tabs'><button onclick='showPayload()'>Payload</button><button onclick='runBacktest()'>Backtest</button><button onclick='compareStrategies()'>Compare</button><button onclick='saveIdea()'>Save idea</button><button onclick='loadIdeas()'>Ideas</button><button onclick='loadJournal()'>Journal</button></div><pre id='output'>Ready.</pre></div></section><section class='right'><div class='panel'><div class='label'>AI question</div><textarea id='question'>Give observations, risks, invalidation levels, and what to backtest next. Do not recommend taking a position.</textarea><button onclick='analyze()'>Analyze current symbol</button><div class='label'>Research idea</div><input id='hypothesis' style='width:100%' placeholder='Hypothesis'><input id='invalidation' style='width:100%;margin-top:6px' placeholder='Invalidation'><input id='backtestPlan' style='width:100%;margin-top:6px' placeholder='Backtest plan'><div class='label'>Backtest</div><select id='strategy'><option>ema_cross</option><option>rsi</option><option>bollinger</option><option>macd</option><option>supertrend</option><option>donchian</option><option>rsi_pullback</option><option>keltner_breakout</option><option>triple_ema</option></select><select id='period'><option>1mo</option><option>3mo</option><option>6mo</option><option selected>1y</option><option>2y</option></select></div><div class='panel' style='overflow:auto'><div class='label'>AI / results</div><pre id='analysis'>Start LM Studio and use Analyze.</pre></div></section></main><script>let chart,candles,volume,lastPayload=null;function $(id){return document.getElementById(id)}async function api(url,opts={}){const r=await fetch(url,opts);if(!r.ok)throw new Error(r.status+' '+r.statusText);return r.json()}function post(url,body){return api(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)})}function print(x,target='output'){$(target).textContent=typeof x==='string'?x:JSON.stringify(x,null,2)}function initChart(){chart=LightweightCharts.createChart($('chart'),{layout:{background:{color:'#0b1020'},textColor:'#d1d5db'},grid:{vertLines:{color:'#1f2937'},horzLines:{color:'#1f2937'}}});candles=chart.addCandlestickSeries();volume=chart.addHistogramSeries({priceFormat:{type:'volume'},priceScaleId:''});volume.priceScale().applyOptions({scaleMargins:{top:.82,bottom:0}});window.onresize=()=>chart.resize($('chart').clientWidth,$('chart').clientHeight)}async function boot(){initChart();const h=await api('/api/health');$('status').textContent='LM Studio '+h.lmstudio_base_url;print({workstation:h.workstation,ideas:h.ideas},'risk');const w=await api('/api/watchlist');$('watch').innerHTML='';w.symbols.forEach(s=>{const b=document.createElement('button');b.textContent=s;b.onclick=()=>{$('symbol').value=s;if(s.includes('USDT')){$('asset').value='crypto';$('exchange').value='BINANCE'}else{$('asset').value='stock';$('exchange').value='NASDAQ'}loadMarket()};$('watch').appendChild(b)});loadMarket()}function activeIsCrypto(){const s=$('symbol').value.toUpperCase();return $('asset').value==='crypto'||s.endsWith('USDT')||s.endsWith('-USD')}async function loadMarket(){const s=$('symbol').value.trim(),tf=$('tf').value;if(activeIsCrypto()){lastPayload=await api(`/api/crypto/candles?symbol=${encodeURIComponent(s)}&venue=binance&interval=${encodeURIComponent(tf.toLowerCase())}&limit=300`);const bars=(lastPayload.bars||[]).map(b=>({time:b.open_time?Math.floor(b.open_time/1000):b.time,open:+b.open,high:+b.high,low:+b.low,close:+b.close,volume:+b.volume}));candles.setData(bars);volume.setData(bars.map(b=>({time:b.time,value:b.volume})))}else{lastPayload=await api(`/api/stock/yahoo-chart?symbol=${encodeURIComponent(s)}&timeframe=${encodeURIComponent(tf)}&limit=300`);let bars=(lastPayload.candles||[]).map(b=>({time:b.time,open:+b.open,high:+b.high,low:+b.low,close:+b.close,volume:+b.volume}));candles.setData(bars);volume.setData(bars.map(b=>({time:b.time,value:b.volume})))}chart.timeScale().fitContent();print(lastPayload)}async function analyze(){print('Analyzing...','analysis');const res=await post('/api/ai/analyze',{symbol:$('symbol').value,asset_type:$('asset').value,exchange:$('exchange').value,timeframe:$('tf').value,question:$('question').value});print(res.analysis?.content||res,'analysis')}async function runBacktest(){const res=await post('/api/backtest/run',{symbol:$('symbol').value,strategy:$('strategy').value,period:$('period').value,include_trade_log:true,include_equity_curve:true});print(res)}async function compareStrategies(){print(await api(`/api/backtest/compare?symbol=${encodeURIComponent($('symbol').value)}&period=${$('period').value}`))}async function saveIdea(){const body={symbol:$('symbol').value,asset_type:activeIsCrypto()?'crypto':'stock',timeframe:$('tf').value,bias:'unknown',hypothesis:$('hypothesis').value,invalidation:$('invalidation').value,backtest_plan:$('backtestPlan').value,source:'workstation'};print(await post('/api/ideas',body))}async function loadIdeas(){print(await api('/api/ideas?limit=100'))}function showPayload(){print(lastPayload||'No payload')}async function loadJournal(){print(await api('/api/journal?limit=100'))}boot().catch(e=>print(e.message))</script></body></html>"""


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
