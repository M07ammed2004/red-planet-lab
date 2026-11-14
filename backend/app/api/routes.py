from fastapi import APIRouter, HTTPException
from backend.app.models.route import RouteComparisonResponse, RoutePlanRequest
from backend.app.route_planning.route_service import route_planning_service
from backend.app.route_planning.rover_traverses import get_rover_traverse

router = APIRouter(prefix="/routes", tags=["Route Planning"])


@router.post("/plan", response_model=RouteComparisonResponse)
async def plan_mission_routes(request: RoutePlanRequest) -> RouteComparisonResponse:
    """
    Calculate and compare explainable exploration paths (Fastest vs Safest)
    across the sector traversability grid under configurable safety slope limits.
    """
    try:
        response = route_planning_service.plan_and_compare(request)
        return response
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except FileNotFoundError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Route planning failed: {e}")


@router.get("/benchmarks/{sector_id}")
async def get_rover_benchmark_traverse(sector_id: str):
    """
    Retrieve historical NASA rover traverse benchmark (Curiosity or Perseverance)
    for direct scientific validation against A* pathfinding.
    """
    traverse = get_rover_traverse(sector_id)
    if not traverse:
        raise HTTPException(
            status_code=404,
            detail=f"No NASA rover benchmark traverse recorded for sector '{sector_id}'.",
        )
    return traverse.model_dump()
