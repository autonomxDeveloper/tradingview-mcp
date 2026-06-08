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
