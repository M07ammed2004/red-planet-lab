from fastapi import APIRouter, HTTPException
from backend.app.models.route import RouteComparisonResponse, RoutePlanRequest
from backend.app.route_planning.route_service import route_planning_service

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
