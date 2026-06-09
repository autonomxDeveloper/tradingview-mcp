from pathlib import Path


def test_m():
    assert (Path(__file__).resolve().parents[1] / "docs" / "cp130.md").exists()
