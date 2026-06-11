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


def test_base_markup_renders_compact_toolbar_before_dynamic_modules():
    html = read_static("index.html")

    for expected in [
        "top-toolbar-integrated",
        "compact-market-toolbar",
        "id=\"compactTradingTopToolbar\"",
        "data-compact-timeframe=\"2h\"",
        "data-compact-timeframe=\"2W\"",
        "data-compact-timeframe=\"1D\"",
        ">Indicators</button>",
        ">Alert</button>",
        ">Replay</button>",
        "data-action=\"market.load\"",
        "data-action=\"analysis.run\"",
        "<script src=\"/static/top_toolbar_side_panel_module.js\"></script>",
    ]:
        assert expected in html


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
        "bindCompactToolbar",
        "data-compact-timeframe",
    ]:
        assert expected in module


def test_compact_top_toolbar_forces_visibility_when_chart_overlays_row():
    module = read_static("top_toolbar_side_panel_module.js")

    for expected in [
        "forceCompactToolbarVisible",
        "topbar.style.setProperty('display', 'flex', 'important')",
        "topbar.style.setProperty('position', 'sticky', 'important')",
        "topbar.style.setProperty('z-index', '500', 'important')",
        "control.style.setProperty('pointer-events', 'auto', 'important')",
        "window.requestAnimationFrame(installCompactTopToolbar)",
        "appendCoreToolbarItems(compact, topbar)",
        "makeSymbolInput",
        "makeTimeframeSelect",
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
