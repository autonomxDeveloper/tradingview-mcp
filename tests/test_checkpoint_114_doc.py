from __future__ import annotations

from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
CHECKPOINT = ROOT / "docs" / "checkpoint-114.md"


def test_checkpoint_114_doc_tracks_follow_up_scope():
    text = CHECKPOINT.read_text(encoding="utf-8")

    assert "Checkpoint 114" in text
    assert "PR #114" in text
    assert "test coverage" in text
    assert "Checkpoint 112 note" in text
