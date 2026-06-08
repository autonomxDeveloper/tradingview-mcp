from __future__ import annotations

from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
VALIDATION_HISTORY = ROOT / "docs" / "workstation-c5-validation-history.md"


def test_c5_validation_history_tracks_pr47_checkpoint():
    text = VALIDATION_HISTORY.read_text(encoding="utf-8")

    assert "PR #47" in text
    assert "PR #46 checkpoint" in text
    assert "history note" in text
