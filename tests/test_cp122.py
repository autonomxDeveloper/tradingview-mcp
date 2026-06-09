from pathlib import Path


def test_cp122_note_exists():
    text = (Path(__file__).resolve().parents[1] / "docs" / "cp122.md").read_text()
    assert "PR #122" in text
