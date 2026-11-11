from datetime import datetime
from pydantic import BaseModel, Field


class HealthResponse(BaseModel):
    """Schema for health status endpoint."""

    status: str = Field(default="ok", description="Overall service status")
    version: str = Field(description="Application version")
    timestamp: datetime = Field(description="Current UTC timestamp")
    storage: dict[str, bool] = Field(
        default_factory=dict,
        description="Verification of required storage directories",
    )
