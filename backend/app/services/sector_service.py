import asyncio
import logging
import shutil
from datetime import datetime, timezone
from typing import Any
from backend.app.core.config import settings
from backend.app.data_engine.adapters.ode_adapter import ODEAdapter
from backend.app.data_engine.downloader import Downloader
from backend.app.data_engine.highres_downloader import highres_downloader
from backend.app.data_engine.product_selector import ProductSelector
from backend.app.jobs.job_manager import JobStage, job_manager
from backend.app.processing.dem_reader import DEMReader
from backend.app.processing.layer_exporter import LayerExporter
from backend.app.processing.terrain_3d_builder import terrain_3d_builder
from backend.app.processing.terrain_metrics import compute_roughness, compute_slope
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
        self.dem_reader = DEMReader()
        self.layer_exporter = LayerExporter()
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

        # Seed other verified exploration sites
        additional_sites = [
            ("SEC-OLYMPUS-01", "Olympus Mons", (18.65, 226.2), SectorBounds(min_lat=17.5, max_lat=19.5, min_lon=225.0, max_lon=227.5), 12500.0),
            ("SEC-VALLES-01", "Valles Marineris (Candor Chasma)", (-6.5, 284.0), SectorBounds(min_lat=7.5 * -1, max_lat=5.5 * -1, min_lon=283.0, max_lon=285.0), 8900.0),
            ("SEC-ARCADIA-01", "Arcadia Planitia", (39.3, 189.7), SectorBounds(min_lat=38.5, max_lat=40.5, min_lon=188.5, max_lon=191.0), 7400.0),
            ("SEC-ELYSIUM-01", "Elysium Planitia", (4.5, 135.6), SectorBounds(min_lat=3.5, max_lat=5.5, min_lon=134.5, max_lon=137.0), 7100.0),
            ("SEC-MERIDIANI-01", "Meridiani Planum", (-0.19, 354.47), SectorBounds(min_lat=-1.0, max_lat=0.5, min_lon=353.5, max_lon=355.5), 4800.0),
            ("SEC-GUSEV-01", "Gusev Crater", (-14.57, 175.47), SectorBounds(min_lat=-15.5, max_lat=-13.5, min_lon=174.5, max_lon=176.5), 5200.0),
        ]

        for s_id, s_name, s_center, s_bounds, s_area in additional_sites:
            self._sectors[s_id] = Sector(
                sector_id=s_id,
                name=s_name,
                bounds=s_bounds,
                center=s_center,
                area_km2=s_area,
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

        # Synchronize sector states with existing processed assets on disk
        for sec in self._sectors.values():
            if self.is_sector_ready_3d(sec.sector_id):
                sec.state = SectorState.DISCOVERED
                for lt in [LayerType.ELEVATION, LayerType.SLOPE, LayerType.ROUGHNESS, LayerType.IMAGERY]:
                    sec.layers[lt].status = LayerStatus.READY
                    if lt not in sec.available_layers:
                        sec.available_layers.append(lt)

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

    async def process_sector_dem(self, sector_id: str) -> dict[str, Any]:
        """
        Parse downloaded DEM raster, crop to sector bounds, compute slope & roughness,
        and export visualization-ready layers.
        Transitions: PARTIALLY_DISCOVERED -> PROCESSING -> DISCOVERED.
        """
        sector = self.get_sector(sector_id)
        if not sector:
            raise ValueError(f"Sector {sector_id} not found")

        # Locate downloaded DEM files
        sector_raw_dir = self.downloader.raw_dir / sector_id
        hdr_files = list(sector_raw_dir.glob("*.HDR")) + list(sector_raw_dir.glob("*.hdr"))
        img_files = list(sector_raw_dir.glob("*.IMG")) + list(sector_raw_dir.glob("*.img"))

        if not hdr_files or not img_files:
            raise FileNotFoundError(f"Missing raw DEM (.HDR / .IMG) files in {sector_raw_dir}")

        hdr_path = hdr_files[0]
        img_path = img_files[0]

        sector.state = SectorState.PROCESSING
        sector.layers[LayerType.ELEVATION].status = LayerStatus.PROCESSING
        sector.layers[LayerType.SLOPE].status = LayerStatus.PROCESSING
        sector.layers[LayerType.ROUGHNESS].status = LayerStatus.PROCESSING
        sector.updated_at = datetime.now(timezone.utc)

        try:
            # 1. Read global DEM
            dem_data, envi_header = self.dem_reader.read_dem(hdr_path, img_path)

            # 2. Crop to sector bounds with 1-pixel buffer for border gradient accuracy
            cropped = self.dem_reader.crop_sector(dem_data, sector.bounds, buffer_pixels=1)

            # 3. Compute Slope in degrees
            slope_deg, elevation_grid, lats, lons = compute_slope(
                cropped,
                trim_buffer=True,
                nodata_value=envi_header.data_ignore_value,
            )

            # 4. Compute Roughness (local std dev)
            roughness_grid = compute_roughness(elevation_grid, window_size=3)

            # 5. Export layers (JSON data + colorized PNG previews)
            metadata_base = {
                "source_file": img_path.name,
                "mission": "MGS",
                "instrument": "MOLA",
                "coordinate_system": sector.coordinate_reference_system,
                "mars_radius_m": self.dem_reader.MARS_RADIUS_METERS,
                "dy_meters": float(cropped.dy_meters),
                "resolution_deg": float(cropped.native_resolution_deg),
            }

            elev_export = self.layer_exporter.export_layer(
                sector_id=sector_id,
                layer_type="elevation",
                grid=elevation_grid,
                lats=lats,
                lons=lons,
                units="meters",
                metadata={**metadata_base, "datum": "Mars Areoid (GMM3 / mgm1025)"},
            )

            slope_export = self.layer_exporter.export_layer(
                sector_id=sector_id,
                layer_type="slope",
                grid=slope_deg,
                lats=lats,
                lons=lons,
                units="degrees",
                metadata={**metadata_base, "algorithm": "central_difference_planar_gradient"},
            )

            roughness_export = self.layer_exporter.export_layer(
                sector_id=sector_id,
                layer_type="roughness",
                grid=roughness_grid,
                lats=lats,
                lons=lons,
                units="meters",
                metadata={**metadata_base, "algorithm": "elevation_std_dev_3x3"},
            )

            # 6. Update sector state
            sector.layers[LayerType.ELEVATION].status = LayerStatus.READY
            sector.layers[LayerType.ELEVATION].file_path = elev_export["json_path"]
            sector.layers[LayerType.ELEVATION].resolution_m = float(cropped.dy_meters)

            sector.layers[LayerType.SLOPE].status = LayerStatus.READY
            sector.layers[LayerType.SLOPE].file_path = slope_export["json_path"]
            sector.layers[LayerType.SLOPE].resolution_m = float(cropped.dy_meters)

            sector.layers[LayerType.ROUGHNESS].status = LayerStatus.READY
            sector.layers[LayerType.ROUGHNESS].file_path = roughness_export["json_path"]
            sector.layers[LayerType.ROUGHNESS].resolution_m = float(cropped.dy_meters)

            for lt in [LayerType.ELEVATION, LayerType.SLOPE, LayerType.ROUGHNESS]:
                if lt not in sector.available_layers:
                    sector.available_layers.append(lt)

            # Minimum viable layer set for DISCOVERED is elevation + slope
            sector.state = SectorState.DISCOVERED
            sector.updated_at = datetime.now(timezone.utc)

            return {
                "sector_id": sector_id,
                "state": sector.state.value,
                "layers": {
                    "elevation": elev_export,
                    "slope": slope_export,
                    "roughness": roughness_export,
                },
            }

        except Exception as e:
            logger.error(f"Processing failed for sector {sector_id}: {e}")
            sector.state = SectorState.FAILED
            sector.layers[LayerType.ELEVATION].status = LayerStatus.FAILED
            sector.layers[LayerType.SLOPE].status = LayerStatus.FAILED
            sector.error_message = str(e)
            sector.updated_at = datetime.now(timezone.utc)
            raise

    def is_sector_ready_3d(self, sector_id: str) -> bool:
        """Check whether high-resolution 3D mesh and texture assets exist for the sector."""
        mesh_path = settings.DATA_PROCESSED_DIR / sector_id / "terrain_mesh.json"
        texture_path = settings.DATA_PROCESSED_DIR / sector_id / "surface_texture.png"
        return mesh_path.exists() and texture_path.exists()

    async def start_exploration_pipeline(self, sector_id: str) -> dict[str, Any]:
        """
        Orchestrate on-demand automated data acquisition and 3D terrain reconstruction.
        Reuses cached assets if available; otherwise initiates background retrieval.
        """
        sector = self.get_sector(sector_id)
        if not sector:
            raise ValueError(f"Sector {sector_id} not found")

        if self.is_sector_ready_3d(sector_id):
            sector.state = SectorState.DISCOVERED
            for lt in [LayerType.ELEVATION, LayerType.SLOPE, LayerType.ROUGHNESS, LayerType.IMAGERY]:
                sector.layers[lt].status = LayerStatus.READY
                if lt not in sector.available_layers:
                    sector.available_layers.append(lt)
            return {
                "status": "READY",
                "sector_id": sector_id,
                "message": "High-resolution 3D terrain already reconstructed in local storage.",
            }

        active_job = job_manager.get_active_job_for_sector(sector_id)
        if active_job:
            return {
                "status": "PROCESSING",
                "sector_id": sector_id,
                "job_id": active_job.job_id,
                "job": active_job.to_dict(),
            }

        job = job_manager.create_job(sector_id)
        asyncio.create_task(self.run_highres_pipeline(sector_id, job.job_id))

        return {
            "status": "PROCESSING",
            "sector_id": sector_id,
            "job_id": job.job_id,
            "estimated_bytes": 3500000,
            "job": job.to_dict(),
        }

    async def run_highres_pipeline(self, sector_id: str, job_id: str) -> None:
        """
        Background worker executing end-to-end MOLA 128 DEM + Viking texture + 3D mesh reconstruction.
        """
        sector = self.get_sector(sector_id)
        if not sector:
            job_manager.mark_failed(job_id, f"Sector {sector_id} not found")
            return

        sector.state = SectorState.DOWNLOADING
        sector.updated_at = datetime.now(timezone.utc)

        try:
            # Active storage check
            disk = shutil.disk_usage(settings.BASE_DIR)
            if disk.free < 50 * 1024 * 1024:
                raise RuntimeError(f"Insufficient disk space on host: {disk.free // (1024**2)} MB available")

            # 1. Acquire high-res MOLA 128 DEM
            job_manager.update_progress(
                job_id,
                stage=JobStage.DOWNLOADING_DEM,
                progress_pct=20.0,
                detail_message="Acquiring MOLA 128 px/deg elevation grid from PDS Geosciences...",
            )
            elev_grid = await highres_downloader.acquire_mola_128_dem(sector_id, sector.bounds, job_id=job_id)

            if job_manager.is_cancelled(job_id):
                sector.state = SectorState.UNSCOUTED
                return

            # 2. Acquire Viking visible surface texture
            job_manager.update_progress(
                job_id,
                stage=JobStage.DOWNLOADING_TEXTURE,
                progress_pct=60.0,
                detail_message="Acquiring georeferenced Viking orbital mosaic texture...",
            )
            await highres_downloader.acquire_visible_texture(sector_id, sector.bounds, job_id=job_id)

            if job_manager.is_cancelled(job_id):
                sector.state = SectorState.UNSCOUTED
                return

            # 3. Process 3D terrain & derived layers
            job_manager.update_progress(
                job_id,
                stage=JobStage.PROCESSING_TERRAIN,
                progress_pct=80.0,
                detail_message="Synthesizing 3D terrain geometry, meridian slopes & roughness...",
            )
            res = terrain_3d_builder.build_and_export_terrain(sector_id, sector.bounds, elev_grid)

            # 4. Mark complete & update sector
            sector.state = SectorState.DISCOVERED
            for lt in [LayerType.ELEVATION, LayerType.SLOPE, LayerType.ROUGHNESS, LayerType.IMAGERY]:
                sector.layers[lt].status = LayerStatus.READY
                if lt not in sector.available_layers:
                    sector.available_layers.append(lt)
            sector.updated_at = datetime.now(timezone.utc)

            job_manager.mark_completed(job_id, result=res)
            logger.info(f"Sector {sector_id} exploration pipeline finished successfully.")

        except asyncio.CancelledError:
            logger.info(f"Job {job_id} for sector {sector_id} was cancelled.")
            sector.state = SectorState.UNSCOUTED
            sector.updated_at = datetime.now(timezone.utc)
        except Exception as e:
            logger.error(f"Error in exploration pipeline for {sector_id}: {e}")
            sector.state = SectorState.FAILED
            sector.error_message = str(e)
            sector.updated_at = datetime.now(timezone.utc)
            job_manager.mark_failed(job_id, str(e))


# Global singleton instance for the service
sector_service = SectorService()
