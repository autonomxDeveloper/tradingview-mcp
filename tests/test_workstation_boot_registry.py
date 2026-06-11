from __future__ import annotations

from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
STATIC = ROOT / "src" / "tradingview_mcp" / "workstation_static"


def read_static(name: str) -> str:
    return (STATIC / name).read_text(encoding="utf-8")


def test_boot_registry_runs_late_module_callbacks_after_initial_boot():
    boot = read_static("boot_registry.js")

    for expected in [
        "hasRun: false",
        "runOne(name, fn)",
        "if (this.hasRun || document.readyState !== 'loading')",
        "this.runOne(name, fn);",
        "this.hasRun = true;",
        "pending.forEach(({ name, fn }) => this.runOne(name, fn));",
    ]:
        assert expected in boot


def test_ui_bindings_can_register_after_module_registry_dynamic_loads():
    registry = read_static("module_registry.js")
    bindings = read_static("ui_bindings.js")
    analysis = read_static("analysis_module.js")

    assert "loadModuleScript('analysisModuleScript', '/static/analysis_module.js');" in registry
    assert "loadModuleScript('uiBindingsScript', '/static/ui_bindings.js');" in registry
    assert "window.workstationBoot.run()" in registry
    assert "'analysis.run': () => callGlobal('analyze')" in bindings
    assert "window.analyze = analyze;" in analysis
    assert "window.workstationBoot.register('ui-bindings', bootUiBindings)" in bindings


def test_ui_bindings_use_delegated_click_handler_for_static_and_dynamic_actions():
    bindings = read_static("ui_bindings.js")

    for expected in [
        "document.addEventListener('click', handleDelegatedAction, true);",
        "function handleDelegatedAction(event)",
        "const element = findActionElement(event.target);",
        "runAction(element, event);",
        "window.runWorkstationAction = runAction;",
        "workstationDelegatedActionHandlerInstalled",
    ]:
        assert expected in bindings

    assert "element.addEventListener(eventName, (event) => runAction(element, event));" in bindings
    assert "eventName !== 'click'" in bindings
