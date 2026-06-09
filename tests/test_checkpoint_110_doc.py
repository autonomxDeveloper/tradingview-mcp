from __future__ import annotations

from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
CHECKPOINT = ROOT / "docs" / "checkpoint-110.md"


def test_checkpoint_110_doc_tracks_follow_up_scope():
    text = CHECKPOINT.read_text(encoding="utf-8")

    assert "Checkpoint 110" in text
    assert "PR #110" in text
    assert "test coverage" in text
    assert "Checkpoint 108 note" in text
