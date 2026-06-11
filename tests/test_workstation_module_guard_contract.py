from __future__ import annotations

from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
STATIC = ROOT / "src" / "tradingview_mcp" / "workstation_static"


def read_static(name: str) -> str:
    return (STATIC / name).read_text(encoding="utf-8")


def test_module_guard_exposes_check_alias_used_by_boot_modules():
    guard = read_static("module_guard.js")

    assert "workstationModuleGuard.missing" in guard
    assert "workstationModuleGuard.check" in guard
    assert "checkModuleDependency" in guard
    assert "return window.workstationModuleGuard.missing(moduleId, checks)" in guard


def test_module_guard_supports_globals_elements_and_selectors():
    guard = read_static("module_guard.js")

    assert "checks.globals" in guard
    assert "checks.elements" in guard
    assert "checks.selectors" in guard
    assert "document.getElementById" in guard
    assert "document.querySelector" in guard
    assert "selector:${selector}" in guard


def test_boot_modules_can_call_module_guard_check_without_runtime_type_error():
    for module_name in [
        "ai_watchlist_scanner_module.js",
        "ai_trade_journal_coach_module.js",
        "ai_confidence_calibration_module.js",
    ]:
        module = read_static(module_name)
        assert "window.workstationModuleGuard.check" in module
