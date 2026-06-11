from __future__ import annotations

from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
STATIC = ROOT / "src" / "tradingview_mcp" / "workstation_static"


def read_static(name: str) -> str:
    return (STATIC / name).read_text(encoding="utf-8")


def test_default_view_loads_cleanup_styles_and_default_classes():
    index = read_static("index.html")

    assert "tradingview_chart_first.css" in index
    assert "tradingview_default_view_cleanup.css" in index
    assert index.index("tradingview_chart_first.css") < index.index("tradingview_default_view_cleanup.css")
    for expected in [
        "tradingview-chart-first",
        "side-panels-collapsed",
        "day-mode-default",
        "chart-toolbar-clean",
        'value="AAPL"',
        '<option selected>1D</option>',
        "Loading AAPL chart",
    ]:
        assert expected in index


def test_default_view_cleanup_css_declares_collapsed_day_chart_layout():
    css = read_static("tradingview_default_view_cleanup.css")

    for expected in [
        "body.day-mode-default",
        "color-scheme: light",
        "body.side-panels-collapsed main",
        "grid-template-columns",
        "Watchlist",
        "Research",
        "main:has(> aside:hover)",
        "main:has(> .right:hover)",
        "body.chart-toolbar-clean .drawing-controls",
        "body.chart-toolbar-clean .layout-controls",
        "display: none !important",
        "body.chart-toolbar-clean #chartGrid",
        "min-height: 640px",
    ]:
        assert expected in css


def test_default_view_keeps_toolbar_controls_and_chart_refresh_helper():
    index = read_static("index.html")
    app = read_static("app.js")

    for expected in ["SMA 20", "Volume", "Auto-fit", "drawing-controls", "layout-controls", "metadata-controls"]:
        assert expected in index

    for expected in [
        "await loadMarket();",
        "scheduleChartSurfaceRefresh();",
        "function resizePrimaryChartToSurface()",
        "window.requestAnimationFrame",
        "chart.resize($('chart').clientWidth, $('chart').clientHeight)",
    ]:
        assert expected in app
