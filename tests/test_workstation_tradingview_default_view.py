from __future__ import annotations

from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
STATIC = ROOT / "src" / "tradingview_mcp" / "workstation_static"


def read_static(name: str) -> str:
    return (STATIC / name).read_text(encoding="utf-8")


def test_workstation_defaults_to_chart_first_tradingview_shell():
    index = read_static("index.html")
    css = read_static("tradingview_chart_first.css")

    for expected in [
        "tradingview-chart-first",
        "side-panels-collapsed",
        "day-mode-default",
        "chart-toolbar-clean",
    ]:
        assert expected in index
    assert '/static/tradingview_chart_first.css' in index
    assert '/static/tradingview_default_view_cleanup.css' in index
    assert 'id="symbol" value="AAPL"' in index
    assert '<option>stock</option>' in index
    assert 'id="chartGrid" class="layout-grid layout-grid-1"' in index
    assert 'id="chart"' in index

    for expected in [
        'grid-template-columns: 210px minmax(780px, 1fr) 360px',
        'grid-template-rows: 42px 42px minmax(560px, 1fr) auto 154px',
        '.center::before',
        'TradingView-style default view',
        '--tv-green: #089981',
        '--tv-red: #f23645',
        '--tv-blue: #2962ff',
        '#chart',
        '.legend',
        '.chartbar',
    ]:
        assert expected in css


def test_default_cleanup_prevents_horizontal_viewport_scrolling():
    css = read_static("tradingview_default_view_cleanup.css")

    for expected in [
        "overflow-x: hidden;",
        "grid-template-columns: 44px minmax(0, 1fr) 44px",
        "max-width: 100vw;",
        "max-width: 100%;",
        "flex-wrap: wrap;",
        "min-width: 0;",
        "body.chart-toolbar-clean #chartGrid",
    ]:
        assert expected in css

    for forbidden in [
        "overflow-x: auto",
        "overflow-x: scroll",
        "minmax(960px, 1fr)",
        "minmax(640px, 1fr)",
        "min-width: max-content",
        "flex-wrap: nowrap",
    ]:
        assert forbidden not in css


def test_chart_theme_bootstrap_loads_before_app_and_patches_lightweight_charts():
    index = read_static("index.html")
    bootstrap = read_static("tradingview_chart_theme_bootstrap.js")

    assert index.index('/static/tradingview_chart_theme_bootstrap.js') < index.index('/static/app.js')

    for expected in [
        'window.__tradingViewChartThemeBootstrap',
        'LightweightCharts.createChart',
        'background: { color: TV_BG }',
        "textColor: TV_TEXT",
        "upColor: TV_GREEN",
        "downColor: TV_RED",
        "borderUpColor: TV_GREEN",
        "borderDownColor: TV_RED",
        "wickUpColor: TV_GREEN",
        "wickDownColor: TV_RED",
        "priceLineColor: TV_BLUE",
        "rgba(41, 98, 255, 0.24)",
    ]:
        assert expected in bootstrap
