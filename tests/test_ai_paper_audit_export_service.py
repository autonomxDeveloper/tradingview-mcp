from __future__ import annotations

from tradingview_mcp.core.services.ai_paper_audit_export_service import build_ai_paper_audit_export


def _packet() -> dict:
    return {
        "generated_at_utc": "2026-01-01T00:00:00+00:00",
        "packet_type": "ai_paper_review_packet",
        "summary": {
            "decision_count": 2,
            "replay_record_count": 2,
            "replayed_count": 2,
            "win_count": 1,
            "loss_count": 1,
            "win_rate": 50.0,
            "total_realized_pnl": 3.25,
            "symbols": ["AAPL", "MSFT"],
        },
        "performance": {
            "summary": {"replayed_count": 2, "win_rate": 50.0, "total_realized_pnl": 3.25},
            "groups": {
                "symbol": [
                    {
                        "key": "AAPL",
                        "count": 1,
                        "win_rate": 100.0,
                        "average_realized_pnl": 5.0,
                        "average_realized_pnl_pct": 5.0,
                        "average_mfe_pct": 6.0,
                        "average_mae_pct": -1.0,
                    }
                ]
            },
        },
        "paper_only": True,
        "live_execution": False,
        "execution_submitted": False,
        "background_loop_enabled": False,
        "read_only": True,
    }


def test_json_export_returns_sorted_portable_payload():
    export = build_ai_paper_audit_export(_packet(), export_format="json", name="My Audit")

    assert export["export_type"] == "ai_paper_audit_export"
    assert export["format"] == "json"
    assert export["filename"] == "my-audit.json"
    assert export["content_type"] == "application/json"
    assert '"packet_type": "ai_paper_review_packet"' in export["content"]
    assert export["size_bytes"] == len(export["content"].encode("utf-8"))
    assert export["paper_only"] is True
    assert export["live_execution"] is False
    assert export["execution_submitted"] is False
    assert export["background_loop_enabled"] is False
    assert export["read_only"] is True


def test_markdown_export_includes_summary_groups_and_safety_boundary():
    export = build_ai_paper_audit_export(_packet(), export_format="markdown", name="AAPL packet")

    assert export["format"] == "markdown"
    assert export["filename"] == "aapl-packet.md"
    assert export["content_type"] == "text/markdown"
    assert "# AI Paper Audit Review Packet" in export["content"]
    assert "## Safety boundary" in export["content"]
    assert "No LLM calls" in export["content"]
    assert "- decisions: 2" in export["content"]
    assert "### symbol" in export["content"]
    assert "| AAPL | 1 | 100" in export["content"]
    assert export["paper_only"] is True
    assert export["live_execution"] is False
