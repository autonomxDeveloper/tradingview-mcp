from pathlib import Path


def test_cp118_note_exists():
    text = (Path(__file__).resolve().parents[1] / "docs" / "checkpoint118.md").read_text()
    assert "PR #118" in text
