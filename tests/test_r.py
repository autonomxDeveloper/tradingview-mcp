from pathlib import Path


def test_r():
    assert (Path(__file__).resolve().parents[1] / "docs" / "d136.md").exists()
