from __future__ import annotations

from fastapi.testclient import TestClient

from tradingview_mcp.workstation_app import INDEX_FILE, STATIC_DIR, create_app


def test_static_asset_files_exist():
    assert STATIC_DIR.exists()
    assert INDEX_FILE.exists()
    assert (STATIC_DIR / "styles.css").exists()
    assert (STATIC_DIR / "app.js").exists()


def test_index_serves_static_html():
    client = TestClient(create_app())

    response = client.get("/")

    assert response.status_code == 200
    assert "Autonomx Trading Research Workstation" in response.text
    assert "/static/styles.css" in response.text
    assert "/static/app.js" in response.text


def test_static_assets_are_mounted():
    client = TestClient(create_app())

    css_response = client.get("/static/styles.css")
    js_response = client.get("/static/app.js")

    assert css_response.status_code == 200
    assert "background" in css_response.text
    assert js_response.status_code == 200
    assert "loadMarket" in js_response.text


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
