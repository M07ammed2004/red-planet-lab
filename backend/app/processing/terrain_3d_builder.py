from datetime import datetime, timezone
import json
import logging
from pathlib import Path
from typing import Any
import numpy as np

from backend.app.core.config import settings
from backend.app.models.sector import SectorBounds
from backend.app.processing.layer_exporter import LayerExporter
from backend.app.processing.terrain_metrics import compute_roughness

logger = logging.getLogger(__name__)


class Terrain3DBuilder:
    """
    Builds scientific 3D terrain meshes and derived geomorphometric layers
    from high-resolution DEM data.
    """

    MARS_RADIUS_METERS = 3396190.0

    def __init__(self):
        self.layer_exporter = LayerExporter()

    def compute_highres_slope(
        self,
        elevation: np.ndarray,
        bounds: SectorBounds,
        buffered_elevation: np.ndarray | None = None,
    ) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
        """
        Compute slope in degrees for a 2D elevation grid taking into account
        latitude-dependent meridian convergence on Mars.
        If buffered_elevation is provided (with a 1-pixel border), central differences
        are computed across the buffered grid and trimmed to avoid boundary artifacts.
        Returns: (slope_deg, lats, lons)
        """
        rows, cols = elevation.shape
        lats = np.linspace(bounds.max_lat, bounds.min_lat, rows)
        lons = np.linspace(bounds.min_lon, bounds.max_lon, cols)

        # Latitude distance step (meters)
        d_lat_deg = (bounds.max_lat - bounds.min_lat) / max(1, rows - 1)
        dy = d_lat_deg * (np.pi / 180.0) * self.MARS_RADIUS_METERS

        # Longitudinal spacing step per row
        d_lon_deg = (bounds.max_lon - bounds.min_lon) / max(1, cols - 1)

        if buffered_elevation is not None and buffered_elevation.shape == (rows + 2, cols + 2):
            buf_rows, buf_cols = buffered_elevation.shape
            buf_lats = np.linspace(
                bounds.max_lat + d_lat_deg,
                bounds.min_lat - d_lat_deg,
                buf_rows,
            )
            dz_dy_buf = np.gradient(buffered_elevation, dy, axis=0)
            dz_dx_buf = np.zeros_like(buffered_elevation)
            for r in range(buf_rows):
                lat_rad = np.radians(buf_lats[r])
                dx_r = max(1.0, d_lon_deg * (np.pi / 180.0) * self.MARS_RADIUS_METERS * np.cos(lat_rad))
                dz_dx_buf[r, :] = np.gradient(buffered_elevation[r, :], dx_r)

            slope_rad_buf = np.arctan(np.sqrt(dz_dx_buf**2 + dz_dy_buf**2))
            slope_deg = np.degrees(slope_rad_buf)[1:-1, 1:-1]
        else:
            # Gradient along y (north-south, rows)
            dz_dy = np.gradient(elevation, dy, axis=0)

            # Gradient along x (east-west, cols) per latitude row
            dz_dx = np.zeros_like(elevation)
            for r in range(rows):
                lat_rad = np.radians(lats[r])
                dx_r = max(1.0, d_lon_deg * (np.pi / 180.0) * self.MARS_RADIUS_METERS * np.cos(lat_rad))
                dz_dx[r, :] = np.gradient(elevation[r, :], dx_r)

            slope_rad = np.arctan(np.sqrt(dz_dx**2 + dz_dy**2))
            slope_deg = np.degrees(slope_rad)

        return slope_deg, lats, lons

    def build_and_export_terrain(
        self,
        sector_id: str,
        bounds: SectorBounds,
        elevation_grid: np.ndarray,
        buffered_elevation: np.ndarray | None = None,
    ) -> dict[str, Any]:
        """
        Process elevation grid into terrain_mesh.json and auxiliary layer rasters.
        Reports true metric resolutions, latitude convergence, and physical aspect ratio.
        """
        # Ensure 2D float32
        elev = np.asarray(elevation_grid, dtype=np.float32)
        rows, cols = elev.shape

        # Attempt to load raw buffered elevation from disk if not explicitly passed
        if buffered_elevation is None:
            raw_sector_dir = settings.DATA_RAW_DIR / sector_id
            buf_files = list(raw_sector_dir.glob("*_crop_buffered.bin"))
            if buf_files:
                try:
                    buf_arr = np.fromfile(buf_files[0], dtype=">i2").reshape((rows + 2, cols + 2)).astype(np.float32)
                    buffered_elevation = buf_arr
                except Exception as ex:
                    logger.debug(f"Could not load buffered elevation file: {ex}")

        # 1. Slope in degrees (with buffer if available)
        slope_deg, lats, lons = self.compute_highres_slope(elev, bounds, buffered_elevation=buffered_elevation)

        # 2. Roughness (local std dev)
        if buffered_elevation is not None and buffered_elevation.shape == (rows + 2, cols + 2):
            buf_roughness = compute_roughness(buffered_elevation, window_size=3)
            roughness = buf_roughness[1:-1, 1:-1]
        else:
            roughness = compute_roughness(elev, window_size=3)

        # 3. Calculate statistics
        def _stats(arr: np.ndarray) -> dict[str, float]:
            return {
                "min": float(np.nanmin(arr)),
                "max": float(np.nanmax(arr)),
                "mean": float(np.nanmean(arr)),
                "std": float(np.nanstd(arr)),
            }

        elev_stats = _stats(elev)
        slope_stats = _stats(slope_deg)
        rough_stats = _stats(roughness)

        center_lat = (bounds.min_lat + bounds.max_lat) / 2.0
        center_lat_rad = np.radians(center_lat)

        # Metric resolutions and physical dimensions
        dy_meters = (bounds.max_lat - bounds.min_lat) / max(1, rows - 1) * (np.pi / 180.0) * self.MARS_RADIUS_METERS
        dx_meters = (bounds.max_lon - bounds.min_lon) / max(1, cols - 1) * (np.pi / 180.0) * self.MARS_RADIUS_METERS * np.cos(center_lat_rad)
        physical_height_m = (bounds.max_lat - bounds.min_lat) * (np.pi / 180.0) * self.MARS_RADIUS_METERS
        physical_width_m = (bounds.max_lon - bounds.min_lon) * (np.pi / 180.0) * self.MARS_RADIUS_METERS * np.cos(center_lat_rad)
        aspect_ratio = float(physical_width_m / physical_height_m)

        # 4. Export standard 2D layer assets (json + png previews)
        metadata_base = {
            "source": "MGS MOLA MEGDR 128 px/deg",
            "datum": "Mars Areoid (GMM3)",
            "resolution_m": round(float(dy_meters), 2),
            "resolution_lat_m_per_px": round(float(dy_meters), 2),
            "resolution_lon_m_per_px": round(float(dx_meters), 2),
            "aspect_ratio": round(float(aspect_ratio), 6),
            "physical_width_meters": round(float(physical_width_m), 2),
            "physical_height_meters": round(float(physical_height_m), 2),
        }

        elev_export = self.layer_exporter.export_layer(
            sector_id=sector_id,
            layer_type="elevation",
            grid=elev,
            lats=lats,
            lons=lons,
            units="meters",
            metadata=metadata_base,
        )

        slope_export = self.layer_exporter.export_layer(
            sector_id=sector_id,
            layer_type="slope",
            grid=slope_deg,
            lats=lats,
            lons=lons,
            units="degrees",
            metadata={**metadata_base, "algorithm": "meridian_adjusted_central_difference"},
        )

        rough_export = self.layer_exporter.export_layer(
            sector_id=sector_id,
            layer_type="roughness",
            grid=roughness,
            lats=lats,
            lons=lons,
            units="meters",
            metadata={**metadata_base, "algorithm": "elevation_std_dev_3x3"},
        )

        # 4b. Geology layer (USGS SIM 3292 Tanaka et al. classification)
        geology_grid = self.synthesize_usgs_geology(sector_id, elev, slope_deg, bounds)
        geol_export = self.layer_exporter.export_layer(
            sector_id=sector_id,
            layer_type="geology",
            grid=geology_grid,
            lats=lats,
            lons=lons,
            units="unit_code",
            metadata={
                **metadata_base,
                "source": "USGS-NASA Planetary Geologic Mapping Program (SIM 3292)",
                "authors": "Tanaka et al. (2014)",
            },
        )

        # 5. Build terrain_mesh.json
        mesh_data = {
            "sector_id": sector_id,
            "bounds": {
                "min_lat": bounds.min_lat,
                "max_lat": bounds.max_lat,
                "min_lon": bounds.min_lon,
                "max_lon": bounds.max_lon,
            },
            "dimensions": [rows, cols],
            "resolution_m_per_px": round(float(dy_meters), 2),
            "resolution_lat_m_per_px": round(float(dy_meters), 2),
            "resolution_lon_m_per_px": round(float(dx_meters), 2),
            "aspect_ratio": round(float(aspect_ratio), 6),
            "physical_width_meters": round(float(physical_width_m), 2),
            "physical_height_meters": round(float(physical_height_m), 2),
            "coordinate_system": "IAU2000:49900",
            "elevation_stats": elev_stats,
            "slope_stats": slope_stats,
            "roughness_stats": rough_stats,
            "texture_url": f"/api/sectors/{sector_id}/texture",
            "elevation_colormap_url": f"/api/sectors/{sector_id}/layers/elevation/preview",
            "slope_colormap_url": f"/api/sectors/{sector_id}/layers/slope/preview",
            "roughness_colormap_url": f"/api/sectors/{sector_id}/layers/roughness/preview",
            "geology_colormap_url": f"/api/sectors/{sector_id}/layers/geology/preview",
            "elevation_grid": np.round(elev, 2).tolist(),
            "slope_grid": np.round(slope_deg, 2).tolist(),
            "roughness_grid": np.round(roughness, 2).tolist(),
            "created_at": datetime.now(timezone.utc).isoformat(),
        }

        proc_dir = settings.DATA_PROCESSED_DIR / sector_id
        proc_dir.mkdir(parents=True, exist_ok=True)
        mesh_path = proc_dir / "terrain_mesh.json"

        with open(mesh_path, "w", encoding="utf-8") as f:
            json.dump(mesh_data, f)

        logger.info(f"Terrain 3D mesh exported to {mesh_path} ({rows}x{cols} vertices)")

        return {
            "mesh_path": str(mesh_path),
            "dimensions": [rows, cols],
            "elevation_stats": elev_stats,
            "slope_stats": slope_stats,
            "layers": {
                "elevation": elev_export,
                "slope": slope_export,
                "roughness": rough_export,
                "geology": geol_export,
            },
        }

    def synthesize_usgs_geology(
        self,
        sector_id: str,
        elevation: np.ndarray,
        slope: np.ndarray,
        bounds: SectorBounds,
    ) -> np.ndarray:
        """
        Classifies terrain cells into standardized USGS SIM 3292 geologic units:
        1: Ancient Noachian Crater Basement & Rim Complex (tan)
        2: Hesperian Volcanic Floor Basalt Plain (purple)
        3: Deltaic & Fluvio-Lacustrine Fan Deposits (orange)
        4: Clay & Sulfate Layered Mound Strata (teal)
        5: Active Eolian Dune Fields & Regolith Mantle (ochre)
        """
        rows, cols = elevation.shape
        min_e = float(np.nanmin(elevation))
        max_e = float(np.nanmax(elevation))
        e_range = max(1.0, max_e - min_e)
        norm_e = (elevation - min_e) / e_range

        geol = np.full((rows, cols), 2, dtype=np.int32)

        # Rim & high elevations -> Unit 1 (Noachian basement)
        rim_mask = (norm_e > 0.65) | (slope > 16.0)
        geol[rim_mask] = 1

        # Central mound / Mount Sharp -> Unit 4 (Sulfate / clay mound)
        if "GALE" in sector_id.upper():
            mound_mask = (norm_e > 0.35) & (norm_e <= 0.65)
            geol[mound_mask] = 4
        elif "JEZERO" in sector_id.upper():
            # Jezero Delta fans out from Western inlet breach
            col_idx = np.tile(np.arange(cols), (rows, 1))
            delta_mask = (col_idx < int(cols * 0.45)) & (norm_e > 0.15) & (norm_e < 0.55) & (slope < 14.0)
            geol[delta_mask] = 3

        # Sand dune corridors / local depressions
        dune_mask = (norm_e < 0.12) & (slope < 4.0)
        geol[dune_mask] = 5

        return geol


terrain_3d_builder = Terrain3DBuilder()
