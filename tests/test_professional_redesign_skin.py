from __future__ import annotations

from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
STATIC = ROOT / "src" / "tradingview_mcp" / "workstation_static"


def read_static(name: str) -> str:
    return (STATIC / name).read_text(encoding="utf-8")


def test_professional_redesign_skin_loads_last_in_existing_stylesheet():
    css = read_static("chart_date_range.css")

    for expected in [
        "Phase 2 professional workstation redesign",
        "--pro-bg: #060b16",
        "radial-gradient(circle at 12% 0%",
        "grid-template-columns: 58px minmax(0, 1fr) 58px",
        "grid-template-rows: 56px minmax(0, 1fr) 38px 128px",
        "compact-market-toolbar",
        "backdrop-filter: blur(20px) saturate(1.25)",
        "#chartWrap",
        "border-radius: 24px",
        "body.tradingview-chart-first .bottom",
        "body.tradingview-chart-first .result-tabs button.active-result-tab",
    ]:
        assert expected in css


def test_professional_redesign_changes_the_old_blue_pill_surface():
    css = read_static("chart_date_range.css")

    assert "background: linear-gradient(135deg, var(--pro-blue), #7c3aed)" in css
    assert "background: rgba(8, 13, 24, .92) !important" in css
    assert "box-shadow: 0 -22px 80px rgba(0, 0, 0, .30)" in css
