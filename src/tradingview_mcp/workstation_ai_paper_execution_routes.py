"""FastAPI route registration for AI paper-trader paper-only execution.

This module intentionally contains only a small route wrapper around the
paper-only execution adapter. It does not call live broker APIs.
"""
from __future__ import annotations

from typing import Any, Literal

from fastapi import FastAPI
from pydantic import BaseModel, Field

from tradingview_mcp.core.services.ai_paper_trader_execution_service import execute_ai_paper_trader_decision
from tradingview_mcp.core.services.workstation_journal_service import append_journal_event

WORKSTATION_APP_TITLE = "Autonomx Trading Research Workstation"


class PaperTraderExecuteRequest(BaseModel):
    """Explicit paper-only execution request for a validated AI decision."""

    symbol: str = Field(..., min_length=1, max_length=32)
    asset_type: Literal["stock", "crypto", "other"] = "stock"
    decision: dict[str, Any] = Field(default_factory=dict)
    idea_id: str | None = None
    notes: str = "AI paper-trader explicit execution request"
    fill_market_orders: bool = False
    fill_price: float | None = Field(default=None, gt=0)
    cancel_open_orders_on_no_trade: bool = False


def _json_error(code: str, message: str, **extra: Any) -> dict[str, Any]:
    payload: dict[str, Any] = {"error": {"code": code, "message": message}}
    payload["error"].update(extra)
    return payload


def _has_route(app: FastAPI, path: str) -> bool:
    return any(getattr(route, "path", None) == path for route in app.routes)


def register_ai_paper_execution_routes(app: FastAPI) -> FastAPI:
    """Register explicit paper-only execution routes on a workstation app."""
    if _has_route(app, "/api/ai/paper-trader/execute"):
        return app

    @app.post("/api/ai/paper-trader/execute")
    def ai_paper_trader_execute(request: PaperTraderExecuteRequest) -> dict[str, Any]:
        decision = request.decision or {}
        if not decision:
            return _json_error("AI_PAPER_EXECUTION_REJECTED", "decision payload is required", paper_only=True, live_execution=False)
        result = execute_ai_paper_trader_decision(
            decision,
            symbol=request.symbol,
            asset_type=request.asset_type,
            idea_id=request.idea_id,
            notes=request.notes,
            fill_market_orders=request.fill_market_orders,
            fill_price=request.fill_price,
            cancel_open_orders_on_no_trade=request.cancel_open_orders_on_no_trade,
        )
        event = append_journal_event(
            "ai_paper_trader_execution",
            {
                "request": request.model_dump(),
                "result": result,
                "paper_only": True,
                "live_execution": False,
                "execution_submitted": bool(result.get("execution_submitted")),
            },
        )
        return {
            "result": result,
            "journal_event": event,
            "paper_only": True,
            "live_execution": False,
            "execution_submitted": bool(result.get("execution_submitted")),
        }

    return app


def install_ai_paper_execution_route_autoregistry() -> None:
    """Install a narrow FastAPI hook for the workstation app title.

    This avoids editing the large workstation_app.py file while keeping activation
    constrained to the local research workstation. Other FastAPI apps are left
    untouched unless they use the exact workstation title.
    """
    if getattr(FastAPI, "_ai_paper_execution_autoregistry", False):
        return

    original_init = FastAPI.__init__

    def patched_init(self: FastAPI, *args: Any, **kwargs: Any) -> None:
        original_init(self, *args, **kwargs)
        if getattr(self, "title", "") == WORKSTATION_APP_TITLE:
            register_ai_paper_execution_routes(self)

    FastAPI.__init__ = patched_init  # type: ignore[method-assign]
    FastAPI._ai_paper_execution_autoregistry = True  # type: ignore[attr-defined]
