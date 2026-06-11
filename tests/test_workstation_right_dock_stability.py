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


def test_left_and_right_sidebars_preserve_independent_state():
    stability = read_static("right_dock_stability.js")

    for expected in [
        "function setWatchlistPanelOpen(open)",
        "function toggleWatchlistPanel()",
        "function toggleRightPanel()",
        "function handleIndependentSidebarToggle(target, event)",
        "const preserveRightPanel = document.body.classList.contains('research-expanded')",
        "const preserveWatchlistPanel = document.body.classList.contains('watchlist-expanded')",
        "document.body.classList.toggle('research-expanded', preserveRightPanel)",
        "document.body.classList.toggle('watchlist-expanded', preserveWatchlistPanel)",
        "chartAction === 'watchlist' || chromeAction === 'watchlist'",
        "chartAction === 'research' || chromeAction === 'research'",
        "window.setTradingViewWatchlistPanelOpen",
    ]:
        assert expected in stability


def test_right_dock_layering_stylesheet_is_loaded_by_stability_layer():
    stability = read_static("right_dock_stability.js")

    for expected in [
        "function installLayeringStylesheet()",
        "rightDockLayeringStylesheet",
        "link.rel = 'stylesheet'",
        "link.href = '/static/right_dock_layering.css'",
        "window.installRightDockLayeringStylesheet",
    ]:
        assert expected in stability


def test_right_dock_layering_css_unclamps_expanded_panel_above_chart_controls():
    css = read_static("right_dock_layering.css")

    for expected in [
        "body.side-panels-collapsed.research-expanded .right.tradingview-right-panel",
        "min-width: 360px;",
        "max-width: 390px;",
        "z-index: 140;",
        "isolation: isolate;",
        "body.side-panels-collapsed.research-expanded .right.tradingview-right-panel::before",
        "display: none !important;",
        "body.side-panels-collapsed.research-expanded .center",
        "z-index: 1;",
        "body.side-panels-collapsed.research-expanded .stream-status",
    ]:
        assert expected in css
