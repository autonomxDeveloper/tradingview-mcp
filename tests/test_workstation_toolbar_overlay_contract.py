from __future__ import annotations

from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
STATIC = ROOT / "src" / "tradingview_mcp" / "workstation_static"
CSS = STATIC / "tradingview_default_view_cleanup.css"


def test_collapsed_side_panels_do_not_expand_or_capture_toolbar_clicks_by_default():
    css = CSS.read_text(encoding="utf-8")

    for expected in [
        "body.side-panels-collapsed aside,",
        "body.side-panels-collapsed .right",
        "overflow: hidden !important;",
        "contain: layout paint;",
        "body.side-panels-collapsed aside > *",
        "body.side-panels-collapsed .right > *",
        "display: none !important;",
        "pointer-events: none;",
        "body.side-panels-collapsed main:has(> aside:hover)",
        "body.side-panels-collapsed main:has(> .right:hover)",
        "grid-template-columns: 44px minmax(0, 1fr) 44px;",
        "body.side-panels-collapsed aside:hover > *",
        "body.side-panels-collapsed .right:hover > *",
    ]:
        assert expected in css


def test_chart_toolbar_layers_above_collapsed_side_rails():
    css = CSS.read_text(encoding="utf-8")

    side_panel_rule = css.split("body.side-panels-collapsed aside,")[1].split("}", 1)[0]
    center_rule = css.split("body.chart-toolbar-clean .center")[1].split("}", 1)[0]
    topbar_rule = css.split("body.chart-toolbar-clean .topbar")[1].split("}", 1)[0]
    chartbar_rule = css.split("body.chart-toolbar-clean .chartbar")[1].split("}", 1)[0]

    assert "z-index: 4;" in side_panel_rule
    assert "z-index: 10;" in center_rule
    assert "z-index: 60;" in topbar_rule
    assert "z-index: 55;" in chartbar_rule
    assert "overflow-x: hidden;" in topbar_rule
    assert "overflow-y: visible;" in topbar_rule
    assert "flex-wrap: wrap;" in topbar_rule
    assert "overflow-x: hidden;" in chartbar_rule
    assert "overflow-y: visible;" in chartbar_rule
    assert "flex-wrap: wrap;" in chartbar_rule
