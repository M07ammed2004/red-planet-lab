from fastapi.testclient import TestClient
from backend.app.main import app

client = TestClient(app)


def test_root_endpoint():
    response = client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert "name" in data
    assert "version" in data


def test_health_endpoint():
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert "version" in data
    assert "timestamp" in data
    assert "storage" in data
    assert data["storage"]["raw_dir"] is True
    assert data["storage"]["processed_dir"] is True
    assert data["storage"]["cache_dir"] is True
    assert data["storage"]["metadata_dir"] is True
