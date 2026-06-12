"""React-backed workstation entry point.

This module keeps the existing FastAPI API surface from ``workstation_app`` and adds a
stable route for the Vite-built React workstation. During local development, run the
Vite dev server from ``frontend/workstation``; after ``npm run build``, the Python
workstation serves the packaged React assets at ``/react``.
"""
from __future__ import annotations

import argparse
import os
from pathlib import Path
from typing import Any, Literal

import uvicorn
from fastapi import Query
from fastapi.responses import FileResponse, HTMLResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from tradingview_mcp.core.services.ai_trading_session_service import (
    ai_trading_status,
    append_ai_trading_event,
    append_ai_trading_order,
    list_ai_trading_events,
    list_ai_trading_orders,
    load_ai_trading_session,
    save_ai_trading_session,
)
from tradingview_mcp.workstation_app import app


REACT_STATIC_DIR = Path(__file__).with_name("workstation_react_static")
REACT_INDEX_FILE = REACT_STATIC_DIR / "index.html"
REACT_ASSETS_DIR = REACT_STATIC_DIR / "assets"


class AiTradingSessionRequest(BaseModel):
    session_id: str = Field(default="default", min_length=1, max_length=80)
    session: dict[str, Any] = Field(default_factory=dict)


class AiTradingEventRequest(BaseModel):
    session_id: str = Field(default="default", min_length=1, max_length=80)
    level: Literal["info", "success", "warning", "error"] = "info"
    message: str = Field(..., min_length=1, max_length=500)
    payload: dict[str, Any] = Field(default_factory=dict)


class AiTradingOrderRecordRequest(BaseModel):
    session_id: str = Field(default="default", min_length=1, max_length=80)
    order: dict[str, Any] = Field(default_factory=dict)


def _missing_react_build() -> HTMLResponse:
    return HTMLResponse(
        """
        <!doctype html>
        <html lang="en">
          <head>
            <meta charset="utf-8" />
            <meta name="viewport" content="width=device-width, initial-scale=1" />
            <title>React workstation build missing</title>
            <style>
              body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #050712; color: #dbeafe; font-family: Inter, ui-sans-serif, system-ui, sans-serif; }
              main { max-width: 760px; padding: 32px; border: 1px solid rgba(148,163,184,.22); border-radius: 24px; background: rgba(15,23,42,.72); box-shadow: 0 24px 80px rgba(0,0,0,.38); }
              code { display: block; margin-top: 12px; padding: 14px 16px; border-radius: 14px; background: rgba(0,0,0,.32); color: #5eead4; }
              a { color: #67e8f9; }
            </style>
          </head>
          <body>
            <main>
              <h1>React workstation build not found</h1>
              <p>The Python workstation is wired for the React app, but the Vite production build has not been generated yet.</p>
              <code>cd frontend/workstation<br />npm install<br />npm run build</code>
              <p>For hot reload development, run <code>npm run dev</code> and open the Vite URL directly.</p>
            </main>
          </body>
        </html>
        """.strip(),
        status_code=503,
    )


@app.get("/api/ai-trading/status")
def ai_trading_backend_status() -> dict[str, Any]:
    return ai_trading_status()


@app.get("/api/ai-trading/session")
def ai_trading_session_load(session_id: str = Query(default="default", min_length=1, max_length=80)) -> dict[str, Any]:
    return load_ai_trading_session(session_id)


@app.post("/api/ai-trading/session")
def ai_trading_session_save(request: AiTradingSessionRequest) -> dict[str, Any]:
    return save_ai_trading_session(request.session, request.session_id)


@app.get("/api/ai-trading/events")
def ai_trading_events_list(session_id: str = Query(default="default", min_length=1, max_length=80), limit: int = 100) -> dict[str, Any]:
    return {"events": list_ai_trading_events(session_id, limit), "paper_only": True, "live_execution": False}


@app.post("/api/ai-trading/events")
def ai_trading_event_append(request: AiTradingEventRequest) -> dict[str, Any]:
    return {"event": append_ai_trading_event(request.session_id, request.level, request.message, request.payload)}


@app.get("/api/ai-trading/orders")
def ai_trading_orders_list(session_id: str = Query(default="default", min_length=1, max_length=80), limit: int = 100) -> dict[str, Any]:
    return {"orders": list_ai_trading_orders(session_id, limit), "paper_only": True, "live_execution": False}


@app.post("/api/ai-trading/orders")
def ai_trading_order_append(request: AiTradingOrderRecordRequest) -> dict[str, Any]:
    return {"order": append_ai_trading_order(request.session_id, request.order)}


if REACT_ASSETS_DIR.exists():
    app.mount("/react/assets", StaticFiles(directory=str(REACT_ASSETS_DIR)), name="workstation-react-assets")


# Serve built React/Vite assets for the workstation UI.
# Serve built React/Vite assets for the workstation UI.
app.mount("/assets", StaticFiles(directory=r"F:/LLM/tradingview-mcp/src/tradingview_mcp/workstation_react_static/assets"), name="workstation-assets")
@app.get("/react", include_in_schema=False, response_model=None)
# Serve built React/Vite assets for the workstation UI.
@app.get("/react/", include_in_schema=False, response_model=None)
def react_index() -> FileResponse | HTMLResponse:
    if REACT_INDEX_FILE.exists():
        return FileResponse(REACT_INDEX_FILE)
    return _missing_react_build()


# Serve built React/Vite assets for the workstation UI.
@app.get("/react/{path:path}", include_in_schema=False, response_model=None)
def react_spa_fallback(path: str) -> FileResponse | HTMLResponse:
    # Let direct built-file requests resolve when Vite emits non-asset root files.
    candidate = (REACT_STATIC_DIR / path).resolve()
    try:
        candidate.relative_to(REACT_STATIC_DIR.resolve())
    except ValueError:
        candidate = REACT_INDEX_FILE
    if candidate.is_file():
        return FileResponse(candidate)
    if REACT_INDEX_FILE.exists():
        return FileResponse(REACT_INDEX_FILE)
    return _missing_react_build()


# Serve built React/Vite assets for the workstation UI.
@app.get("/api/react-workstation/status")
def react_workstation_status() -> dict[str, Any]:
    return {
        "available": REACT_INDEX_FILE.exists(),
        "react_static_dir": str(REACT_STATIC_DIR),
        "react_index_file": str(REACT_INDEX_FILE),
        "assets_dir": str(REACT_ASSETS_DIR),
        "assets_available": REACT_ASSETS_DIR.exists(),
        "route": "/react",
        "dev_server": "http://127.0.0.1:5173",
        "ai_trading": ai_trading_status(),
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Local trading research workstation")
    parser.add_argument("--host", default=os.environ.get("TRADING_WORKSTATION_HOST", "127.0.0.1"))
    parser.add_argument("--port", type=int, default=int(os.environ.get("TRADING_WORKSTATION_PORT", "8088")))
    parser.add_argument("--reload", action="store_true")
    args = parser.parse_args()
    uvicorn.run("tradingview_mcp.workstation_react_app:app", host=args.host, port=args.port, reload=args.reload)


if __name__ == "__main__":
    main()
