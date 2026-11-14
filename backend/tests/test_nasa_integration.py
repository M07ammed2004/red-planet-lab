from fastapi.testclient import TestClient
from backend.app.main import app

client = TestClient(app)


def test_nasa_rover_benchmark_endpoints():
    # Test Jezero (Perseverance)
    resp = client.get("/api/routes/benchmarks/SEC-JEZERO-01")
    assert resp.status_code == 200
    data = resp.json()
    assert data["mission_id"] == "MARS_2020"
    assert "Perseverance" in data["rover_name"]
    assert "Octavia" in data["landing_site_name"]
    assert data["total_distance_km"] > 20.0
    assert len(data["waypoints"]) >= 5
    assert len(data["path_coords"]) >= 10

    # Test Gale (Curiosity)
    resp_gale = client.get("/api/routes/benchmarks/SEC-GALE-01")
    assert resp_gale.status_code == 200
    gale_data = resp_gale.json()
    assert gale_data["mission_id"] == "MSL_CURIOSITY"
    assert "Curiosity" in gale_data["rover_name"]
    assert "Bradbury" in gale_data["landing_site_name"]
    assert len(gale_data["waypoints"]) >= 5


def test_nasa_ground_imagery_endpoints():
    # Test Jezero in-situ photos
    resp = client.get("/api/sectors/SEC-JEZERO-01/ground-imagery")
    assert resp.status_code == 200
    data = resp.json()
    assert data["count"] >= 3
    photos = data["photos"]
    assert any("Mastcam-Z" in p["instrument"] for p in photos)
    assert any("Delta" in p["target_name"] or "Floor" in p["target_name"] for p in photos)

    # Test Gale in-situ photos
    resp_gale = client.get("/api/sectors/SEC-GALE-01/ground-imagery")
    assert resp_gale.status_code == 200
    gale_data = resp_gale.json()
    assert gale_data["count"] >= 3
    gale_photos = gale_data["photos"]
    assert any("Yellowknife" in p["target_name"] or "Ridge" in p["target_name"] for p in gale_photos)


def test_route_plan_includes_nasa_benchmark():
    payload = {
        "sector_id": "SEC-JEZERO-01",
        "start_coords": [18.4447, 77.4508],
        "destination_coords": [18.4890, 77.3650],
        "max_traversable_slope_deg": 15.0,
        "strategies": ["FASTEST", "SAFEST"],
    }
    resp = client.post("/api/routes/plan", json=payload)
    assert resp.status_code == 200
    data = resp.json()
    assert "benchmark_traverse" in data
    assert data["benchmark_traverse"] is not None
    assert "Perseverance" in data["benchmark_traverse"]["rover_name"]
    assert "NASA Benchmark" in data["summary"]
