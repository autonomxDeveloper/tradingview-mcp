from __future__ import annotations

from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
CHECKPOINT = ROOT / "docs" / "workstation-c5-pr104-checkpoint.md"


def test_pr104_checkpoint_tracks_exact_validation_and_merge():
    text = CHECKPOINT.read_text(encoding="utf-8")

    assert "PR #104" in text
    assert "d4971a802860638ea65c4d98a7401ff2ff7957ff" in text
    assert "a42cbaf568cc89bcbd261368693c341a8df4204c" in text
    assert "Python CI completed successfully" in text
    assert "Publish Docker image completed successfully" in text
