from pathlib import Path


def test_t():
    assert (Path(__file__).resolve().parents[1] / "docs" / "e.md").exists()
