from __future__ import annotations

from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
STATIC = ROOT / "src" / "tradingview_mcp" / "workstation_static"


def read_static(name: str) -> str:
    return (STATIC / name).read_text(encoding="utf-8")


def test_right_dock_stability_loads_after_chrome_controls():
    index = read_static("index.html")

    assert "/static/workstation_chrome_controls.js" in index
    assert "/static/right_dock_stability.js" in index
    assert index.index("/static/workstation_chrome_controls.js") < index.index("/static/right_dock_stability.js")


def test_right_dock_clicks_open_idempotently_and_stop_old_toggle_path():
    stability = read_static("right_dock_stability.js")

    for expected in [
        "function setRightPanelOpen(open)",
        "classList.toggle('research-expanded', Boolean(open))",
        "'.tradingview-right-dock-button'",
        "event.stopImmediatePropagation();",
        "setRightPanelOpen(true);",
        "setActiveDockButton(dockButton);",
        "target.closest('.tradingview-alerts-panel')",
        "target.closest('.tradingview-research-stack')",
        "window.setTradingViewRightPanelOpen",
    ]:
        assert expected in stability

    assert "classList.toggle('research-expanded')" not in stability
