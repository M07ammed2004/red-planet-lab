from enum import Enum
from pydantic import BaseModel, Field


class RouteStrategy(str, Enum):
    FASTEST = "FASTEST"
    SAFEST = "SAFEST"
    SCIENTIFIC_EXPLORATION = "SCIENTIFIC_EXPLORATION"


class Waypoint(BaseModel):
    """Georeferenced navigation waypoint along a planned route."""

    lat: float
    lon: float
    elevation_m: float
    slope_deg: float
    risk_score: float
    cumulative_distance_km: float


class RoutePlanRequest(BaseModel):
    """Request model for planning mission exploration routes."""

    sector_id: str
    start_coords: tuple[float, float] = Field(description="(lat, lon) start point")
    destination_coords: tuple[float, float] = Field(description="(lat, lon) target destination")
    max_traversable_slope_deg: float = Field(default=15.0, description="Hard safety constraint in degrees")
    strategies: list[RouteStrategy] = Field(
        default_factory=lambda: [RouteStrategy.FASTEST, RouteStrategy.SAFEST],
        description="Routing strategies to calculate and compare",
    )


class RouteResult(BaseModel):
    """Calculated path result for a specific strategy."""

    strategy: RouteStrategy
    feasible: bool
    total_distance_km: float
    total_cost: float
    avg_slope_deg: float
    max_slope_deg: float
    elevation_change_m: float
    elevation_profile: list[float]
    path_coords: list[tuple[float, float]]
    waypoints: list[Waypoint]
    explanation: str
    limitations_note: str


class RouteComparisonResponse(BaseModel):
    """Comparison response across calculated mission routes."""

    sector_id: str
    start_coords: tuple[float, float]
    destination_coords: tuple[float, float]
    routes: dict[RouteStrategy, RouteResult]
    summary: str
