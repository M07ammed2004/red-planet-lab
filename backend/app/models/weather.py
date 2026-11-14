from enum import Enum
from pydantic import BaseModel, Field


class StormSeverity(str, Enum):
    CALM = "CALM"
    MODERATE_DUST = "MODERATE_DUST"
    SEVERE_STORM = "SEVERE_STORM"
    GLOBAL_EVENT = "GLOBAL_EVENT"


class WindVector(BaseModel):
    """Local wind velocity and direction vector."""

    speed_ms: float = Field(description="Wind speed in meters per second")
    direction_deg: float = Field(description="Wind azimuth direction 0-360 degrees")
    gust_ms: float = Field(description="Peak gust speed in meters per second")
    u_component: float = Field(description="Eastward wind velocity component")
    v_component: float = Field(description="Northward wind velocity component")


class StormCell(BaseModel):
    """Dynamic Martian dust storm or convective front."""

    cell_id: str
    name: str
    center_lat: float
    center_lon: float
    radius_km: float = Field(description="Storm radius in kilometers")
    severity: StormSeverity = StormSeverity.MODERATE_DUST
    max_wind_speed_ms: float = Field(description="Maximum wind speed in storm core in m/s")
    optical_depth_tau: float = Field(description="Atmospheric dust optical depth [0.2 - 5.0+]")
    dust_density_g_m3: float = Field(default=0.005, description="Estimated dust mass loading")
    is_active: bool = True


class SectorWeatherCondition(BaseModel):
    """Complete atmospheric and meteorological telemetry for a sector."""

    sector_id: str
    sol: int
    local_mars_time: str
    solar_longitude_ls: float = Field(description="Season: solar longitude 0-360 degrees")
    air_temperature_c: float
    ground_temperature_c: float
    atmospheric_pressure_pa: float
    dust_optical_depth_tau: float = Field(description="Sector-wide baseline optical depth")
    prevailing_wind: WindVector
    storm_severity: StormSeverity = StormSeverity.CALM
    active_storms: list[StormCell] = Field(default_factory=list)
    atmospheric_density_kg_m3: float = 0.015
    sensor_station_name: str = "MEDA/REMS In-situ Telemetry Station"


class WeatherSimRequest(BaseModel):
    """Request to inject or configure a storm scenario in a sector."""

    sector_id: str
    severity: StormSeverity = StormSeverity.MODERATE_DUST
    custom_storm_lat: float | None = None
    custom_storm_lon: float | None = None
    custom_radius_km: float | None = None
