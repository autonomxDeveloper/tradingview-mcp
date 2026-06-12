from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FRONTEND = ROOT / "frontend" / "workstation"


def test_react_workstation_stack_dependencies_are_declared() -> None:
    package_json = (FRONTEND / "package.json").read_text(encoding="utf-8")
    for dependency in [
        "react",
        "typescript",
        "vite",
        "tailwindcss",
        "@radix-ui/react-tabs",
        "framer-motion",
        "zustand",
        "@tanstack/react-query",
        "lightweight-charts",
        "react-resizable-panels",
        "lucide-react",
        "vitest",
        "@playwright/test",
    ]:
        assert f'"{dependency}"' in package_json


def test_react_workstation_has_chart_first_component_shell() -> None:
    app_shell = (FRONTEND / "src" / "components" / "AppShell.tsx").read_text(encoding="utf-8")
    assert "PanelGroup" in app_shell
    assert "WatchlistPanel" in app_shell
    assert "ChartWorkspace" in app_shell
    assert "ResearchPanel" in app_shell
    assert "BottomConsole" in app_shell
    assert "React + TypeScript workstation shell" in app_shell


def test_react_workstation_chart_wraps_lightweight_charts() -> None:
    chart = (FRONTEND / "src" / "components" / "ChartWorkspace.tsx").read_text(encoding="utf-8")
    assert "createChart" in chart
    assert "addCandlestickSeries" in chart
    assert "workstationApi.cryptoChart" in chart
    assert "workstationApi.stockChart" in chart


def test_react_workstation_vite_build_targets_packaged_static_dir() -> None:
    vite_config = (FRONTEND / "vite.config.ts").read_text(encoding="utf-8")
    assert "workstation_react_static" in vite_config
    assert "'/api': 'http://127.0.0.1:8088'" in vite_config
