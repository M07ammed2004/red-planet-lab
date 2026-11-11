from datetime import datetime, timezone
from fastapi import APIRouter
from backend.app.core.config import settings
from backend.app.models.health import HealthResponse

router = APIRouter(tags=["Health"])


@router.get("/health", response_model=HealthResponse)
async def get_health() -> HealthResponse:
    """Return system health status and storage directory readiness."""
    storage_status = {
        "raw_dir": settings.DATA_RAW_DIR.exists(),
        "processed_dir": settings.DATA_PROCESSED_DIR.exists(),
        "cache_dir": settings.DATA_CACHE_DIR.exists(),
        "metadata_dir": settings.DATA_METADATA_DIR.exists(),
    }

    return HealthResponse(
        status="ok",
        version=settings.VERSION,
        timestamp=datetime.now(timezone.utc),
        storage=storage_status,
    )
