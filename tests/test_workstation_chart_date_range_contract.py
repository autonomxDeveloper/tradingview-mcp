from __future__ import annotations

from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
STATIC = ROOT / "src" / "tradingview_mcp" / "workstation_static"


def read_static(name: str) -> str:
    return (STATIC / name).read_text(encoding="utf-8")


def test_chart_date_range_bar_is_in_default_shell():
    index = read_static("index.html")
    css = read_static("chart_date_range.css")

    assert '/static/chart_date_range.css' in index
    assert 'id="dateRangeBar"' in index
    assert 'id="dateRangeSummary"' in index
    for range_label in ["5D", "1M", "3M", "6M", "YTD", "1Y", "5Y", "All"]:
        assert f'data-chart-range="{range_label}"' in index

    for expected in [
        ".chart-date-range-bar",
        ".chart-date-range-buttons",
        ".chart-date-range-summary",
        "text-overflow: ellipsis",
        "white-space: nowrap",
    ]:
        assert expected in css


def test_app_updates_loaded_history_bounds_and_range_buttons():
    app = read_static("app.js")

    for expected in [
        "initDateRangeBar();",
        "function updateDateRangeBar()",
        "function setChartRange(range)",
        "data-chart-range",
        "first_bar: currentBars[0] || null",
        "bars_count: currentBars.length",
        "history: historyMetadata()",
        "marketCandleLimit(timeframe, isCrypto)",
        "limit=${candleLimit}",
    ]:
        assert expected in app

    assert "&limit=300" not in app
