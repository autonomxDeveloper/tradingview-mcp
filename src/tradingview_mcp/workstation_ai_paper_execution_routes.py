"""FastAPI route registration for AI paper-trader paper-only execution and schedules.

This module intentionally contains small route wrappers around paper-only AI
paper-trader helpers. It does not call live broker APIs.
"""
from __future__ import annotations

from typing import Any, Literal

from fastapi import FastAPI
from pydantic import BaseModel, Field

from tradingview_mcp.core.services.ai_market_context_service import build_multi_timeframe_market_context
from tradingview_mcp.core.services.ai_paper_trader_execution_service import execute_ai_paper_trader_decision
from tradingview_mcp.core.services.ai_paper_trader_schedule_service import (
    ai_paper_schedule_status,
    build_ai_paper_schedule_run_request,
    create_ai_paper_schedule,
    delete_ai_paper_schedule,
    due_ai_paper_schedules,
    get_ai_paper_schedule,
    list_ai_paper_schedules,
    record_ai_paper_schedule_run,
    update_ai_paper_schedule,
)
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


class PaperTraderScheduleRequest(BaseModel):
    name: str = "AI paper schedule"
    enabled: bool = True
    symbols: list[str] = Field(default_factory=list)
    asset_type: Literal["stock", "crypto", "other"] = "stock"
    exchange: str = "NASDAQ"
    timeframe: str = "5m"
    timeframes: list[str] = Field(default_factory=lambda: ["5m", "15m", "1h", "1D"])
    profile: str = "intraday_paper"
    mode: str = "paper_trader_scheduled_decision"
    trigger: dict[str, Any] = Field(default_factory=lambda: {"type": "manual"})
    risk: dict[str, Any] = Field(default_factory=dict)
    execution: dict[str, Any] = Field(default_factory=dict)


class PaperTraderScheduleRunRecordRequest(BaseModel):
    result: dict[str, Any] = Field(default_factory=dict)


class MultiTimeframeContextRequest(BaseModel):
    symbol: str = Field(..., min_length=1, max_length=32)
    asset_type: Literal["stock", "crypto", "other"] = "stock"
    exchange: str = "NASDAQ"
    timeframes: list[str] = Field(default_factory=lambda: ["5m", "15m", "1h", "1D"])
    limit: int = Field(default=120, ge=20, le=300)


def _json_error(code: str, message: str, **extra: Any) -> dict[str, Any]:
    payload: dict[str, Any] = {"error": {"code": code, "message": message}}
    payload["error"].update(extra)
    return payload


def _has_route(app: FastAPI, path: str) -> bool:
    return any(getattr(route, "path", None) == path for route in app.routes)


def register_ai_paper_execution_routes(app: FastAPI) -> FastAPI:
    """Register explicit paper-only execution routes on a workstation app."""
    if not _has_route(app, "/api/ai/paper-trader/execute"):
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

    if not _has_route(app, "/api/ai/market-context"):
        @app.post("/api/ai/market-context")
        def ai_multi_timeframe_market_context(request: MultiTimeframeContextRequest) -> dict[str, Any]:
            context = build_multi_timeframe_market_context(
                symbol=request.symbol,
                asset_type=request.asset_type,
                exchange=request.exchange,
                timeframes=request.timeframes,
                limit=request.limit,
            )
            event = append_journal_event(
                "ai_multi_timeframe_market_context",
                {"request": request.model_dump(), "summary": context.get("summary", {}), "paper_only": True, "live_execution": False},
            )
            return {"context": context, "journal_event": event, "paper_only": True, "live_execution": False}

    if not _has_route(app, "/api/ai/paper-trader/schedules"):
        @app.get("/api/ai/paper-trader/schedules")
        def ai_paper_schedules_list() -> dict[str, Any]:
            return {"schedules": list_ai_paper_schedules(), "status": ai_paper_schedule_status()}

        @app.post("/api/ai/paper-trader/schedules")
        def ai_paper_schedules_create(request: PaperTraderScheduleRequest) -> dict[str, Any]:
            schedule = create_ai_paper_schedule(request.model_dump())
            event = append_journal_event("ai_paper_trader_schedule_created", {"schedule": schedule, "paper_only": True, "live_execution": False})
            return {"schedule": schedule, "journal_event": event, "paper_only": True, "live_execution": False}

        @app.post("/api/ai/paper-trader/schedules/{schedule_id}")
        def ai_paper_schedules_update(schedule_id: str, request: PaperTraderScheduleRequest) -> dict[str, Any]:
            try:
                schedule = update_ai_paper_schedule(schedule_id, request.model_dump())
            except ValueError as exc:
                return _json_error("AI_PAPER_SCHEDULE_NOT_FOUND", str(exc), schedule_id=schedule_id)
            event = append_journal_event("ai_paper_trader_schedule_updated", {"schedule": schedule, "paper_only": True, "live_execution": False})
            return {"schedule": schedule, "journal_event": event, "paper_only": True, "live_execution": False}

        @app.delete("/api/ai/paper-trader/schedules/{schedule_id}")
        def ai_paper_schedules_delete(schedule_id: str) -> dict[str, Any]:
            try:
                result = delete_ai_paper_schedule(schedule_id)
            except ValueError as exc:
                return _json_error("AI_PAPER_SCHEDULE_NOT_FOUND", str(exc), schedule_id=schedule_id)
            event = append_journal_event("ai_paper_trader_schedule_deleted", result)
            return {"result": result, "journal_event": event, "paper_only": True, "live_execution": False}

        @app.get("/api/ai/paper-trader/schedules/due")
        def ai_paper_schedules_due() -> dict[str, Any]:
            return {"due": due_ai_paper_schedules(), "paper_only": True, "live_execution": False, "background_loop_enabled": False}

        @app.post("/api/ai/paper-trader/schedules/{schedule_id}/run-request")
        def ai_paper_schedules_run_request(schedule_id: str, symbol: str | None = None) -> dict[str, Any]:
            schedule = get_ai_paper_schedule(schedule_id)
            if not schedule:
                return _json_error("AI_PAPER_SCHEDULE_NOT_FOUND", "AI paper schedule not found", schedule_id=schedule_id)
            request = build_ai_paper_schedule_run_request(schedule, symbol=symbol)
            event = append_journal_event("ai_paper_trader_schedule_run_requested", {"schedule_id": schedule_id, "request": request, "paper_only": True, "live_execution": False})
            return {"schedule": schedule, "decision_request": request, "journal_event": event, "paper_only": True, "live_execution": False, "background_loop_enabled": False}

        @app.post("/api/ai/paper-trader/schedules/{schedule_id}/record-run")
        def ai_paper_schedules_record_run(schedule_id: str, request: PaperTraderScheduleRunRecordRequest) -> dict[str, Any]:
            try:
                schedule = record_ai_paper_schedule_run(schedule_id, request.result)
            except ValueError as exc:
                return _json_error("AI_PAPER_SCHEDULE_NOT_FOUND", str(exc), schedule_id=schedule_id)
            event = append_journal_event("ai_paper_trader_schedule_run_recorded", {"schedule_id": schedule_id, "result": request.result, "paper_only": True, "live_execution": False})
            return {"schedule": schedule, "journal_event": event, "paper_only": True, "live_execution": False}

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
