from __future__ import annotations

from typing import Any

from tradingview_mcp.core.services import workstation_chart_service as charts


class FakeYahooNoDataResponse:
    status_code = 200
    text = '{"chart":{"result":[]}}'

    def json(self) -> dict[str, Any]:
        return {"chart": {"result": []}}


class FakeStooqCsvResponse:
    status_code = 200
    text = "\n".join(
        [
            "Date,Open,High,Low,Close,Volume",
            "2024-01-02,470.00,472.10,468.50,471.20,1000000",
            "2024-01-03,471.20,475.00,470.10,474.50,1200000",
            "2024-01-04,474.50,476.00,472.00,473.00,900000",
        ]
    )

    def json(self) -> dict[str, Any]:
        raise ValueError("CSV response")


def test_spy_daily_chart_falls_back_to_stooq_when_yahoo_has_no_data(monkeypatch, tmp_path):
    calls: list[str] = []

    def fake_get(url: str, **kwargs: Any):
        calls.append(url)
        if "query1.finance.yahoo.com" in url:
            return FakeYahooNoDataResponse()
        if "stooq.com" in url:
            assert kwargs["params"] == {"s": "spy.us", "i": "d"}
            return FakeStooqCsvResponse()
        raise AssertionError(f"unexpected URL: {url}")

    monkeypatch.setattr(charts.requests, "get", fake_get)
    monkeypatch.setattr(charts, "write_cache", lambda _key, payload, source="": payload)
    monkeypatch.setattr(charts, "fallback_from_cache", lambda _key, payload: payload)

    payload = charts.get_yahoo_chart("SPY", "1D", 2)

    assert calls == [
        "https://query1.finance.yahoo.com/v8/finance/chart/SPY",
        "https://stooq.com/q/d/l/",
    ]
    assert payload["symbol"] == "SPY"
    assert payload["source"] == "stooq_daily_csv"
    assert payload["fallback_from"] == "NO_CHART_DATA"
    assert payload["timeframe"] == "1D"
    assert payload["interval"] == "1d"
    assert len(payload["candles"]) == 2
    assert payload["candles"][0]["close"] == 474.5
    assert payload["candles"][1]["close"] == 473.0


def test_stooq_fallback_does_not_override_intraday_errors(monkeypatch):
    def fake_get(url: str, **_kwargs: Any):
        assert "query1.finance.yahoo.com" in url
        return FakeYahooNoDataResponse()

    monkeypatch.setattr(charts.requests, "get", fake_get)
    monkeypatch.setattr(charts, "fallback_from_cache", lambda _key, payload: payload)

    payload = charts.get_yahoo_chart("SPY", "1h", 20)

    assert payload["error"]["code"] == "NO_CHART_DATA"
