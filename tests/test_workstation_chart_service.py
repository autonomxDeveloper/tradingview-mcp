from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import requests

from tradingview_mcp.core.services import workstation_chart_service


@dataclass
class _FakeResponse:
    status_code: int
    payload: Any
    text: str = ""

    def json(self) -> Any:
        return self.payload


def _chart_payload():
    return {
        "chart": {
            "result": [
                {
                    "meta": {"currency": "USD", "exchangeName": "NMS", "regularMarketPrice": 102, "chartPreviousClose": 99},
                    "timestamp": [1, 2],
                    "indicators": {
                        "quote": [
                            {
                                "open": [100, 101],
                                "high": [103, 104],
                                "low": [99, 100],
                                "close": [102, 103],
                                "volume": [1000, 1100],
                            }
                        ]
                    },
                }
            ],
            "error": None,
        }
    }


def test_chart_service_shapes_candles(monkeypatch, tmp_path):
    monkeypatch.setenv("TRADING_WORKSTATION_MARKET_CACHE", str(tmp_path / "cache"))
    monkeypatch.setattr(workstation_chart_service, "yf", None)

    def fake_get(url, params=None, timeout=None, **_kwargs):
        return _FakeResponse(200, _chart_payload())

    monkeypatch.setattr(workstation_chart_service.requests, "get", fake_get)

    result = workstation_chart_service.get_yahoo_chart("AAPL", "1D", 1)

    assert result["symbol"] == "AAPL"
    assert result["currency"] == "USD"
    assert result["candles"] == [
        {"time": 2, "open": 101.0, "high": 104.0, "low": 100.0, "close": 103.0, "volume": 1100}
    ]
    assert result["metadata"]["source"] == "yahoo_finance_chart"
    assert result["metadata"]["cache_status"] == "live"
    assert result["metadata"]["stale"] is False


def test_chart_service_uses_stale_cache_on_failure(monkeypatch, tmp_path):
    monkeypatch.setenv("TRADING_WORKSTATION_MARKET_CACHE", str(tmp_path / "cache"))
    monkeypatch.setattr(workstation_chart_service, "yf", None)

    def good_get(url, params=None, timeout=None, **_kwargs):
        return _FakeResponse(200, _chart_payload())

    monkeypatch.setattr(workstation_chart_service.requests, "get", good_get)
    live = workstation_chart_service.get_yahoo_chart("AAPL", "1D", 1)
    assert live["metadata"]["cache_status"] == "live"

    def failing_get(url, params=None, timeout=None, **_kwargs):
        raise requests.RequestException("network down")

    monkeypatch.setattr(workstation_chart_service.requests, "get", failing_get)
    fallback = workstation_chart_service.get_yahoo_chart("AAPL", "1D", 1)

    assert fallback["symbol"] == "AAPL"
    assert fallback["metadata"]["cache_status"] == "stale"
    assert fallback["metadata"]["stale"] is True
    assert fallback["metadata"]["fallback_error"]["code"] == "REQUEST_FAILED"
