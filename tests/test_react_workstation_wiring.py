from __future__ import annotations

from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def read_repo_file(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def test_workstation_script_points_to_react_entrypoint_and_keeps_legacy_alias():
    pyproject = read_repo_file("pyproject.toml")

    assert 'tradingview-workstation = "tradingview_mcp.workstation_react_app:main"' in pyproject
    assert 'tradingview-workstation-legacy = "tradingview_mcp.workstation_app:main"' in pyproject
    assert 'workstation_react_static/*.html' in pyproject
    assert 'workstation_react_static/assets/*' in pyproject


def test_react_entrypoint_preserves_api_and_serves_react_route():
    module = read_repo_file("src/tradingview_mcp/workstation_react_app.py")

    for expected in [
        "from tradingview_mcp.workstation_app import app",
        'app.mount("/react/assets"',
        '@app.get("/react"',
        '@app.get("/react/{path:path}"',
        '@app.get("/api/react-workstation/status")',
        'uvicorn.run("tradingview_mcp.workstation_react_app:app"',
        "React workstation build not found",
    ]:
        assert expected in module


def test_vite_build_outputs_to_packaged_react_static_directory():
    vite_config = read_repo_file("frontend/workstation/vite.config.ts")

    assert "outDir: '../../src/tradingview_mcp/workstation_react_static'" in vite_config
    assert "'/api': 'http://127.0.0.1:8088'" in vite_config
