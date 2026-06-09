from pathlib import Path


def test_b1():
    assert (Path("docs") / "c.md").exists()
