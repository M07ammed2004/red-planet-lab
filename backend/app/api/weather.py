from fastapi import APIRouter, HTTPException
from backend.app.models.weather import (
    SectorWeatherCondition,
    WeatherSimRequest,
)
from backend.app.weather.atmospheric_service import atmospheric_service

router = APIRouter(prefix="/weather", tags=["weather"])


@router.get("/sector/{sector_id}", response_model=SectorWeatherCondition)
async def get_sector_weather(sector_id: str) -> SectorWeatherCondition:
    """Retrieve current in-situ atmospheric and storm telemetry for a sector."""
    return atmospheric_service.get_sector_weather(sector_id)


@router.post("/simulate", response_model=SectorWeatherCondition)
async def simulate_sector_weather(request: WeatherSimRequest) -> SectorWeatherCondition:
    """Configure or inject an active Martian dust storm / gale into the sector."""
    return atmospheric_service.configure_storm(
        sector_id=request.sector_id,
        severity=request.severity,
        center_lat=request.custom_storm_lat,
        center_lon=request.custom_storm_lon,
        radius_km=request.custom_radius_km,
    )
