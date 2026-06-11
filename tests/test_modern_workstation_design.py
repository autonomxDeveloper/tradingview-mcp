from __future__ import annotations

from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
STATIC = ROOT / "src" / "tradingview_mcp" / "workstation_static"


def read_static(name: str) -> str:
    return (STATIC / name).read_text(encoding="utf-8")


def test_modern_workstation_skin_uses_professional_design_tokens():
    css = read_static("tradingview_chart_first.css")

    for expected in [
        "Modern professional TradingView-style workstation skin",
        "--tv-app: #f8fafc",
        "--tv-blue: #2962ff",
        "--tv-card-shadow",
        "--tv-radius-lg",
        "font-family: Inter, ui-sans-serif",
        "backdrop-filter: blur(14px)",
    ]:
        assert expected in css


def test_modern_workstation_prioritizes_chart_first_layout():
    css = read_static("tradingview_chart_first.css")

    for expected in [
        "grid-template-rows: 44px minmax(0, 1fr) auto 118px",
        "body.tradingview-chart-first .chartbar {",
        "display: none !important;",
        "body.tradingview-chart-first .layout-grid",
        "border-radius: var(--tv-radius-lg)",
        "box-shadow: var(--tv-shadow)",
        "body.tradingview-chart-first .center::before",
        "content: none !important",
    ]:
        assert expected in css


def test_modern_workstation_makes_top_toolbar_and_panels_cleaner():
    css = read_static("tradingview_chart_first.css")

    for expected in [
        "body.tradingview-chart-first .topbar,",
        "position: sticky !important",
        "z-index: 500 !important",
        "body.tradingview-chart-first #compactTradingTopToolbar",
        "border-radius: 999px",
        "body.tradingview-chart-first .right .panel",
        "background: rgba(255, 255, 255, .96) !important",
        "body.tradingview-chart-first .workflow-list button",
    ]:
        assert expected in css
