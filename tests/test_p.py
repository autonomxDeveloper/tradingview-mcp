from pathlib import Path


def test_p():
    assert (Path(__file__).resolve().parents[1] / "docs" / "cp134.md").exists()
