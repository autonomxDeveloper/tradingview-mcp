"""FastAPI route registration for read-only AI paper strategy evaluation bundles."""
from __future__ import annotations

from typing import Any

from fastapi import FastAPI
from pydantic import BaseModel, Field

from tradingview_mcp.core.services.ai_paper_strategy_evaluation_service import evaluate_ai_paper_strategy_packets
from tradingview_mcp.workstation_ai_paper_execution_routes import WORKSTATION_APP_TITLE


class PaperStrategyEvaluationRequest(BaseModel):
    packets: list[dict[str, Any]] = Field(default_factory=list)
    groups: list[str] = Field(default_factory=lambda: ["strategy", "symbol", "timeframe", "profile"])


def _has_route(app: FastAPI, path: str) -> bool:
    return any(getattr(route, "path", None) == path for route in app.routes)


def register_ai_paper_strategy_evaluation_routes(app: FastAPI) -> FastAPI:
    """Register read-only AI paper strategy evaluation routes on a workstation app."""
    if _has_route(app, "/api/ai/paper-trader/strategy-evaluation"):
        return app

    @app.post("/api/ai/paper-trader/strategy-evaluation")
    def ai_paper_strategy_evaluation(request: PaperStrategyEvaluationRequest) -> dict[str, Any]:
        return evaluate_ai_paper_strategy_packets(request.packets, groups=request.groups)

    return app


def install_ai_paper_strategy_evaluation_route_autoregistry() -> None:
    """Install a narrow FastAPI hook for read-only AI paper strategy evaluation routes."""
    if getattr(FastAPI, "_ai_paper_strategy_evaluation_autoregistry", False):
        return

    original_init = FastAPI.__init__

    def patched_init(self: FastAPI, *args: Any, **kwargs: Any) -> None:
        original_init(self, *args, **kwargs)
        if getattr(self, "title", "") == WORKSTATION_APP_TITLE:
            register_ai_paper_strategy_evaluation_routes(self)

    FastAPI.__init__ = patched_init  # type: ignore[method-assign]
    FastAPI._ai_paper_strategy_evaluation_autoregistry = True  # type: ignore[attr-defined]
