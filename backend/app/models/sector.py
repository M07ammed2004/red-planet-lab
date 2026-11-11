from datetime import datetime, timezone
from enum import Enum
from pydantic import BaseModel, Field
from backend.app.models.product import NormalizedProduct


class SectorState(str, Enum):
    UNSCOUTED = "UNSCOUTED"
    SCANNING = "SCANNING"
    DATA_FOUND = "DATA_FOUND"
    DOWNLOADING = "DOWNLOADING"
    PROCESSING = "PROCESSING"
    DISCOVERED = "DISCOVERED"
    PARTIALLY_DISCOVERED = "PARTIALLY_DISCOVERED"
    FAILED = "FAILED"


class LayerType(str, Enum):
    IMAGERY = "imagery"
    ELEVATION = "elevation"
    SLOPE = "slope"
    ROUGHNESS = "roughness"
    THERMAL = "thermal"
    MINERAL = "mineral"
    RISK = "risk"
    SCIENTIFIC_INTEREST = "scientific_interest"


class LayerStatus(str, Enum):
    NOT_CHECKED = "NOT_CHECKED"
    SEARCHING = "SEARCHING"
    AVAILABLE = "AVAILABLE"
    DOWNLOADING = "DOWNLOADING"
    PROCESSING = "PROCESSING"
    READY = "READY"
    UNAVAILABLE = "UNAVAILABLE"
    FAILED = "FAILED"


class LayerState(BaseModel):
    """Status and metadata for an individual sector layer."""

    layer_type: LayerType
    status: LayerStatus = LayerStatus.NOT_CHECKED
    source_product_id: str | None = None
    file_path: str | None = None
    resolution_m: float | None = None
    last_updated: datetime | None = None
    error_message: str | None = None


class SectorBounds(BaseModel):
    """Bounding box in Mars geographic coordinates (degrees)."""

    min_lat: float = Field(..., ge=-90.0, le=90.0)
    max_lat: float = Field(..., ge=-90.0, le=90.0)
    min_lon: float = Field(..., ge=-180.0, le=360.0)
    max_lon: float = Field(..., ge=-180.0, le=360.0)


class Sector(BaseModel):
    """Mars exploration sector model."""

    sector_id: str
    name: str
    bounds: SectorBounds
    center: tuple[float, float] = Field(description="(lat, lon) center coordinates")
    area_km2: float = Field(default=0.0, description="Approximate surface area in square km")
    coordinate_reference_system: str = Field(default="IAU2000:49900", description="Mars geographic CRS")
    state: SectorState = SectorState.UNSCOUTED
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    last_scan_at: datetime | None = None
    available_layers: list[LayerType] = Field(default_factory=list)
    missing_layers: list[LayerType] = Field(default_factory=list)
    layers: dict[LayerType, LayerState] = Field(default_factory=dict)
    source_products: list[NormalizedProduct] = Field(default_factory=list)
    estimated_download_bytes: int = 0
    processing_version: str = "0.1.0"
    error_message: str | None = None
