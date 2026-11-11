import asyncio
from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app.models.route import RoutePlanRequest, RouteStrategy
from backend.app.route_planning.astar import AStarPlanner
from backend.app.route_planning.traversability import TraversabilityBuilder
from backend.app.services.sector_service import sector_service

client = TestClient(app)


def test_astar_engine_fastest_vs_safest():
    # Make sure sector is processed
    asyncio.run(sector_service.process_sector_dem("SEC-JEZERO-01"))

    builder = TraversabilityBuilder()
    planner = AStarPlanner()
    sector = sector_service.get_sector("SEC-JEZERO-01")

    grid = builder.build_from_sector("SEC-JEZERO-01", sector.bounds, max_slope_deg=15.0)

    # Start: (row 2, col 2), Goal: (row 28, col 28)
    start_idx = (2, 2)
    goal_idx = (28, 28)

    fastest = planner.plan_route(grid, start_idx, goal_idx, RouteStrategy.FASTEST)
    safest = planner.plan_route(grid, start_idx, goal_idx, RouteStrategy.SAFEST)

    assert fastest.feasible is True
    assert safest.feasible is True

    # Fastest route should have shorter or equal distance than safest route
    assert fastest.total_distance_km <= safest.total_distance_km + 1e-4

    # Both routes should produce valid elevation profiles
    assert len(fastest.elevation_profile) == len(fastest.path_coords)
    assert len(safest.elevation_profile) == len(safest.path_coords)
    assert len(fastest.waypoints) > 0


def test_hard_constraint_infeasibility():
    builder = TraversabilityBuilder()
    planner = AStarPlanner()
    sector = sector_service.get_sector("SEC-JEZERO-01")

    # Set unrealistically low slope constraint so no paths are valid
    grid = builder.build_from_sector("SEC-JEZERO-01", sector.bounds, max_slope_deg=0.01)

    res = planner.plan_route(grid, (0, 0), (20, 20), RouteStrategy.FASTEST)
    assert res.feasible is False
    assert "infeasible" in res.explanation.lower()


def test_api_routes_plan():
    payload = {
        "sector_id": "SEC-JEZERO-01",
        "start_coords": [18.85, 77.15],
        "destination_coords": [18.15, 77.85],
        "max_traversable_slope_deg": 15.0,
        "strategies": ["FASTEST", "SAFEST"],
    }

    resp = client.post("/api/routes/plan", json=payload)
    assert resp.status_code == 200
    data = resp.json()

    assert data["sector_id"] == "SEC-JEZERO-01"
    assert "FASTEST" in data["routes"]
    assert "SAFEST" in data["routes"]

    fastest = data["routes"]["FASTEST"]
    safest = data["routes"]["SAFEST"]

    assert fastest["feasible"] is True
    assert safest["feasible"] is True
    assert len(fastest["path_coords"]) > 10
    assert len(safest["path_coords"]) > 10
    assert len(fastest["elevation_profile"]) == len(fastest["path_coords"])
    assert "summary" in data
    assert len(data["summary"]) > 20


if __name__ == "__main__":
    test_astar_engine_fastest_vs_safest()
    print("A* engine fastest vs safest test passed!")
    test_hard_constraint_infeasibility()
    print("Hard constraint infeasibility test passed!")
    test_api_routes_plan()
    print("API /api/routes/plan integration test passed!")
