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


def test_right_dock_clicks_toggle_panel_and_stop_old_toggle_path():
    stability = read_static("right_dock_stability.js")

    for expected in [
        "function setRightPanelOpen(open)",
        "classList.toggle('research-expanded', Boolean(open))",
        "function toggleRightPanel()",
        "function handleRightDockButton(target, event)",
        "'.tradingview-right-dock-button'",
        "const wasOpen = document.body.classList.contains('research-expanded')",
        "stopLegacySidebarToggle(event);",
        "toggleRightPanel();",
        "clearActiveDockButtons();",
        "setActiveDockButton(dockButton);",
        "activateDataAction(dockButton.dataset.rightDockAction || '')",
        "target.closest('.tradingview-alerts-panel')",
        "target.closest('.tradingview-research-stack')",
        "window.setTradingViewRightPanelOpen",
    ]:
        assert expected in stability

    assert "setRightPanelOpen(true);\n      setActiveDockButton(dockButton);" not in stability
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


def test_sidebar_controller_intercepts_legacy_pointer_and_click_paths():
    stability = read_static("right_dock_stability.js")

    for expected in [
        "function stopLegacySidebarToggle(event)",
        "event.stopImmediatePropagation();",
        "function handleSidebarPointerIntent(event)",
        "function handleSidebarClick(event)",
        "document.addEventListener('pointerdown', handleSidebarPointerIntent, true);",
        "document.addEventListener('mousedown', handleSidebarPointerIntent, true);",
        "document.addEventListener('click', handleSidebarClick, true);",
        "if (action === 'watchlist' || action === 'research')",
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


def test_collapsed_sidebar_grid_states_are_explicit_and_independent():
    css = read_static("right_dock_layering.css")

    for expected in [
        "body.side-panels-collapsed main",
        "grid-template-columns: 44px minmax(0, 1fr) 44px;",
        "body.side-panels-collapsed.watchlist-expanded:not(.research-expanded) main",
        "grid-template-columns: 220px minmax(0, 1fr) 44px;",
        "body.side-panels-collapsed.research-expanded:not(.watchlist-expanded) main",
        "grid-template-columns: 44px minmax(0, 1fr) minmax(360px, 390px);",
        "body.side-panels-collapsed.watchlist-expanded.research-expanded main",
        "grid-template-columns: 220px minmax(0, 1fr) minmax(360px, 390px);",
        "body.side-panels-collapsed.watchlist-expanded aside",
        "min-width: 220px;",
        "max-width: 220px;",
    ]:
        assert expected in css
