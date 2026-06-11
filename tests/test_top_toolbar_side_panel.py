from __future__ import annotations

from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
STATIC = ROOT / "src" / "tradingview_mcp" / "workstation_static"


def read_static(name: str) -> str:
    return (STATIC / name).read_text(encoding="utf-8")


def test_module_registry_loads_compact_top_toolbar_side_panel_module():
    registry = read_static("module_registry.js")

    assert "topToolbarSidePanel" in registry
    assert "file: 'top_toolbar_side_panel_module.js'" in registry
    assert "loadModuleScript('topToolbarSidePanelScript', '/static/top_toolbar_side_panel_module.js');" in registry


def test_compact_top_toolbar_keeps_only_tradingview_like_controls_visible():
    module = read_static("top_toolbar_side_panel_module.js")

    for expected in [
        "compactTradingTopToolbar",
        "top-toolbar-integrated",
        "top-tools-collapsed",
        "Indicators",
        "Alert",
        "Replay",
        "↶",
        "↷",
        "#compactTradingTopToolbar #symbol",
        "body.top-toolbar-integrated .topbar > :not(#compactTradingTopToolbar)",
    ]:
        assert expected in module


def test_chart_tools_are_moved_from_upper_toolbar_to_right_sidebar_panel():
    module = read_static("top_toolbar_side_panel_module.js")

    for expected in [
        "moveChartToolsToSidePanel",
        "const chartbar = document.querySelector('.chartbar');",
        "side-chart-tools-panel",
        "Chart tools",
        "Indicators · drawings · layout",
        "stack.prepend(panel)",
        "chart-tools-in-side-panel",
        "body.chart-tools-in-side-panel .side-chart-tools-panel .chartbar .toolbar-section",
    ]:
        assert expected in module
