from __future__ import annotations

from fastapi.testclient import TestClient

from tradingview_mcp.workstation_app import create_app


def test_default_app_exposes_ai_paper_audit_export_route_from_packet(tmp_path, monkeypatch):
    monkeypatch.setenv("TRADING_WORKSTATION_JOURNAL", str(tmp_path / "journal.jsonl"))
    response = TestClient(create_app()).post(
        "/api/ai/paper-trader/audit-export",
        json={
            "export_format": "markdown",
            "name": "route audit",
            "packet": {
                "packet_type": "ai_paper_review_packet",
                "summary": {"decision_count": 1, "symbols": ["AAPL"], "win_rate": 0.0},
                "performance": {"summary": {"replayed_count": 0}, "groups": {}},
                "paper_only": True,
                "live_execution": False,
                "execution_submitted": False,
                "background_loop_enabled": False,
                "read_only": True,
            },
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["export_type"] == "ai_paper_audit_export"
    assert payload["format"] == "markdown"
    assert payload["filename"] == "route-audit.md"
    assert "AI Paper Audit Review Packet" in payload["content"]
    assert payload["paper_only"] is True
    assert payload["live_execution"] is False
    assert payload["execution_submitted"] is False
    assert payload["background_loop_enabled"] is False
    assert payload["read_only"] is True


def test_default_app_audit_export_can_build_packet_when_missing(tmp_path, monkeypatch):
    monkeypatch.setenv("TRADING_WORKSTATION_JOURNAL", str(tmp_path / "journal.jsonl"))
    response = TestClient(create_app()).post(
        "/api/ai/paper-trader/audit-export",
        json={"export_format": "json", "name": "empty packet", "limit": 5},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["format"] == "json"
    assert payload["filename"] == "empty-packet.json"
    assert '"packet_type": "ai_paper_review_packet"' in payload["content"]
    assert payload["paper_only"] is True
    assert payload["live_execution"] is False
    assert payload["execution_submitted"] is False
    assert payload["read_only"] is True
