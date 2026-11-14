from typing import Any
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
    scientific_value: float = Field(default=0.0, description="Scientific interest score [0-1]")
    science_target_name: str | None = Field(default=None, description="Identified geological science target or POI")
    wind_speed_ms: float = Field(default=0.0, description="Local wind speed encountered in m/s")
    dust_tau: float = Field(default=0.4, description="Local dust optical depth tau")
    storm_hazard_level: float = Field(default=0.0, description="Local storm hazard score [0-1]")


class RoutePlanRequest(BaseModel):
    """Request model for planning mission exploration routes."""

    sector_id: str
    start_coords: tuple[float, float] = Field(description="(lat, lon) start point")
    destination_coords: tuple[float, float] = Field(description="(lat, lon) target destination")
    max_traversable_slope_deg: float = Field(default=15.0, description="Hard safety constraint in degrees")
    strategies: list[RouteStrategy] = Field(
        default_factory=lambda: [
            RouteStrategy.FASTEST,
            RouteStrategy.SAFEST,
            RouteStrategy.SCIENTIFIC_EXPLORATION,
        ],
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
    scientific_roi_score: float = Field(default=0.0, description="Aggregated scientific return score")
    scientific_targets_visited: list[str] = Field(
        default_factory=list, description="Names of scientific POIs along route"
    )
    max_wind_speed_ms: float = Field(default=0.0, description="Peak wind speed encountered along route")
    avg_dust_opacity_tau: float = Field(default=0.4, description="Average dust optical depth tau")
    storm_hazard_avoided: bool = Field(default=False, description="Whether route successfully navigated around active storms")
    storm_status: str = Field(default="CLEAR", description="Atmospheric hazard status along route")


class RouteComparisonResponse(BaseModel):
    """Comparison response across calculated mission routes."""

    sector_id: str
    start_coords: tuple[float, float]
    destination_coords: tuple[float, float]
    routes: dict[RouteStrategy, RouteResult]
    summary: str
    benchmark_traverse: dict[str, Any] | None = None
