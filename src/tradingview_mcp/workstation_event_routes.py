"""Route registration for the local research event inbox."""
from __future__ import annotations

from typing import Any

from fastapi import FastAPI
from pydantic import BaseModel, Field

from tradingview_mcp.core.services.research_event_service import create_research_event, list_research_events, research_event_status


class ResearchEventRequest(BaseModel):
    source: str = "manual"
    symbol: str = ""
    timeframe: str = ""
    kind: str = "research_event"
    message: str = ""
    metadata: dict[str, Any] = Field(default_factory=dict)


def register_research_event_routes(app: FastAPI) -> None:
    @app.get("/api/events/status")
    def events_status() -> dict[str, Any]:
        return research_event_status()

    @app.post("/api/events")
    def events_create(request: ResearchEventRequest) -> dict[str, Any]:
        return create_research_event(request.model_dump())

    @app.get("/api/events")
    def events_list(symbol: str | None = None, limit: int = 100) -> dict[str, Any]:
        return {"events": list_research_events(symbol=symbol, limit=limit)}
