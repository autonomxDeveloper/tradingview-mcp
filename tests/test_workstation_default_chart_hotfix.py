from __future__ import annotations

from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
STATIC = ROOT / "src" / "tradingview_mcp" / "workstation_static"


def read_static(name: str) -> str:
    return (STATIC / name).read_text(encoding="utf-8")


def test_default_chart_uses_stock_source_contract_and_fallback():
    index = read_static("index.html")
    app = read_static("app.js")

    assert 'id="symbol" value="AAPL"' in index
    assert '<option>stock</option>' in index
    assert 'data-default-asset="stock"' in index
    assert 'id="tf" aria-label="Timeframe"' in index
    assert '<option selected>1D</option>' in index
    assert "await loadDefaultChart();" in app
    assert "async function loadDefaultChart()" in app
    assert "$('asset').value = 'stock';" in app
    assert "$('symbol').value = 'AAPL';" in app
    assert "DEFAULT_CHART_LOAD_FAILED" in app
    assert "/api/stock/yahoo-chart" in app


def test_chart_toolbar_cleanup_does_not_clip_primary_controls():
    css = read_static("tradingview_default_view_cleanup.css")

    for expected in [
        "body.chart-toolbar-clean .topbar",
        "overflow: visible;",
        "position: relative;",
        "z-index: 35;",
        "body.chart-toolbar-clean .chartbar",
        "overflow-x: auto;",
        "overflow-y: visible;",
        "min-width: max-content;",
    ]:
        assert expected in css

    assert "body.chart-toolbar-clean .drawing-controls" in css
    assert "body.chart-toolbar-clean .layout-controls" in css
