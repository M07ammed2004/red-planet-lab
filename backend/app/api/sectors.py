import json
from pathlib import Path
from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
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
    with open(manifest_path, "r", encoding="utf-8") as f:
        return json.load(f)


@router.post("/{sector_id}/process")
async def process_sector_dem(sector_id: str):
    """
    Process downloaded DEM: crop to sector bounds, calculate Slope in degrees,
    compute Roughness, and export visualization-ready layers.
    Transitions sector state to DISCOVERED.
    """
    sector = sector_service.get_sector(sector_id)
    if not sector:
        raise HTTPException(status_code=404, detail=f"Sector '{sector_id}' not found")
    try:
        result = await sector_service.process_sector_dem(sector_id)
        return {
            "status": "success",
            "sector_id": sector_id,
            "result": result,
        }
    except FileNotFoundError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed processing sector DEM: {e}")


@router.get("/{sector_id}/layers/{layer_type}")
async def get_sector_layer_data(sector_id: str, layer_type: str):
    """
    Retrieve processed grid data, statistics, and metadata for a specific layer
    (e.g., 'elevation', 'slope', 'roughness').
    """
    layer_json = settings.DATA_PROCESSED_DIR / sector_id / f"{layer_type}.json"
    if not layer_json.exists():
        raise HTTPException(
            status_code=404,
            detail=f"Layer '{layer_type}' has not been processed for sector '{sector_id}'",
        )
    with open(layer_json, "r", encoding="utf-8") as f:
        return json.load(f)


@router.get("/{sector_id}/layers/{layer_type}/preview")
async def get_sector_layer_preview(sector_id: str, layer_type: str):
    """Serve colorized PNG raster preview of the processed layer."""
    layer_png = settings.DATA_PROCESSED_DIR / sector_id / f"{layer_type}.png"
    if not layer_png.exists():
        raise HTTPException(
            status_code=404,
            detail=f"Preview for layer '{layer_type}' not found for sector '{sector_id}'",
        )
    return FileResponse(layer_png, media_type="image/png")


@router.post("/{sector_id}/explore")
async def explore_sector(sector_id: str):
    """
    On-demand automated exploration endpoint.
    Checks local cache for high-resolution 3D terrain assets; if missing, initiates
    background acquisition of MOLA 128 DEM, Viking texture draping, and mesh reconstruction.
    """
    sector = sector_service.get_sector(sector_id)
    if not sector:
        raise HTTPException(status_code=404, detail=f"Sector '{sector_id}' not found")
    try:
        result = await sector_service.start_exploration_pipeline(sector_id)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to start exploration pipeline: {e}")


@router.get("/{sector_id}/terrain-mesh")
async def get_sector_terrain_mesh(sector_id: str):
    """Retrieve the high-resolution 3D terrain mesh data and geomorphometric layers."""
    mesh_path = settings.DATA_PROCESSED_DIR / sector_id / "terrain_mesh.json"
    if not mesh_path.exists():
        raise HTTPException(
            status_code=404,
            detail=f"Terrain mesh not found for sector '{sector_id}'. Initiate exploration first.",
        )
    with open(mesh_path, "r", encoding="utf-8") as f:
        return json.load(f)


@router.get("/{sector_id}/texture")
async def get_sector_surface_texture(sector_id: str):
    """Serve georeferenced orbital surface texture for 3D terrain draping."""
    texture_path = settings.DATA_PROCESSED_DIR / sector_id / "surface_texture.png"
    if not texture_path.exists():
        raise HTTPException(
            status_code=404,
            detail=f"Surface texture not found for sector '{sector_id}'. Initiate exploration first.",
        )
    return FileResponse(texture_path, media_type="image/png")
