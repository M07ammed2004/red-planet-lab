import os
from pathlib import Path
import shutil
from fastapi import APIRouter, HTTPException, Query
from backend.app.core.config import settings

router = APIRouter(prefix="/storage", tags=["Storage"])


def _get_dir_size(path: Path) -> int:
    """Calculate total byte size of all files within a directory."""
    if not path.exists():
        return 0
    total = 0
    for root, _, files in os.walk(path):
        for f in files:
            fp = os.path.join(root, f)
            try:
                total += os.path.getsize(fp)
            except OSError:
                pass
    return total


@router.get("/status")
async def get_storage_status():
    """
    Query real disk usage and storage tier telemetry across raw, processed,
    and cache directories.
    """
    base_dir = settings.BASE_DIR
    try:
        disk = shutil.disk_usage(base_dir)
        total_disk_bytes = disk.total
        free_disk_bytes = disk.free
        used_disk_bytes = disk.used
    except Exception:
        total_disk_bytes = 0
        free_disk_bytes = 0
        used_disk_bytes = 0

    raw_bytes = _get_dir_size(settings.DATA_RAW_DIR)
    processed_bytes = _get_dir_size(settings.DATA_PROCESSED_DIR)
    cache_bytes = _get_dir_size(settings.DATA_CACHE_DIR)
    metadata_bytes = _get_dir_size(settings.DATA_METADATA_DIR)

    return {
        "disk": {
            "total_bytes": total_disk_bytes,
            "free_bytes": free_disk_bytes,
            "used_bytes": used_disk_bytes,
            "free_gb": round(free_disk_bytes / (1024**3), 2),
            "used_gb": round(used_disk_bytes / (1024**3), 2),
        },
        "tiers": {
            "raw_bytes": raw_bytes,
            "raw_mb": round(raw_bytes / (1024**2), 2),
            "processed_bytes": processed_bytes,
            "processed_mb": round(processed_bytes / (1024**2), 2),
            "cache_bytes": cache_bytes,
            "cache_mb": round(cache_bytes / (1024**2), 2),
            "metadata_bytes": metadata_bytes,
            "metadata_mb": round(metadata_bytes / (1024**2), 2),
        },
        "limits": {
            "max_sector_download_mb": settings.MAX_SECTOR_DOWNLOAD_MB,
            "max_cache_total_mb": settings.MAX_CACHE_TOTAL_MB,
        },
    }


@router.delete("/cache/{sector_id}")
async def purge_sector_cache(
    sector_id: str,
    purge_raw: bool = Query(True, description="Also remove raw download files"),
    purge_processed: bool = Query(False, description="Purge processed visualization layers"),
):
    """
    Safely purge cached downloads and raw sector files to free disk space.
    Never deletes processed layers unless explicitly commanded with purge_processed=True.
    """
    deleted_files = []
    freed_bytes = 0

    # 1. Clean shared cache references if any sector-specific file exists
    sector_cache = settings.DATA_CACHE_DIR / sector_id
    if sector_cache.exists():
        size = _get_dir_size(sector_cache)
        shutil.rmtree(sector_cache, ignore_errors=True)
        freed_bytes += size
        deleted_files.append(str(sector_cache))

    # 2. Clean temporary .part files anywhere in data/
    for p in settings.BASE_DIR.glob("data/**/*.part"):
        try:
            sz = p.stat().st_size
            p.unlink()
            freed_bytes += sz
            deleted_files.append(str(p))
        except OSError:
            pass

    # 3. Clean raw directory for sector if requested
    if purge_raw:
        sector_raw = settings.DATA_RAW_DIR / sector_id
        if sector_raw.exists():
            size = _get_dir_size(sector_raw)
            shutil.rmtree(sector_raw, ignore_errors=True)
            freed_bytes += size
            deleted_files.append(str(sector_raw))

    # 4. Clean processed directory only if explicitly commanded
    if purge_processed:
        sector_proc = settings.DATA_PROCESSED_DIR / sector_id
        if sector_proc.exists():
            size = _get_dir_size(sector_proc)
            shutil.rmtree(sector_proc, ignore_errors=True)
            freed_bytes += size
            deleted_files.append(str(sector_proc))

    return {
        "status": "success",
        "sector_id": sector_id,
        "freed_bytes": freed_bytes,
        "freed_mb": round(freed_bytes / (1024**2), 2),
        "deleted_paths": deleted_files,
    }
