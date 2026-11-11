import logging
from backend.app.models.route import (
    RouteComparisonResponse,
    RoutePlanRequest,
    RouteResult,
    RouteStrategy,
)
from backend.app.route_planning.astar import AStarPlanner
from backend.app.route_planning.traversability import TraversabilityBuilder
from backend.app.services.sector_service import sector_service

logger = logging.getLogger(__name__)


class RoutePlanningService:
    """Service orchestrating multi-strategy route planning and comparative analysis."""

    def __init__(self):
        self.traversability_builder = TraversabilityBuilder()
        self.planner = AStarPlanner()

    def plan_and_compare(self, request: RoutePlanRequest) -> RouteComparisonResponse:
        """Plan routes under requested strategies and compare metrics."""
        sector = sector_service.get_sector(request.sector_id)
        if not sector:
            raise ValueError(f"Sector '{request.sector_id}' not found.")

        # Build traversability grid with configured safety limits
        grid = self.traversability_builder.build_from_sector(
            sector_id=request.sector_id,
            bounds=sector.bounds,
            max_slope_deg=request.max_traversable_slope_deg,
        )

        start_idx = self.traversability_builder.coords_to_indices(grid, request.start_coords)
        goal_idx = self.traversability_builder.coords_to_indices(grid, request.destination_coords)

        routes: dict[RouteStrategy, RouteResult] = {}
        for strategy in request.strategies:
            res = self.planner.plan_route(
                grid=grid,
                start_idx=start_idx,
                goal_idx=goal_idx,
                strategy=strategy,
            )
            routes[strategy] = res

        # Generate comparative summary
        fastest = routes.get(RouteStrategy.FASTEST)
        safest = routes.get(RouteStrategy.SAFEST)

        if fastest and safest and fastest.feasible and safest.feasible:
            dist_diff = safest.total_distance_km - fastest.total_distance_km
            slope_diff = fastest.avg_slope_deg - safest.avg_slope_deg
            summary = (
                f"Comparison: The Safest route adds {dist_diff:.2f} km of travel distance "
                f"({safest.total_distance_km:.2f} km vs {fastest.total_distance_km:.2f} km), "
                f"reducing average slope exposure by {slope_diff:.2f}° "
                f"(average slope: {safest.avg_slope_deg:.2f}° vs {fastest.avg_slope_deg:.2f}°)."
            )
        elif fastest and fastest.feasible:
            summary = f"Fastest route feasible ({fastest.total_distance_km:.2f} km). Safest route evaluated."
        else:
            summary = "One or more route strategies could not find a traversable path within configured limits."

        return RouteComparisonResponse(
            sector_id=request.sector_id,
            start_coords=request.start_coords,
            destination_coords=request.destination_coords,
            routes=routes,
            summary=summary,
        )


route_planning_service = RoutePlanningService()
