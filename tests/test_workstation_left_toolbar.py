from __future__ import annotations

from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
STATIC = ROOT / "src" / "tradingview_mcp" / "workstation_static"


def read_static(name: str) -> str:
    return (STATIC / name).read_text(encoding="utf-8")


def test_left_toolbar_assets_are_loaded_by_stability_layer():
    stability = read_static("right_dock_stability.js")

    for expected in [
        "function installLeftToolbarEnhancement()",
        "tradingViewLeftToolsStylesheet",
        "link.href = '/static/tradingview_left_tools.css'",
        "tradingViewLeftToolsScript",
        "script.src = '/static/tradingview_left_tools.js'",
        "window.installTradingViewLeftToolbarEnhancement",
    ]:
        assert expected in stability


def test_left_toolbar_replaces_decorative_pseudo_rail_with_real_toolbar():
    css = read_static("tradingview_left_tools.css")

    for expected in [
        "body.tradingview-chart-first .center::before",
        "display: none !important;",
        "--tv-left-toolbar-left: 0px;",
        "--tv-left-toolbar-width: 47px;",
        "body.tradingview-chart-first #chartToolRail.chart-tool-rail",
        "position: fixed;",
        "left: var(--tv-left-toolbar-left, 0px);",
        "z-index: 520;",
        "isolation: isolate;",
        "body.tradingview-chart-first .chart-tool-menu",
        "left: calc(var(--tv-left-toolbar-left, 0px) + var(--tv-left-toolbar-width, 47px));",
        "z-index: 540;",
    ]:
        assert expected in css


def test_left_toolbar_has_tradingview_style_groups_and_suboptions():
    js = read_static("tradingview_left_tools.js")

    for expected in [
        "const TOOL_GROUPS = [",
        "label: 'Lines'",
        "label: 'Trendline'",
        "label: 'Ray'",
        "label: 'Info line'",
        "label: 'Extended line'",
        "label: 'Trend angle'",
        "label: 'Horizontal line'",
        "label: 'Horizontal ray'",
        "label: 'Vertical line'",
        "label: 'Crossline'",
        "label: 'Channels'",
        "label: 'Parallel channel'",
        "label: 'Regression trend'",
        "label: 'Flat top/bottom'",
        "label: 'Pitchforks'",
        "label: 'Schiff pitchfork'",
        "label: 'Gann and Fibonacci'",
        "label: 'Geometry'",
        "label: 'Text and notes'",
        "label: 'Measure and zoom'",
    ]:
        assert expected in js


def test_left_toolbar_clicks_open_menu_and_keep_chart_surface_clean():
    js = read_static("tradingview_left_tools.js")

    for expected in [
        "function showMenu(group, trigger)",
        "menu.hidden = false;",
        "positionMenuForButton(menu, trigger);",
        "className = 'chart-tool-button has-submenu'",
        "button.setAttribute('aria-haspopup', 'menu');",
        "button.dataset.chartToolAction = group.id;",
        "document.body.append(rail, menu, status);",
        "document.body.classList.add('tradingview-left-toolbar-enhanced');",
        "if (target.closest('#chartToolRail') || target.closest('#chartToolMenu')) return;",
    ]:
        assert expected in js


def test_left_toolbar_tracks_watchlist_edge_outside_sidebar_stacking_context():
    js = read_static("tradingview_left_tools.js")

    for expected in [
        "function getLeftPanelRightEdge(centerRect)",
        "document.body.classList.contains('watchlist-expanded')",
        "panel.getBoundingClientRect()",
        "return Math.max(rightEdge, rect.right);",
        "function syncToolbarGeometry()",
        "rootStyle.setProperty('--tv-left-toolbar-left'",
        "installGeometryObservers()",
        "new ResizeObserver(scheduleSync)",
        "new MutationObserver(scheduleSync)",
    ]:
        assert expected in js
