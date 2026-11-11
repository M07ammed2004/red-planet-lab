import asyncio
import numpy as np
from fastapi.testclient import TestClient
from backend.app.core.config import settings
from backend.app.data_engine.highres_downloader import highres_downloader
from backend.app.jobs.job_manager import JobStage, JobStatus, job_manager
from backend.app.main import app
from backend.app.models.sector import SectorBounds
from backend.app.processing.terrain_3d_builder import terrain_3d_builder

client = TestClient(app)


def test_mola_quadrant_calculation():
    # Jezero Crater (~18.38N, 77.58E)
    jezero_bounds = SectorBounds(min_lat=18.0, max_lat=19.0, min_lon=77.0, max_lon=78.0)
    q_id, max_lat, min_lat, w_lon, e_lon = highres_downloader.get_mola_quadrant_info(jezero_bounds)
    assert q_id == "megt44n000hb"
    assert max_lat == 44.0
    assert min_lat == 0.0
    assert w_lon == 0.0
    assert e_lon == 90.0

    # Gale Crater (~ -5.4S, 137.8E)
    gale_bounds = SectorBounds(min_lat=-6.0, max_lat=-5.0, min_lon=137.0, max_lon=138.0)
    q_id_gale, max_lat_g, min_lat_g, w_lon_g, e_lon_g = highres_downloader.get_mola_quadrant_info(gale_bounds)
    assert q_id_gale == "megt00n090hb"
    assert max_lat_g == 0.0
    assert min_lat_g == -44.0
    assert w_lon_g == 90.0
    assert e_lon_g == 180.0


def test_job_manager_lifecycle():
    job = job_manager.create_job("TEST-SECTOR-01")
    assert job.status == JobStatus.PENDING
    assert job.stage == JobStage.QUEUED

    job_manager.update_progress(
        job.job_id,
        stage=JobStage.DOWNLOADING_DEM,
        progress_pct=35.0,
        downloaded_bytes=1000,
        total_bytes=3000,
        detail_message="Downloading DEM slice",
    )
    fetched = job_manager.get_job(job.job_id)
    assert fetched is not None
    assert fetched.status == JobStatus.RUNNING
    assert fetched.progress_pct == 35.0
    assert fetched.downloaded_bytes == 1000

    # Test cancellation
    can_cancel = job_manager.request_cancellation(job.job_id)
    assert can_cancel is True
    assert job_manager.is_cancelled(job.job_id) is True
    assert fetched.status == JobStatus.CANCELLED


def test_storage_endpoints():
    response = client.get("/api/storage/status")
    assert response.status_code == 200
    data = response.json()
    assert "disk" in data
    assert "tiers" in data
    assert "raw_bytes" in data["tiers"]
    assert "processed_bytes" in data["tiers"]
    assert "cache_bytes" in data["tiers"]
    assert data["disk"]["total_bytes"] > 0


def test_terrain_3d_builder():
    sector_id = "SEC-TEST-3D"
    bounds = SectorBounds(min_lat=18.0, max_lat=19.0, min_lon=77.0, max_lon=78.0)
    # Generate 128x128 synthetic crater elevation
    y, x = np.mgrid[0:128, 0:128]
    r = np.sqrt((x - 64) ** 2 + (y - 64) ** 2) / 64.0
    elev = -2500.0 + 500.0 * np.exp(-((r - 0.7) ** 2) / 0.05) - 300.0 * np.exp(-(r**2) / 0.1)

    result = terrain_3d_builder.build_and_export_terrain(sector_id, bounds, elev)
    assert "mesh_path" in result
    assert result["dimensions"] == [128, 128]
    assert "elevation_stats" in result
    assert "slope_stats" in result

    # Check terrain_mesh.json was written
    mesh_path = settings.DATA_PROCESSED_DIR / sector_id / "terrain_mesh.json"
    assert mesh_path.exists()

    # Query terrain mesh endpoint
    resp = client.get(f"/api/sectors/{sector_id}/terrain-mesh")
    assert resp.status_code == 200
    mesh_json = resp.json()
    assert mesh_json["sector_id"] == sector_id
    assert mesh_json["dimensions"] == [128, 128]
    assert len(mesh_json["elevation_grid"]) == 128
    assert len(mesh_json["elevation_grid"][0]) == 128


def test_explore_sector_endpoint():
    # If terrain already exists (as created above for SEC-TEST-3D if registered),
    # let's test with SEC-JEZERO-01
    resp = client.post("/api/sectors/SEC-JEZERO-01/explore")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] in ("PROCESSING", "READY")
    if data["status"] == "PROCESSING":
        assert "job_id" in data
        job_id = data["job_id"]
        # Check job endpoint
        j_resp = client.get(f"/api/jobs/{job_id}")
        assert j_resp.status_code == 200
        assert j_resp.json()["sector_id"] == "SEC-JEZERO-01"
