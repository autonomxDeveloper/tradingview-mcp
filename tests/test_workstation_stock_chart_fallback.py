from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any

from tradingview_mcp.core.services import workstation_chart_service as charts


class FakeYahooNoDataResponse:
    status_code = 200
    text = '{"chart":{"result":[]}}'

    def json(self) -> dict[str, Any]:
        return {"chart": {"result": []}}


class FakeYahooEdgeResponse:
    status_code = 200
    text = "Edge: Too Many Requests"

    def json(self) -> dict[str, Any]:
        raise ValueError("not json")


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


class FakeStooqEdgeResponse:
    status_code = 200
    text = "Edge: Too Many Requests"

    def json(self) -> dict[str, Any]:
        raise ValueError("edge response")


class FakeRow(dict):
    pass


class FakeHistoryFrame:
    empty = False

    def iterrows(self):
        return iter(
            [
                (
                    datetime(2024, 1, 2, tzinfo=timezone.utc),
                    FakeRow({"Open": 470.0, "High": 472.1, "Low": 468.5, "Close": 471.2, "Volume": 1000000}),
                ),
                (
                    datetime(2024, 1, 3, tzinfo=timezone.utc),
                    FakeRow({"Open": 471.2, "High": 475.0, "Low": 470.1, "Close": 474.5, "Volume": 1200000}),
                ),
                (
                    datetime(2024, 1, 4, tzinfo=timezone.utc),
                    FakeRow({"Open": 474.5, "High": 476.0, "Low": 472.0, "Close": 473.0, "Volume": 900000}),
                ),
            ]
        )


class LongFakeHistoryFrame:
    empty = False

    def iterrows(self):
        base = datetime(2018, 1, 2, tzinfo=timezone.utc)
        for index in range(2200):
            price = 250.0 + index
            yield (
                base + timedelta(days=index),
                FakeRow({"Open": price, "High": price + 1.0, "Low": price - 1.0, "Close": price + 0.5, "Volume": 1000000 + index}),
            )


class FakeYfinanceTicker:
    fast_info = {"currency": "USD", "exchange": "PCX", "last_price": 473.0, "previous_close": 474.5}

    def __init__(self, symbol: str):
        self.symbol = symbol
        self.calls: list[dict[str, Any]] = []

    def history(self, **kwargs: Any) -> FakeHistoryFrame:
        self.calls.append(kwargs)
        assert kwargs["period"] == "10y"
        assert kwargs["interval"] == "1d"
        assert kwargs["auto_adjust"] is False
        assert kwargs["prepost"] is True
        assert kwargs["actions"] is False
        return FakeHistoryFrame()


class LongFakeYfinanceTicker(FakeYfinanceTicker):
    def history(self, **kwargs: Any) -> LongFakeHistoryFrame:
        self.calls.append(kwargs)
        assert kwargs["period"] == "10y"
        assert kwargs["interval"] == "1d"
        return LongFakeHistoryFrame()


class FakeYfinanceModule:
    def __init__(self, ticker_cls=FakeYfinanceTicker):
        self.ticker_cls = ticker_cls
        self.tickers: list[FakeYfinanceTicker] = []

    def Ticker(self, symbol: str) -> FakeYfinanceTicker:
        ticker = self.ticker_cls(symbol)
        self.tickers.append(ticker)
        return ticker


class EmptyYfinanceFrame:
    empty = True


class EmptyYfinanceTicker:
    fast_info = {}

    def __init__(self, symbol: str):
        self.symbol = symbol

    def history(self, **_kwargs: Any) -> EmptyYfinanceFrame:
        return EmptyYfinanceFrame()


class EmptyYfinanceModule:
    def Ticker(self, symbol: str) -> EmptyYfinanceTicker:
        return EmptyYfinanceTicker(symbol)


def test_spy_daily_chart_uses_yfinance_primary_provider(monkeypatch):
    fake_yfinance = FakeYfinanceModule()
    monkeypatch.setattr(charts, "yf", fake_yfinance)
    monkeypatch.setattr(charts, "write_cache", lambda _key, payload, source="": payload)

    payload = charts.get_yahoo_chart("SPY", "1D", 2)

    assert fake_yfinance.tickers[0].symbol == "SPY"
    assert payload["symbol"] == "SPY"
    assert payload["source"] == "yfinance_chart"
    assert payload["exchange"] == "PCX"
    assert payload["currency"] == "USD"
    assert len(payload["candles"]) == 3
    assert payload["candles"][0]["close"] == 471.2
    assert payload["candles"][2]["close"] == 473.0


def test_spy_daily_chart_expands_to_multi_year_history(monkeypatch):
    fake_yfinance = FakeYfinanceModule(LongFakeYfinanceTicker)
    monkeypatch.setattr(charts, "yf", fake_yfinance)
    monkeypatch.setattr(charts, "write_cache", lambda _key, payload, source="": payload)

    payload = charts.get_yahoo_chart("SPY", "1D", 500)

    assert fake_yfinance.tickers[0].calls[0]["period"] == "10y"
    assert payload["range"] == "10y"
    assert payload["interval"] == "1d"
    assert len(payload["candles"]) == charts.FULL_DAILY_STOCK_HISTORY_LIMIT
    assert payload["candles"][0]["time"] < payload["candles"][-1]["time"]


def test_spy_daily_chart_falls_back_to_stooq_when_yahoo_has_no_data(monkeypatch, tmp_path):
    calls: list[str] = []

    def fake_get(url: str, **kwargs: Any):
        calls.append(url)
        assert "headers" in kwargs
        assert "Mozilla/5.0" in kwargs["headers"]["User-Agent"]
        if "query1.finance.yahoo.com" in url:
            return FakeYahooNoDataResponse()
        if "stooq.com" in url:
            assert kwargs["params"] == {"s": "spy.us", "i": "d"}
            return FakeStooqCsvResponse()
        raise AssertionError(f"unexpected URL: {url}")

    monkeypatch.setattr(charts, "yf", EmptyYfinanceModule())
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
    assert len(payload["candles"]) == 3
    assert payload["candles"][0]["close"] == 471.2
    assert payload["candles"][2]["close"] == 473.0


def test_spy_daily_chart_falls_back_to_stooq_when_yahoo_edge_rate_limits(monkeypatch):
    def fake_get(url: str, **kwargs: Any):
        assert "headers" in kwargs
        if "query1.finance.yahoo.com" in url:
            return FakeYahooEdgeResponse()
        if "stooq.com" in url:
            assert kwargs["params"] == {"s": "spy.us", "i": "d"}
            return FakeStooqCsvResponse()
        raise AssertionError(f"unexpected URL: {url}")

    monkeypatch.setattr(charts, "yf", EmptyYfinanceModule())
    monkeypatch.setattr(charts.requests, "get", fake_get)
    monkeypatch.setattr(charts, "write_cache", lambda _key, payload, source="": payload)
    monkeypatch.setattr(charts, "fallback_from_cache", lambda _key, payload: payload)

    payload = charts.get_yahoo_chart("SPY", "1D", 2)

    assert payload["source"] == "stooq_daily_csv"
    assert payload["fallback_from"] == "INVALID_RESPONSE"
    assert len(payload["candles"]) == 3


def test_stooq_provider_error_text_is_not_parsed_as_candles(monkeypatch):
    def fake_get(url: str, **_kwargs: Any):
        if "query1.finance.yahoo.com" in url:
            return FakeYahooEdgeResponse()
        if "stooq.com" in url:
            return FakeStooqEdgeResponse()
        raise AssertionError(f"unexpected URL: {url}")

    monkeypatch.setattr(charts, "yf", EmptyYfinanceModule())
    monkeypatch.setattr(charts.requests, "get", fake_get)
    monkeypatch.setattr(charts, "fallback_from_cache", lambda _key, payload: payload)

    payload = charts.get_yahoo_chart("SPY", "1D", 20)

    assert payload["error"]["code"] == "INVALID_RESPONSE"
    assert "Edge: Too Many Requests" in payload["error"]["message"]


def test_stooq_fallback_does_not_override_intraday_errors(monkeypatch):
    def fake_get(url: str, **_kwargs: Any):
        assert "query1.finance.yahoo.com" in url
        return FakeYahooNoDataResponse()

    monkeypatch.setattr(charts, "yf", EmptyYfinanceModule())
    monkeypatch.setattr(charts.requests, "get", fake_get)
    monkeypatch.setattr(charts, "fallback_from_cache", lambda _key, payload: payload)

    payload = charts.get_yahoo_chart("SPY", "1h", 20)

    assert payload["error"]["code"] == "NO_CHART_DATA"
