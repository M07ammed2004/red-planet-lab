import logging
from backend.app.models.route import (
    RouteComparisonResponse,
    RoutePlanRequest,
    RouteResult,
    RouteStrategy,
)
from backend.app.route_planning.astar import AStarPlanner
from backend.app.route_planning.rover_traverses import get_rover_traverse
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
        scientific = routes.get(RouteStrategy.SCIENTIFIC_EXPLORATION)

        parts = []
        if fastest and safest and fastest.feasible and safest.feasible:
            dist_diff = safest.total_distance_km - fastest.total_distance_km
            slope_diff = fastest.avg_slope_deg - safest.avg_slope_deg
            parts.append(
                f"The Safest route adds {dist_diff:.2f} km ({safest.total_distance_km:.2f} km vs {fastest.total_distance_km:.2f} km), "
                f"reducing average slope by {slope_diff:.2f}° ({safest.avg_slope_deg:.2f}° vs {fastest.avg_slope_deg:.2f}°)."
            )

        if scientific and scientific.feasible:
            parts.append(
                f"The Scientific Exploration route ({scientific.total_distance_km:.2f} km) unlocks high-value research targets "
                f"(ROI: {scientific.scientific_roi_score}, {len(scientific.scientific_targets_visited)} geological strata/outcrops visited)."
            )

        if safest and safest.feasible and safest.storm_hazard_avoided:
            parts.append(
                f"Atmospheric Hazard Response: Safest corridor diverted around active Martian dust storm core (max wind: {safest.max_wind_speed_ms:.1f} m/s, avg tau: {safest.avg_dust_opacity_tau:.2f})."
            )

        summary = " | ".join(parts) if parts else "One or more route strategies could not find a traversable path within configured limits."

        # Check for historical NASA rover benchmark traverse
        benchmark = get_rover_traverse(request.sector_id)
        benchmark_data = benchmark.model_dump() if benchmark else None

        if benchmark_data and safest and safest.feasible:
            summary += (
                f" NASA Benchmark: {benchmark.rover_name} completed a {benchmark.total_distance_km:.1f} km "
                f"historical traverse across this sector ({benchmark.landing_site_name})."
            )

        return RouteComparisonResponse(
            sector_id=request.sector_id,
            start_coords=request.start_coords,
            destination_coords=request.destination_coords,
            routes=routes,
            summary=summary,
            benchmark_traverse=benchmark_data,
        )


route_planning_service = RoutePlanningService()
