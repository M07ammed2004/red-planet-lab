from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app.models.sector import SectorState

client = TestClient(app)


def test_list_sectors():
    response = client.get("/api/sectors")
    assert response.status_code == 200
    sectors = response.json()
    assert len(sectors) >= 2
    sector_ids = [s["sector_id"] for s in sectors]
    assert "SEC-JEZERO-01" in sector_ids
    assert "SEC-GALE-01" in sector_ids


def test_get_sector_detail():
    response = client.get("/api/sectors/SEC-GALE-01")
    assert response.status_code == 200
    sector = response.json()
    assert sector["sector_id"] == "SEC-GALE-01"
    assert sector["state"] == SectorState.UNSCOUTED.value
    assert "bounds" in sector
    assert sector["bounds"]["min_lat"] == -6.0
    assert sector["bounds"]["max_lat"] == -5.0


def test_get_nonexistent_sector():
    response = client.get("/api/sectors/NON-EXISTENT")
    assert response.status_code == 404
