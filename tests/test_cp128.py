from pathlib import Path


def test_cp128_note_exists():
    text = (Path(__file__).resolve().parents[1] / "docs" / "cp128.md").read_text()
    assert "PR #128" in text
