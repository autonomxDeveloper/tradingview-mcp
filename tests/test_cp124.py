from pathlib import Path


def test_cp124_note_exists():
    text = (Path(__file__).resolve().parents[1] / "docs" / "cp124.md").read_text()
    assert "PR #124" in text
