from pathlib import Path


def test_cp126_note_exists():
    text = (Path(__file__).resolve().parents[1] / "docs" / "cp126.md").read_text()
    assert "PR #126" in text
