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
        "top-tools-collapsed",
    ]:
        assert expected in index
    assert '/static/tradingview_chart_first.css' in index
    assert '/static/tradingview_default_view_cleanup.css' in index
    assert '/static/workstation_chrome_controls.js' in index
    assert 'id="symbol" value="BTCUSDT"' in index
    assert '<option>stock</option>' in index
    assert '<option selected>crypto</option>' in index
    assert 'id="exchange" value="BINANCE"' in index
    assert 'BTCUSDT · 1D · chart tools hidden' in index
    assert 'Loading BTCUSDT chart…' in index
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


def test_default_cleanup_contains_viewport_fit_overrides():
    css = read_static("tradingview_default_view_cleanup.css")

    for expected in [
        "grid-template-columns: 44px minmax(0, 1fr) 44px",
        "body.chart-toolbar-clean .topbar",
        "body.chart-toolbar-clean .chartbar",
        "overflow-x: hidden;",
        "flex-wrap: wrap;",
        "body.chart-toolbar-clean #chartGrid",
    ]:
        assert expected in css

    assert "minmax(960px, 1fr)" not in css
    assert "minmax(640px, 1fr)" not in css


def test_collapsible_chrome_has_clickable_top_and_side_controls():
    index = read_static("index.html")
    css = read_static("tradingview_default_view_cleanup.css")
    chrome = read_static("workstation_chrome_controls.js")

    for expected in [
        'data-chrome-toggle="top-tools"',
        'data-chrome-toggle="watchlist"',
        'data-chrome-toggle="research"',
        'class="panel-rail-toggle watchlist-rail-toggle"',
        'class="panel-rail-toggle research-rail-toggle"',
        'id="topToolbarSummary"',
    ]:
        assert expected in index

    assert index.index('/static/app.js') < index.index('/static/workstation_chrome_controls.js')

    for expected in [
        'body.top-tools-collapsed .topbar > :not(.chrome-toolbar-toggle):not(#topToolbarSummary)',
        'body.side-panels-collapsed.watchlist-expanded main',
        'body.side-panels-collapsed.research-expanded main',
        'body.side-panels-collapsed.watchlist-expanded aside > *',
        'body.side-panels-collapsed.research-expanded .right > *',
        'body.side-panels-collapsed aside > .panel-rail-toggle',
        'body.side-panels-collapsed aside,',
        'cursor: pointer;',
    ]:
        assert expected in css

    for expected in [
        "toggleTopTools",
        "toggleWorkstationPanel",
        "top-tools-collapsed",
        "watchlist-expanded",
        "research-expanded",
        "data-chrome-toggle",
        "resizePrimaryChartToSurface",
        "bindPanelSurfaceClicks",
        "chromeSurfaceBound",
    ]:
        assert expected in chrome


def test_chart_tool_rail_uses_real_clickable_buttons_not_static_decoration():
    cleanup = read_static("tradingview_default_view_cleanup.css")
    chrome = read_static("workstation_chrome_controls.js")

    for expected in [
        "CHART_TOOL_ACTIONS",
        "function installChartToolRail()",
        "id = 'chartToolRail'",
        "className = 'chart-tool-button'",
        "dataset.chartToolAction",
        "activateChartTool(tool.action)",
        "showDrawingTools",
        "activateDataAction",
        "window.activateChartTool",
    ]:
        assert expected in chrome

    for expected in [
        "body.tradingview-chart-first .center::before",
        "content: none !important;",
        "body.tradingview-chart-first .chart-tool-rail",
        "body.tradingview-chart-first .chart-tool-button",
        "cursor: pointer;",
        "body.chart-toolbar-clean.drawing-tools-expanded .drawing-controls",
    ]:
        assert expected in cleanup


def test_right_panel_uses_tradingview_style_alerts_dock():
    chrome = read_static("workstation_chrome_controls.js")

    for expected in [
        "RIGHT_DOCK_ACTIONS",
        "TRADINGVIEW_ALERT_ROWS",
        "function installTradingViewRightPanel()",
        "function installTradingViewRightDockStyles()",
        "tradingview-right-panel",
        "tradingview-right-dock",
        "tradingview-right-dock-button",
        "tradingview-right-dock-badge",
        "tradingview-alerts-panel",
        "tradingview-alert-tabs",
        "tradingview-alert-action",
        "tradingview-alert-list",
        "tradingview-alert-row",
        "BTCUSDT 1D full-history loaded",
        "Log <span class=\"count\">9</span>",
        "window.installTradingViewRightPanel",
    ]:
        assert expected in chrome

    for expected in [
        "grid-template-columns: minmax(0, 1fr) 46px",
        "body.side-panels-collapsed .right.tradingview-right-panel > .tradingview-right-dock",
        "body.side-panels-collapsed:not(.research-expanded) .right.tradingview-right-panel .tradingview-alerts-panel",
        "body.side-panels-collapsed.research-expanded main",
        "background: #f5f7fb",
        "border-left: 1px solid #d7dce5",
    ]:
        assert expected in chrome


def test_chrome_defaults_crypto_daily_weekly_to_full_history_window():
    chrome = read_static("workstation_chrome_controls.js")

    for expected in [
        "FULL_CRYPTO_HISTORY_CANDLE_LIMIT = 5000",
        "function preferFullCryptoHistory()",
        "window.marketCandleLimit = function(timeframe, isCrypto)",
        "tf === '1d' || tf === '1w'",
        "return FULL_CRYPTO_HISTORY_CANDLE_LIMIT",
        "preferFullCryptoHistory();",
    ]:
        assert expected in chrome


def test_chrome_supports_tradingview_style_custom_intervals():
    chrome = read_static("workstation_chrome_controls.js")

    for expected in [
        "CUSTOM_INTERVAL_STORAGE_KEY",
        "CRYPTO_INTERVALS",
        "STOCK_INTERVALS",
        "'1s'",
        "'3m'",
        "'2h'",
        "'3D'",
        "function normalizeIntervalLabel(value)",
        "function supportedInterval(value)",
        "function openCustomIntervalPrompt()",
        "id = 'customIntervalButton'",
        "button.textContent = '+ interval'",
        "window.workstationCustomIntervals",
    ]:
        assert expected in chrome


def test_crypto_history_fetch_shim_loads_before_app_and_rewrites_daily_weekly_limits():
    index = read_static("index.html")
    shim = read_static("crypto_history_fetch_shim.js")

    assert index.index('/static/crypto_history_fetch_shim.js') < index.index('/static/app.js')

    for expected in [
        "FULL_CRYPTO_HISTORY_CANDLE_LIMIT = 5000",
        "window.fetch = function cryptoHistoryFetch(input, init)",
        "pathname !== '/api/crypto/candles'",
        "interval !== '1d' && interval !== '1w'",
        "currentLimit < FULL_CRYPTO_HISTORY_CANDLE_LIMIT",
        "url.searchParams.set('limit', String(FULL_CRYPTO_HISTORY_CANDLE_LIMIT))",
        "window.workstationCryptoHistoryFetchShim",
    ]:
        assert expected in shim


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
