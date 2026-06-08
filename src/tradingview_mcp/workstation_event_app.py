"""Composable FastAPI app factory for the local research event inbox."""
from __future__ import annotations

from fastapi import FastAPI

from tradingview_mcp.workstation_app import create_app
from tradingview_mcp.workstation_event_routes import register_research_event_routes


def create_event_enabled_app() -> FastAPI:
    """Return the workstation app with the research event routes registered.

    This helper keeps the route composition outside ``workstation_app.py`` so the
    endpoint contract can be smoke-tested while direct app inclusion is pending.
    """
    app = create_app()
    register_research_event_routes(app)
    return app
