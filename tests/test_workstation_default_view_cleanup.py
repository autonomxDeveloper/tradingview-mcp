from __future__ import annotations

from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
STATIC = ROOT / "src" / "tradingview_mcp" / "workstation_static"


def read_static(name: str) -> str:
    return (STATIC / name).read_text(encoding="utf-8")


def test_default_view_loads_cleanup_styles_after_chart_first_styles():
    index = read_static("index.html")

    assert "tradingview_chart_first.css" in index
    assert "tradingview_default_view_cleanup.css" in index
    assert index.index("tradingview_chart_first.css") < index.index("tradingview_default_view_cleanup.css")
    assert 'body class="tradingview-chart-first side-panels-collapsed day-mode-default chart-toolbar-clean"' in index
    assert 'value="AAPL"' in index
    assert '<option selected>1D</option>' in index
    assert "Loading AAPL chart" in index


def test_default_view_collapses_side_panels_and_uses_day_mode():
    css = read_static("tradingview_default_view_cleanup.css")

    for expected in [
        "body.day-mode-default",
        "color-scheme: light",
        "body.side-panels-collapsed main",
        "grid-template-columns: 44px minmax(960px, 1fr) 44px",
        "content: \"Watchlist\"",
        "content: \"Research\"",
        "main:has(> aside:hover)",
        "main:has(> .right:hover)",
    ]:
        assert expected in css


def test_default_view_cleans_chart_toolbar_without_removing_controls():
    index = read_static("index.html")
    css = read_static("tradingview_default_view_cleanup.css")

    for expected in [
        "chart-toolbar-clean",
        "drawing-controls",
        "layout-controls",
        "metadata-controls",
        "SMA 20",
        "Volume",
        "Auto-fit",
    ]:
        assert expected in index

    assert "body.chart-toolbar-clean .drawing-controls" in css
    assert "display: none !important" in css
    assert "body.chart-toolbar-clean .layout-controls" in css
    assert "body.chart-toolbar-clean .chartbar" in css
    assert "min-height: 36px" in css


def test_default_chart_load_is_awaited_and_resized_after_layout_settles():
    app = read_static("app.js")

    for expected in [
        "await loadMarket();",
        "scheduleChartSurfaceRefresh();",
        "function resizePrimaryChartToSurface()",
        "window.requestAnimationFrame",
        "window.setTimeout(resizePrimaryChartToSurface, 80)",
        "window.setTimeout(resizePrimaryChartToSurface, 250)",
        "chart.resize($('chart').clientWidth, $('chart').clientHeight)",
    ]:
        assert expected in app

    assert "loadMarket();\n}" not in app
