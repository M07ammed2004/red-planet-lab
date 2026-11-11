from datetime import datetime
from enum import Enum
from pydantic import BaseModel, Field


class ProductFileType(str, Enum):
    PRODUCT = "Product"
    LABEL = "Label"
    HEADER = "Header"
    DERIVED = "Derived"
    BROWSE = "Browse"
    DOCUMENT = "Document"
    REFERENCED = "Referenced"
    UNKNOWN = "Unknown"


class ProductFile(BaseModel):
    """File component of an archive product."""

    filename: str
    url: str
    size_bytes: int = Field(default=0, description="File size in bytes")
    file_type: ProductFileType = ProductFileType.UNKNOWN
    description: str | None = None


class SpatialFootprint(BaseModel):
    """Spatial bounding box and geometry."""

    min_lat: float
    max_lat: float
    western_lon: float
    eastern_lon: float
    center_lat: float | None = None
    center_lon: float | None = None
    geometry_wkt: str | None = None


class NormalizedProduct(BaseModel):
    """Normalized planetary science data product record."""

    product_id: str
    source_archive: str = Field(default="ODE", description="Source archive or registry")
    mission: str = Field(description="Mission or spacecraft (e.g., MGS, MRO)")
    instrument: str = Field(description="Instrument ID (e.g., MOLA, HIRISE)")
    product_type: str = Field(description="Product type code (e.g., MEGDR, RDRV11)")
    description: str | None = None
    spatial_footprint: SpatialFootprint
    pixel_scale_meters: float | None = Field(default=None, description="Resolution in meters/pixel")
    observation_time: datetime | None = None
    product_url: str | None = None
    label_url: str | None = None
    files: list[ProductFile] = Field(default_factory=list)
    quality_flags: dict[str, str | int | float | bool] = Field(default_factory=dict)
    estimated_download_bytes: int = Field(default=0)
