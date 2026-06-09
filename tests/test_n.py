from pathlib import Path


def test_n():
    assert (Path(__file__).resolve().parents[1] / "docs" / "cp132.md").exists()
