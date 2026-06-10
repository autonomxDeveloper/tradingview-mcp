from __future__ import annotations

from fastapi import FastAPI
from fastapi.testclient import TestClient

from tradingview_mcp.workstation_ai_paper_execution_routes import WORKSTATION_APP_TITLE, install_ai_paper_execution_route_autoregistry
from tradingview_mcp.workstation_app import create_app


def _route_paths(app: FastAPI) -> list[str]:
    return [getattr(route, "path", "") for route in app.routes]


def test_default_workstation_app_exposes_ai_paper_execution_route():
    app = create_app()

    assert "/api/ai/paper-trader/execute" in _route_paths(app)

    response = TestClient(app).post("/api/ai/paper-trader/execute", json={"symbol": "AAPL", "decision": {}})
    payload = response.json()

    assert response.status_code == 200
    assert payload["error"]["code"] == "AI_PAPER_EXECUTION_REJECTED"
    assert payload["error"]["paper_only"] is True
    assert payload["error"]["live_execution"] is False


def test_route_autoregistry_is_title_scoped_and_idempotent():
    install_ai_paper_execution_route_autoregistry()
    other_app = FastAPI(title="Other App")
    workstation_app = FastAPI(title=WORKSTATION_APP_TITLE)
    workstation_app_again = FastAPI(title=WORKSTATION_APP_TITLE)

    assert "/api/ai/paper-trader/execute" not in _route_paths(other_app)
    assert "/api/ai/paper-trader/execute" in _route_paths(workstation_app)
    assert "/api/ai/paper-trader/execute" in _route_paths(workstation_app_again)
    assert _route_paths(workstation_app).count("/api/ai/paper-trader/execute") == 1
