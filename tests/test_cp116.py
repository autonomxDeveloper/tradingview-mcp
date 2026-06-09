from pathlib import Path


def test_cp116_note_exists():
    text = (Path(__file__).resolve().parents[1] / "docs" / "checkpoint116.md").read_text()
    assert "PR #116" in text
