from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from tradingview_mcp.core.services import workstation_chart_service


@dataclass
class _FakeResponse:
    status_code: int
    payload: Any
    text: str = ""

    def json(self) -> Any:
        return self.payload


def test_chart_service_shapes_candles(monkeypatch):
    def fake_get(url, params=None, timeout=None):
        return _FakeResponse(
            200,
            {
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
            },
        )

    monkeypatch.setattr(workstation_chart_service.requests, "get", fake_get)

    result = workstation_chart_service.get_yahoo_chart("AAPL", "1D", 1)

    assert result["symbol"] == "AAPL"
    assert result["currency"] == "USD"
    assert result["candles"] == [
        {"time": 2, "open": 101.0, "high": 104.0, "low": 100.0, "close": 103.0, "volume": 1100}
    ]
