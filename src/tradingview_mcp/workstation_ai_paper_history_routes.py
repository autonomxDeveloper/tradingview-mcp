"""FastAPI route registration for read-only AI paper decision history."""
from __future__ import annotations

from typing import Any

from fastapi import FastAPI

from tradingview_mcp.core.services.ai_paper_decision_history_service import list_ai_paper_decision_history
from tradingview_mcp.workstation_ai_paper_execution_routes import WORKSTATION_APP_TITLE


def _has_route(app: FastAPI, path: str) -> bool:
    return any(getattr(route, "path", None) == path for route in app.routes)


def register_ai_paper_history_routes(app: FastAPI) -> FastAPI:
    """Register read-only AI paper decision history routes on a workstation app."""
    if _has_route(app, "/api/ai/paper-trader/decision-history"):
        return app

    @app.get("/api/ai/paper-trader/decision-history")
    def ai_paper_decision_history(
        limit: int = 100,
        symbol: str | None = None,
        include_blocked: bool = True,
        include_non_trade: bool = True,
    ) -> dict[str, Any]:
        history = list_ai_paper_decision_history(
            limit=limit,
            symbol=symbol,
            include_blocked=include_blocked,
            include_non_trade=include_non_trade,
        )
        return history

    return app


def install_ai_paper_history_route_autoregistry() -> None:
    """Install a narrow FastAPI hook for read-only decision history routes."""
    if getattr(FastAPI, "_ai_paper_history_autoregistry", False):
        return

    original_init = FastAPI.__init__

    def patched_init(self: FastAPI, *args: Any, **kwargs: Any) -> None:
        original_init(self, *args, **kwargs)
        if getattr(self, "title", "") == WORKSTATION_APP_TITLE:
            register_ai_paper_history_routes(self)

    FastAPI.__init__ = patched_init  # type: ignore[method-assign]
    FastAPI._ai_paper_history_autoregistry = True  # type: ignore[attr-defined]
