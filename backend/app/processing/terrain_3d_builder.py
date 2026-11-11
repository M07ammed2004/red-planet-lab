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
    ) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
        """
        Compute slope in degrees for a 2D elevation grid taking into account
        latitude-dependent meridian convergence on Mars.
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
    ) -> dict[str, Any]:
        """
        Process elevation grid into terrain_mesh.json and auxiliary layer rasters.
        """
        # Ensure 2D float32
        elev = np.asarray(elevation_grid, dtype=np.float32)
        rows, cols = elev.shape

        # 1. Slope in degrees
        slope_deg, lats, lons = self.compute_highres_slope(elev, bounds)

        # 2. Roughness (local std dev)
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

        dy_meters = (bounds.max_lat - bounds.min_lat) / max(1, rows - 1) * (np.pi / 180.0) * self.MARS_RADIUS_METERS

        # 4. Export standard 2D layer assets (json + png previews)
        metadata_base = {
            "source": "MGS MOLA MEGDR 128 px/deg",
            "datum": "Mars Areoid (GMM3)",
            "resolution_m": float(dy_meters),
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
            "coordinate_system": "IAU2000:49900",
            "elevation_stats": elev_stats,
            "slope_stats": slope_stats,
            "roughness_stats": rough_stats,
            "texture_url": f"/api/sectors/{sector_id}/texture",
            "elevation_colormap_url": f"/api/sectors/{sector_id}/layers/elevation/preview",
            "slope_colormap_url": f"/api/sectors/{sector_id}/layers/slope/preview",
            "roughness_colormap_url": f"/api/sectors/{sector_id}/layers/roughness/preview",
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
            },
        }


terrain_3d_builder = Terrain3DBuilder()
