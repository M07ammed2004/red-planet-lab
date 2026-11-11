import asyncio
import json
import logging
import os
import shutil
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
import httpx
from backend.app.core.config import settings
from backend.app.models.product import NormalizedProduct, ProductFile

logger = logging.getLogger(__name__)


class DownloadError(Exception):
    """Exception raised when a download fails."""
    pass


class StorageLimitExceeded(DownloadError):
    """Exception raised when available disk space is insufficient."""
    pass


class Downloader:
    """Handles automated, atomic, bounded downloads with manifest recording."""

    def __init__(
        self,
        raw_dir: Path | None = None,
        metadata_dir: Path | None = None,
        max_retries: int | None = None,
        timeout: int | None = None,
    ):
        self.raw_dir = raw_dir or settings.DATA_RAW_DIR
        self.metadata_dir = metadata_dir or settings.DATA_METADATA_DIR
        self.max_retries = max_retries or settings.MAX_DOWNLOAD_RETRIES
        self.timeout = timeout or settings.REQUEST_TIMEOUT_SECONDS

        # Ensure target directories exist
        self.raw_dir.mkdir(parents=True, exist_ok=True)
        self.metadata_dir.mkdir(parents=True, exist_ok=True)

    def check_disk_space(self, required_bytes: int, safety_margin_mb: int = 500) -> bool:
        """Verify that the target drive has enough free disk space with a safety margin."""
        try:
            total, used, free = shutil.disk_usage(self.raw_dir)
            margin_bytes = safety_margin_mb * 1024 * 1024
            if free < (required_bytes + margin_bytes):
                raise StorageLimitExceeded(
                    f"Insufficient disk space on {self.raw_dir}. Free: {free // (1024 * 1024)} MB, "
                    f"Required: {(required_bytes + margin_bytes) // (1024 * 1024)} MB"
                )
            return True
        except Exception as e:
            if isinstance(e, StorageLimitExceeded):
                raise
            logger.warning(f"Unable to check disk space: {e}")
            return True

    async def download_file(
        self,
        file_obj: ProductFile,
        destination_dir: Path,
    ) -> Path:
        """Download a single product file atomically using a .part temporary file."""
        destination_dir.mkdir(parents=True, exist_ok=True)
        target_path = destination_dir / file_obj.filename
        part_path = destination_dir / f"{file_obj.filename}.part"

        # If already downloaded and valid, return existing
        if target_path.exists() and target_path.stat().st_size > 0:
            if file_obj.size_bytes > 0 and target_path.stat().st_size == file_obj.size_bytes:
                logger.info(f"File {file_obj.filename} already downloaded and verified.")
                return target_path

        # Check disk space
        self.check_disk_space(required_bytes=file_obj.size_bytes)

        attempt = 0
        backoff_seconds = 2

        while attempt < self.max_retries:
            attempt += 1
            try:
                logger.info(f"Downloading {file_obj.filename} (attempt {attempt}/{self.max_retries})...")
                async with httpx.AsyncClient(timeout=self.timeout, follow_redirects=True) as client:
                    async with client.stream("GET", file_obj.url) as response:
                        response.raise_for_status()
                        with open(part_path, "wb") as f:
                            async for chunk in response.aiter_bytes(chunk_size=65536):
                                f.write(chunk)

                # Atomic replace
                if part_path.exists():
                    if target_path.exists():
                        target_path.unlink()
                    part_path.rename(target_path)

                logger.info(f"Successfully downloaded {file_obj.filename} ({target_path.stat().st_size} bytes).")
                return target_path

            except Exception as e:
                logger.warning(f"Download attempt {attempt} failed for {file_obj.filename}: {e}")
                if part_path.exists():
                    try:
                        part_path.unlink()
                    except Exception:
                        pass
                if attempt >= self.max_retries:
                    raise DownloadError(f"Failed to download {file_obj.filename} after {self.max_retries} attempts: {e}")
                await asyncio.sleep(backoff_seconds)
                backoff_seconds *= 2

        raise DownloadError(f"Failed to download {file_obj.filename}")

    async def download_product(
        self,
        sector_id: str,
        product: NormalizedProduct,
        files_to_download: list[ProductFile] | None = None,
    ) -> dict[str, Any]:
        """Download selected files for a product and generate a provenance manifest."""
        target_dir = self.raw_dir / sector_id
        target_dir.mkdir(parents=True, exist_ok=True)

        files = files_to_download if files_to_download is not None else product.files
        if not files:
            raise DownloadError(f"Product {product.product_id} has no download files specified.")

        total_download_bytes = sum(f.size_bytes for f in files)
        max_bytes = settings.MAX_SECTOR_DOWNLOAD_MB * 1024 * 1024
        if total_download_bytes > max_bytes:
            raise StorageLimitExceeded(
                f"Download size {total_download_bytes // (1024 * 1024)} MB exceeds max sector budget "
                f"of {settings.MAX_SECTOR_DOWNLOAD_MB} MB"
            )

        downloaded_paths: list[str] = []
        for file_info in files:
            path = await self.download_file(file_info, target_dir)
            downloaded_paths.append(str(path))

        # Build provenance manifest
        manifest = {
            "sector_id": sector_id,
            "product_id": product.product_id,
            "source_archive": product.source_archive,
            "mission": product.mission,
            "instrument": product.instrument,
            "product_type": product.product_type,
            "description": product.description,
            "download_timestamp": datetime.now(timezone.utc).isoformat(),
            "target_dir": str(target_dir),
            "files": [
                {
                    "filename": f.filename,
                    "url": f.url,
                    "size_bytes": f.size_bytes,
                    "file_type": f.file_type.value,
                    "local_path": str(target_dir / f.filename),
                    "exists": (target_dir / f.filename).exists(),
                    "actual_size_bytes": (target_dir / f.filename).stat().st_size if (target_dir / f.filename).exists() else 0,
                }
                for f in files
            ],
            "spatial_footprint": product.spatial_footprint.model_dump(),
        }

        # Save manifest
        manifest_path = self.metadata_dir / f"{sector_id}_manifest.json"
        with open(manifest_path, "w", encoding="utf-8") as f:
            json.dump(manifest, f, indent=2)

        logger.info(f"Saved sector manifest to {manifest_path}")
        return manifest
