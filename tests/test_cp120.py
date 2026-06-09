from pathlib import Path


def test_cp120_note_exists():
    text = (Path(__file__).resolve().parents[1] / "docs" / "checkpoint120.md").read_text()
    assert "PR #120" in text
