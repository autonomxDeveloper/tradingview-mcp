from __future__ import annotations

from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
CHECKPOINT = ROOT / "docs" / "checkpoint-106.md"


def test_checkpoint_106_doc_tracks_follow_up_scope():
    text = CHECKPOINT.read_text(encoding="utf-8")

    assert "Checkpoint 106" in text
    assert "PR #106" in text
    assert "follow-up test coverage" in text
    assert "previous C5 checkpoint note" in text
