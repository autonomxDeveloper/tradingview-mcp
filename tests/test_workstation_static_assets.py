from __future__ import annotations

from fastapi.testclient import TestClient

from tradingview_mcp.workstation_app import INDEX_FILE, STATIC_DIR, create_app


def test_static_asset_files_exist():
    assert STATIC_DIR.exists()
    assert INDEX_FILE.exists()
    assert (STATIC_DIR / "styles.css").exists()
    assert (STATIC_DIR / "app.js").exists()
    assert (STATIC_DIR / "slot2_chart.js").exists()


def test_index_serves_static_html():
    client = TestClient(create_app())

    response = client.get("/")

    assert response.status_code == 200
    assert "Autonomx Trading Research Workstation" in response.text
    assert "/static/styles.css" in response.text
    assert "/static/app.js" in response.text
    assert "/static/slot2_chart.js" in response.text


def test_static_assets_are_mounted():
    client = TestClient(create_app())

    css_response = client.get("/static/styles.css")
    js_response = client.get("/static/app.js")
    slot_response = client.get("/static/slot2_chart.js")

    assert css_response.status_code == 200
    assert "background" in css_response.text
    assert js_response.status_code == 200
    assert "loadMarket" in js_response.text
    assert slot_response.status_code == 200
    assert "renderSlot2Chart" in slot_response.text


def test_advanced_chart_controls_are_present():
    client = TestClient(create_app())

    html = client.get("/").text
    js = client.get("/static/app.js").text
    css = client.get("/static/styles.css").text

    assert "SMA 20" in html
    assert "SMA 50" in html
    assert "EMA 21" in html
    assert "chartMeta" in html
    assert "legend" in html
    assert "toggleOverlay" in js
    assert "movingAverage" in js
    assert "exponentialMovingAverage" in js
    assert "updateLegend" in js
    assert "chartbar" in css
    assert "#chartWrap" in css


def test_layout_controls_are_present():
    client = TestClient(create_app())

    html = client.get("/").text
    js = client.get("/static/app.js").text

    assert "layoutName" in html
    assert "Save layout" in html
    assert "Load layout" in html
    assert "Reset layout" in html
    assert "saveLayout" in js
    assert "loadLayout" in js
    assert "resetLayout" in js
    assert "currentLayoutState" in js
    assert "applyLayoutState" in js


def test_layout_mode_controls_are_present():
    client = TestClient(create_app())

    html = client.get("/").text
    css = client.get("/static/styles.css").text

    assert "layoutMode" in html
    assert "1 chart" in html
    assert "2 split" in html
    assert "4 grid" in html
    assert "chartGrid" in html
    assert "chartSlot2" in html
    assert "setLayoutMode" in html
    assert "workstationLayoutMode" in html
    assert "layout-grid-2" in css
    assert "layout-grid-4" in css


def test_chart_slot_state_controls_are_present():
    client = TestClient(create_app())

    html = client.get("/").text
    css = client.get("/static/styles.css").text

    assert "slot2Symbol" in html
    assert "slot3Symbol" in html
    assert "slot4Symbol" in html
    assert "slot2Tf" in html
    assert "slot3Tf" in html
    assert "slot4Tf" in html
    assert "slot2Label" in html
    assert "setChartSlot" in html
    assert "renderChartSlot" in html
    assert "applyChartSlots" in html
    assert "workstationChartSlots" in html
    assert "slot-card" in css


def test_slot_chart_helper_is_generic():
    client = TestClient(create_app())

    html = client.get("/").text
    css = client.get("/static/styles.css").text
    slot_js = client.get("/static/slot2_chart.js").text

    assert "slot2Chart" in html
    assert "slot2Status" in html
    assert "slot-chart" in css
    assert "renderSlot2Chart" in slot_js
    assert "renderSlotChart" in slot_js
    assert "normalizeSlotBars" in slot_js
    assert "slotApiUrl" in slot_js
    assert "slotCandles" in slot_js
    assert "[2, 3, 4]" in slot_js


def test_layout_sync_controls_are_present():
    client = TestClient(create_app())

    html = client.get("/").text
    css = client.get("/static/styles.css").text

    assert "syncSymbol" in html
    assert "syncTimeframe" in html
    assert "sync symbol" in html
    assert "sync timeframe" in html
    assert "setSymbolSync" in html
    assert "setTimeframeSync" in html
    assert "workstationSyncSymbol" in html
    assert "workstationSyncTimeframe" in html
    assert "sync-toggle" in css


def test_layout_catalog_controls_are_present():
    client = TestClient(create_app())

    html = client.get("/").text
    js = client.get("/static/app.js").text

    assert "List layouts" in html
    assert "Delete layout" in html
    assert "listLayouts" in js
    assert "deleteLayout" in js
    assert "readLayoutCatalog" in js
    assert "writeLayoutCatalog" in js
    assert "rememberLayoutName" in js


def test_rsi_indicator_pane_controls_are_present():
    client = TestClient(create_app())

    html = client.get("/").text
    js = client.get("/static/app.js").text

    assert "RSI" in html
    assert "rsiWrap" in html
    assert "rsiChart" in html
    assert "rsiLegend" in html
    assert "toggleRsiPane" in js
    assert "relativeStrengthIndex" in js
    assert "renderRsiPane" in js
    assert "ensureRsiChart" in js


def test_macd_indicator_pane_controls_are_present():
    client = TestClient(create_app())

    html = client.get("/").text
    js = client.get("/static/app.js").text

    assert "MACD" in html
    assert "macdWrap" in html
    assert "macdChart" in html
    assert "macdLegend" in html
    assert "toggleMacdPane" in js
    assert "macdValues" in js
    assert "renderMacdPane" in js
    assert "ensureMacdChart" in js


def test_price_level_drawing_controls_are_present():
    client = TestClient(create_app())

    html = client.get("/").text
    js = client.get("/static/app.js").text
    css = client.get("/static/styles.css").text

    assert "levelPrice" in html
    assert "levelLabel" in html
    assert "levelKind" in html
    assert "Add level" in html
    assert "Last close" in html
    assert "addLevelFromInput" in js
    assert "addLevelFromLastClose" in js
    assert "drawingStorageKey" in js
    assert "restoreDrawings" in js
    assert "renderLevels" in js
    assert "createPriceLine" in js
    assert "level-input" in css
    assert "level-label-input" in css


def test_drawing_notes_export_import_controls_are_present():
    client = TestClient(create_app())

    html = client.get("/").text
    js = client.get("/static/app.js").text
    css = client.get("/static/styles.css").text

    assert "noteText" in html
    assert "Add note" in html
    assert "Clear drawings" in html
    assert "Export" in html
    assert "Import" in html
    assert "notesOverlay" in html
    assert "addNoteAtLastClose" in js
    assert "exportDrawings" in js
    assert "importDrawings" in js
    assert "renderNotes" in js
    assert "emptyDrawings" in js
    assert "notes-overlay" in css
    assert "chart-note" in css


def test_rectangle_zone_drawing_controls_are_present():
    client = TestClient(create_app())

    html = client.get("/").text
    js = client.get("/static/app.js").text
    css = client.get("/static/styles.css").text

    assert "zoneLow" in html
    assert "zoneHigh" in html
    assert "zoneLabel" in html
    assert "zoneKind" in html
    assert "Add zone" in html
    assert "zonesOverlay" in html
    assert "addZoneFromInput" in js
    assert "renderZones" in js
    assert "renderHtmlDrawings" in js
    assert "zones: []" in js
    assert "chart-zone" in css
    assert "zones-overlay" in css
