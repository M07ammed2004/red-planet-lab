from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app.models.sector import SectorState
from backend.app.services.sector_service import sector_service

client = TestClient(app)


def test_milestone1_discovery_and_download_pipeline():
    # 1. Verify initial sector state (reset if previously scouted in other tests)
    sector = sector_service.get_sector("SEC-JEZERO-01")
    if sector:
        sector.state = SectorState.UNSCOUTED
    resp = client.get("/api/sectors/SEC-JEZERO-01")
    assert resp.status_code == 200
    assert resp.json()["state"] == "UNSCOUTED"

    # 2. Trigger archive discovery (scan)
    scan_resp = client.post("/api/sectors/SEC-JEZERO-01/scan")
    assert scan_resp.status_code == 200
    scan_data = scan_resp.json()
    assert scan_data["state"] == "DATA_FOUND"
    assert len(scan_data["source_products"]) > 0

    # 3. Retrieve discovered products
    prod_resp = client.get("/api/sectors/SEC-JEZERO-01/products")
    assert prod_resp.status_code == 200
    products = prod_resp.json()
    assert len(products) > 0
    mola_topography = [p for p in products if p["instrument"] == "MOLA" and "megt" in p["product_id"].lower()]
    assert len(mola_topography) > 0

    # 4. Download DEM
    dl_resp = client.post("/api/sectors/SEC-JEZERO-01/download-dem")
    assert dl_resp.status_code == 200
    dl_data = dl_resp.json()
    assert dl_data["status"] == "success"
    manifest = dl_data["manifest"]
    assert len(manifest["files"]) > 0
    for f in manifest["files"]:
        assert f["exists"] is True
        assert f["actual_size_bytes"] > 0

    # 5. Verify sector manifest endpoint
    man_resp = client.get("/api/sectors/SEC-JEZERO-01/manifest")
    assert man_resp.status_code == 200
    assert man_resp.json()["sector_id"] == "SEC-JEZERO-01"

    # 6. Verify sector state updated to PARTIALLY_DISCOVERED with elevation ready
    sec_resp = client.get("/api/sectors/SEC-JEZERO-01")
    assert sec_resp.status_code == 200
    sec_data = sec_resp.json()
    assert sec_data["state"] == "PARTIALLY_DISCOVERED"
    assert sec_data["layers"]["elevation"]["status"] == "READY"
    assert sec_data["layers"]["elevation"]["file_path"] is not None


if __name__ == "__main__":
    test_milestone1_discovery_and_download_pipeline()
    print("Milestone 1 integration test passed successfully!")
