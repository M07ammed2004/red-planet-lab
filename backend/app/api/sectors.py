from pathlib import Path
from fastapi import APIRouter, HTTPException
from backend.app.core.config import settings
from backend.app.models.product import NormalizedProduct
from backend.app.models.sector import Sector
from backend.app.services.sector_service import sector_service

router = APIRouter(prefix="/sectors", tags=["Sectors"])


@router.get("", response_model=list[Sector])
async def list_sectors() -> list[Sector]:
    """Retrieve all defined Mars exploration sectors."""
    return sector_service.get_sectors()


@router.get("/{sector_id}", response_model=Sector)
async def get_sector(sector_id: str) -> Sector:
    """Retrieve metadata and current state for a specific sector."""
    sector = sector_service.get_sector(sector_id)
    if not sector:
        raise HTTPException(status_code=404, detail=f"Sector '{sector_id}' not found")
    return sector


@router.post("/{sector_id}/scan", response_model=Sector)
async def scan_sector(sector_id: str) -> Sector:
    """
    Trigger automated discovery of orbital archive products (MOLA, HiRISE)
    covering the sector bounds.
    """
    sector = sector_service.get_sector(sector_id)
    if not sector:
        raise HTTPException(status_code=404, detail=f"Sector '{sector_id}' not found")
    try:
        updated_sector = await sector_service.scan_sector(sector_id)
        return updated_sector
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed scanning sector: {e}")


@router.get("/{sector_id}/products", response_model=list[NormalizedProduct])
async def get_sector_products(sector_id: str) -> list[NormalizedProduct]:
    """Retrieve candidate products discovered for the sector."""
    sector = sector_service.get_sector(sector_id)
    if not sector:
        raise HTTPException(status_code=404, detail=f"Sector '{sector_id}' not found")
    return sector.source_products


@router.post("/{sector_id}/download-dem")
async def download_sector_dem(sector_id: str):
    """
    Automatically select the best elevation model (DEM) and download it
    into the sector's raw storage directory.
    """
    sector = sector_service.get_sector(sector_id)
    if not sector:
        raise HTTPException(status_code=404, detail=f"Sector '{sector_id}' not found")
    try:
        manifest = await sector_service.download_sector_dem(sector_id)
        return {
            "status": "success",
            "sector_id": sector_id,
            "manifest": manifest,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed downloading sector DEM: {e}")


@router.get("/{sector_id}/manifest")
async def get_sector_manifest(sector_id: str):
    """Retrieve the provenance manifest of downloaded products for the sector."""
    manifest_path = settings.DATA_METADATA_DIR / f"{sector_id}_manifest.json"
    if not manifest_path.exists():
        raise HTTPException(status_code=404, detail=f"No manifest found for sector '{sector_id}'")
    import json
    with open(manifest_path, "r", encoding="utf-8") as f:
        return json.load(f)
