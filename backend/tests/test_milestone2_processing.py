from pathlib import Path
from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app.processing.dem_reader import DEMReader
from backend.app.processing.layer_exporter import LayerExporter
from backend.app.processing.terrain_metrics import compute_roughness, compute_slope
from backend.app.models.sector import SectorBounds

client = TestClient(app)


def test_dem_reader_and_metrics():
    reader = DEMReader()
    hdr_path = Path("data/raw/SEC-JEZERO-01/MEGT90N000CB.HDR")
    img_path = Path("data/raw/SEC-JEZERO-01/MEGT90N000CB.IMG")

    assert hdr_path.exists()
    assert img_path.exists()

    dem, header = reader.read_dem(hdr_path, img_path)
    assert dem.shape == (720, 1440)
    assert header.lines == 720
    assert header.samples == 1440

    # Crop Jezero bounds
    bounds = SectorBounds(min_lat=18.0, max_lat=19.0, min_lon=77.0, max_lon=78.0)
    cropped = reader.crop_sector(dem, bounds, buffer_pixels=1)
    assert cropped.elevation.ndim == 2

    # Slope calculation
    slope_deg, elevation, lats, lons = compute_slope(cropped, trim_buffer=True)
    assert slope_deg.shape == elevation.shape
    assert slope_deg.min() >= 0.0
    assert slope_deg.max() <= 90.0
    # Slope in Jezero region is non-zero
    assert slope_deg.mean() > 0.0

    # Roughness
    roughness = compute_roughness(elevation, window_size=3)
    assert roughness.shape == elevation.shape
    assert roughness.min() >= 0.0


def test_api_process_and_layer_endpoints():
    # 1. Process sector DEM
    process_resp = client.post("/api/sectors/SEC-JEZERO-01/process")
    assert process_resp.status_code == 200
    res_data = process_resp.json()
    assert res_data["status"] == "success"
    assert res_data["result"]["state"] == "DISCOVERED"

    # 2. Verify sector state
    sector_resp = client.get("/api/sectors/SEC-JEZERO-01")
    assert sector_resp.status_code == 200
    sec = sector_resp.json()
    assert sec["state"] == "DISCOVERED"
    assert sec["layers"]["elevation"]["status"] == "READY"
    assert sec["layers"]["slope"]["status"] == "READY"
    assert sec["layers"]["roughness"]["status"] == "READY"

    # 3. Verify slope layer data endpoint
    slope_resp = client.get("/api/sectors/SEC-JEZERO-01/layers/slope")
    assert slope_resp.status_code == 200
    slope_data = slope_resp.json()
    assert slope_data["units"] == "degrees"
    assert "stats" in slope_data
    assert slope_data["stats"]["min"] >= 0.0
    assert len(slope_data["grid"]) > 0
    assert len(slope_data["resampled_grid_32x32"]) == 32

    # 4. Verify elevation layer data endpoint
    elev_resp = client.get("/api/sectors/SEC-JEZERO-01/layers/elevation")
    assert elev_resp.status_code == 200
    elev_data = elev_resp.json()
    assert elev_data["units"] == "meters"
    # Jezero crater floor elevation is negative (below areoid datum)
    assert elev_data["stats"]["min"] < -1000.0

    # 5. Verify layer preview PNG endpoints
    preview_slope = client.get("/api/sectors/SEC-JEZERO-01/layers/slope/preview")
    assert preview_slope.status_code == 200
    assert preview_slope.headers["content-type"] == "image/png"
    assert len(preview_slope.content) > 50

    preview_elev = client.get("/api/sectors/SEC-JEZERO-01/layers/elevation/preview")
    assert preview_elev.status_code == 200
    assert preview_elev.headers["content-type"] == "image/png"
    assert len(preview_elev.content) > 50


if __name__ == "__main__":
    test_dem_reader_and_metrics()
    print("DEM reader and metrics unit test passed!")
    test_api_process_and_layer_endpoints()
    print("API process and layer endpoints integration test passed!")
