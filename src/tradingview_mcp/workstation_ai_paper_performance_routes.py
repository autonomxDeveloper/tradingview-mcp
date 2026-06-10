"""FastAPI route registration for read-only AI paper performance summaries."""
from __future__ import annotations

from typing import Any

from fastapi import FastAPI
from pydantic import BaseModel, Field

from tradingview_mcp.core.services.ai_paper_performance_service import summarize_ai_paper_performance
from tradingview_mcp.workstation_ai_paper_execution_routes import WORKSTATION_APP_TITLE


class PaperPerformanceRequest(BaseModel):
    replay: dict[str, Any] | list[dict[str, Any]] = Field(default_factory=dict)
    decision_history: list[dict[str, Any]] = Field(default_factory=list)
    groups: list[str] = Field(default_factory=lambda: ["symbol", "action", "side", "confidence", "exit_reason"])


def _has_route(app: FastAPI, path: str) -> bool:
    return any(getattr(route, "path", None) == path for route in app.routes)


def register_ai_paper_performance_routes(app: FastAPI) -> FastAPI:
    """Register read-only AI paper performance routes on a workstation app."""
    if _has_route(app, "/api/ai/paper-trader/performance"):
        return app

    @app.post("/api/ai/paper-trader/performance")
    def ai_paper_performance(request: PaperPerformanceRequest) -> dict[str, Any]:
        return summarize_ai_paper_performance(
            request.replay,
            decision_history=request.decision_history,
            groups=request.groups,
        )

    return app


def install_ai_paper_performance_route_autoregistry() -> None:
    """Install a narrow FastAPI hook for read-only AI paper performance routes."""
    if getattr(FastAPI, "_ai_paper_performance_autoregistry", False):
        return

    original_init = FastAPI.__init__

    def patched_init(self: FastAPI, *args: Any, **kwargs: Any) -> None:
        original_init(self, *args, **kwargs)
        if getattr(self, "title", "") == WORKSTATION_APP_TITLE:
            register_ai_paper_performance_routes(self)

    FastAPI.__init__ = patched_init  # type: ignore[method-assign]
    FastAPI._ai_paper_performance_autoregistry = True  # type: ignore[attr-defined]
