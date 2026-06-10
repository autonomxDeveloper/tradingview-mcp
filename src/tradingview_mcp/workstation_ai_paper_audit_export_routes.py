"""FastAPI route registration for read-only AI paper audit exports."""
from __future__ import annotations

from typing import Any

from fastapi import FastAPI
from pydantic import BaseModel, Field

from tradingview_mcp.core.services.ai_paper_audit_export_service import build_ai_paper_audit_export
from tradingview_mcp.core.services.ai_paper_review_packet_service import build_ai_paper_review_packet
from tradingview_mcp.workstation_ai_paper_execution_routes import WORKSTATION_APP_TITLE


class PaperAuditExportRequest(BaseModel):
    packet: dict[str, Any] = Field(default_factory=dict)
    export_format: str = "json"
    name: str | None = None
    limit: int = 100
    symbol: str | None = None
    include_blocked: bool = True
    include_non_trade: bool = True
    replay: dict[str, Any] | list[dict[str, Any]] = Field(default_factory=dict)
    marks_by_symbol: dict[str, list[dict[str, Any]]] = Field(default_factory=dict)
    groups: list[str] = Field(default_factory=lambda: ["symbol", "action", "side", "confidence", "exit_reason", "outcome"])
    include_decisions: bool = True
    include_replay_records: bool = True


def _has_route(app: FastAPI, path: str) -> bool:
    return any(getattr(route, "path", None) == path for route in app.routes)


def register_ai_paper_audit_export_routes(app: FastAPI) -> FastAPI:
    """Register read-only AI paper audit export routes on a workstation app."""
    if _has_route(app, "/api/ai/paper-trader/audit-export"):
        return app

    @app.post("/api/ai/paper-trader/audit-export")
    def ai_paper_audit_export(request: PaperAuditExportRequest) -> dict[str, Any]:
        packet = request.packet or build_ai_paper_review_packet(
            limit=request.limit,
            symbol=request.symbol,
            include_blocked=request.include_blocked,
            include_non_trade=request.include_non_trade,
            replay=request.replay,
            marks_by_symbol=request.marks_by_symbol,
            groups=request.groups,
            include_decisions=request.include_decisions,
            include_replay_records=request.include_replay_records,
        )
        return build_ai_paper_audit_export(packet, export_format=request.export_format, name=request.name)

    return app


def install_ai_paper_audit_export_route_autoregistry() -> None:
    """Install a narrow FastAPI hook for read-only AI paper audit export routes."""
    if getattr(FastAPI, "_ai_paper_audit_export_autoregistry", False):
        return

    original_init = FastAPI.__init__

    def patched_init(self: FastAPI, *args: Any, **kwargs: Any) -> None:
        original_init(self, *args, **kwargs)
        if getattr(self, "title", "") == WORKSTATION_APP_TITLE:
            register_ai_paper_audit_export_routes(self)

    FastAPI.__init__ = patched_init  # type: ignore[method-assign]
    FastAPI._ai_paper_audit_export_autoregistry = True  # type: ignore[attr-defined]
