import logging
from datetime import datetime, timezone
from typing import Any
from backend.app.data_engine.adapters.ode_adapter import ODEAdapter
from backend.app.data_engine.downloader import Downloader
from backend.app.data_engine.product_selector import ProductSelector
from backend.app.models.sector import (
    LayerState,
    LayerStatus,
    LayerType,
    Sector,
    SectorBounds,
    SectorState,
)

logger = logging.getLogger(__name__)


class SectorService:
    """Service for managing Mars sectors, scouting jobs, and data pipeline execution."""

    def __init__(self):
        self.ode_adapter = ODEAdapter()
        self.product_selector = ProductSelector()
        self.downloader = Downloader()
        self._sectors: dict[str, Sector] = {}
        self._init_default_sectors()

    def _init_default_sectors(self):
        """Seed initial high-interest exploration sectors with known orbital coverage."""
        # Jezero Crater (Perseverance Landing Site)
        jezero = Sector(
            sector_id="SEC-JEZERO-01",
            name="Jezero Crater (Delta & Crater Floor)",
            bounds=SectorBounds(min_lat=18.0, max_lat=19.0, min_lon=77.0, max_lon=78.0),
            center=(18.38, 77.58),
            area_km2=3520.0,
            coordinate_reference_system="IAU2000:49900",
            state=SectorState.UNSCOUTED,
            layers={
                LayerType.ELEVATION: LayerState(layer_type=LayerType.ELEVATION, status=LayerStatus.NOT_CHECKED),
                LayerType.IMAGERY: LayerState(layer_type=LayerType.IMAGERY, status=LayerStatus.NOT_CHECKED),
                LayerType.SLOPE: LayerState(layer_type=LayerType.SLOPE, status=LayerStatus.NOT_CHECKED),
                LayerType.ROUGHNESS: LayerState(layer_type=LayerType.ROUGHNESS, status=LayerStatus.NOT_CHECKED),
                LayerType.RISK: LayerState(layer_type=LayerType.RISK, status=LayerStatus.NOT_CHECKED),
                LayerType.SCIENTIFIC_INTEREST: LayerState(layer_type=LayerType.SCIENTIFIC_INTEREST, status=LayerStatus.NOT_CHECKED),
            },
        )

        # Gale Crater (Curiosity Landing Site)
        gale = Sector(
            sector_id="SEC-GALE-01",
            name="Gale Crater (Aeolis Mons / Mount Sharp)",
            bounds=SectorBounds(min_lat=-6.0, max_lat=-5.0, min_lon=137.0, max_lon=138.0),
            center=(-5.4, 137.8),
            area_km2=3540.0,
            coordinate_reference_system="IAU2000:49900",
            state=SectorState.UNSCOUTED,
            layers={
                LayerType.ELEVATION: LayerState(layer_type=LayerType.ELEVATION, status=LayerStatus.NOT_CHECKED),
                LayerType.IMAGERY: LayerState(layer_type=LayerType.IMAGERY, status=LayerStatus.NOT_CHECKED),
                LayerType.SLOPE: LayerState(layer_type=LayerType.SLOPE, status=LayerStatus.NOT_CHECKED),
                LayerType.ROUGHNESS: LayerState(layer_type=LayerType.ROUGHNESS, status=LayerStatus.NOT_CHECKED),
                LayerType.RISK: LayerState(layer_type=LayerType.RISK, status=LayerStatus.NOT_CHECKED),
                LayerType.SCIENTIFIC_INTEREST: LayerState(layer_type=LayerType.SCIENTIFIC_INTEREST, status=LayerStatus.NOT_CHECKED),
            },
        )

        self._sectors[jezero.sector_id] = jezero
        self._sectors[gale.sector_id] = gale

    def get_sectors(self) -> list[Sector]:
        """Return all registered sectors."""
        return list(self._sectors.values())

    def get_sector(self, sector_id: str) -> Sector | None:
        """Retrieve a specific sector by ID."""
        return self._sectors.get(sector_id)

    async def scan_sector(self, sector_id: str) -> Sector:
        """
        Execute automated orbital archive discovery for the sector.
        Transitions: UNSCOUTED -> SCANNING -> DATA_FOUND (or FAILED).
        """
        sector = self.get_sector(sector_id)
        if not sector:
            raise ValueError(f"Sector {sector_id} not found")

        sector.state = SectorState.SCANNING
        sector.updated_at = datetime.now(timezone.utc)
        sector.layers[LayerType.ELEVATION].status = LayerStatus.SEARCHING
        sector.layers[LayerType.IMAGERY].status = LayerStatus.SEARCHING

        try:
            # Discover MOLA DEM
            mola_candidates = await self.ode_adapter.query_mola_topography(sector.bounds, limit=3)
            # Discover HiRISE imagery
            hirise_candidates = await self.ode_adapter.query_hirise_imagery(sector.bounds, limit=3)

            all_candidates = mola_candidates + hirise_candidates
            sector.source_products = all_candidates
            sector.last_scan_at = datetime.now(timezone.utc)
            sector.updated_at = datetime.now(timezone.utc)

            # Update layer statuses based on discovered candidates
            if mola_candidates:
                sector.layers[LayerType.ELEVATION].status = LayerStatus.AVAILABLE
                sector.layers[LayerType.ELEVATION].source_product_id = mola_candidates[0].product_id
            else:
                sector.layers[LayerType.ELEVATION].status = LayerStatus.UNAVAILABLE

            if hirise_candidates:
                sector.layers[LayerType.IMAGERY].status = LayerStatus.AVAILABLE
                sector.layers[LayerType.IMAGERY].source_product_id = hirise_candidates[0].product_id
            else:
                sector.layers[LayerType.IMAGERY].status = LayerStatus.UNAVAILABLE

            if all_candidates:
                sector.state = SectorState.DATA_FOUND
                sector.estimated_download_bytes = sum(p.estimated_download_bytes for p in all_candidates)
            else:
                sector.state = SectorState.FAILED
                sector.error_message = "No orbital products found covering sector coordinates"

            return sector

        except Exception as e:
            logger.error(f"Failed scanning sector {sector_id}: {e}")
            sector.state = SectorState.FAILED
            sector.error_message = str(e)
            sector.updated_at = datetime.now(timezone.utc)
            raise

    async def download_sector_dem(self, sector_id: str) -> dict[str, Any]:
        """
        Automatically select the best DEM and download it.
        Transitions: DATA_FOUND -> DOWNLOADING -> PARTIALLY_DISCOVERED.
        """
        sector = self.get_sector(sector_id)
        if not sector:
            raise ValueError(f"Sector {sector_id} not found")

        if sector.state not in (SectorState.DATA_FOUND, SectorState.PARTIALLY_DISCOVERED, SectorState.DISCOVERED):
            # Scan first if not yet scanned
            await self.scan_sector(sector_id)

        mola_candidates = [p for p in sector.source_products if p.instrument == "MOLA"]
        selection = self.product_selector.select_best_dem(mola_candidates)
        if not selection:
            raise ValueError(f"No suitable DEM candidate found for sector {sector_id}")

        selected_product, files_to_download = selection

        sector.state = SectorState.DOWNLOADING
        sector.layers[LayerType.ELEVATION].status = LayerStatus.DOWNLOADING
        sector.updated_at = datetime.now(timezone.utc)

        try:
            manifest = await self.downloader.download_product(
                sector_id=sector_id,
                product=selected_product,
                files_to_download=files_to_download,
            )

            # Update layer and sector states
            sector.layers[LayerType.ELEVATION].status = LayerStatus.READY
            sector.layers[LayerType.ELEVATION].file_path = manifest["files"][0]["local_path"]
            sector.available_layers.append(LayerType.ELEVATION)
            sector.state = SectorState.PARTIALLY_DISCOVERED
            sector.updated_at = datetime.now(timezone.utc)

            return manifest

        except Exception as e:
            logger.error(f"Download failed for sector {sector_id}: {e}")
            sector.state = SectorState.FAILED
            sector.layers[LayerType.ELEVATION].status = LayerStatus.FAILED
            sector.layers[LayerType.ELEVATION].error_message = str(e)
            sector.error_message = str(e)
            sector.updated_at = datetime.now(timezone.utc)
            raise


# Global singleton instance for the service
sector_service = SectorService()
