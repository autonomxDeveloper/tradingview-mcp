from __future__ import annotations

from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
CHECKLIST = ROOT / "docs" / "workstation-c4-qa-checklist.md"


def test_c4_qa_checklist_exists():
    assert CHECKLIST.exists()


def test_c4_qa_checklist_covers_layout_and_slots():
    text = CHECKLIST.read_text(encoding="utf-8")

    assert "## Layout modes" in text
    assert "## Secondary slot assignment" in text
    assert "## Saved layout restore" in text
    assert "## Compact slot rendering" in text
    assert "toolbar slot summary" in text
    assert "primary chart remains unchanged" in text
