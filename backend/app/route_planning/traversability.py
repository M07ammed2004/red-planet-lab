from dataclasses import dataclass
from pathlib import Path
import json
import numpy as np
from backend.app.core.config import settings
from backend.app.models.sector import SectorBounds
from backend.app.weather.atmospheric_service import atmospheric_service


@dataclass
class TraversabilityGrid:
    """Traversability environment for pathfinding."""

    elevation: np.ndarray  # shape (rows, cols)
    slope: np.ndarray  # shape (rows, cols) in degrees
    roughness: np.ndarray  # shape (rows, cols) in meters
    risk: np.ndarray  # shape (rows, cols) normalized [0, 1]
    scientific_interest: np.ndarray  # shape (rows, cols) normalized [0, 1]
    traversable: np.ndarray  # bool mask, True if safe to traverse
    wind_speed: np.ndarray  # shape (rows, cols) in m/s
    dust_tau: np.ndarray  # shape (rows, cols) dust optical depth
    storm_hazard: np.ndarray  # shape (rows, cols) normalized [0, 1]
    storm_obstacle_mask: np.ndarray  # bool mask, True if blocked by severe storm
    lats: np.ndarray  # 1D vector of latitude coordinates
    lons: np.ndarray  # 1D vector of longitude coordinates
    dy_meters: float  # spacing in meters along latitude
    dx_meters: float  # spacing in meters along longitude
    bounds: SectorBounds
    max_slope_deg: float


class TraversabilityBuilder:
    """Builds traversability grid from processed sector layers."""

    MARS_RADIUS_METERS = 3396000.0

    def build_from_sector(
        self,
        sector_id: str,
        bounds: SectorBounds,
        max_slope_deg: float = 15.0,
        grid_density: int = 32,
    ) -> TraversabilityGrid:
        """Load processed layers and construct traversability matrix."""
        sec_dir = settings.DATA_PROCESSED_DIR / sector_id
        elev_path = sec_dir / "elevation.json"
        slope_path = sec_dir / "slope.json"
        rough_path = sec_dir / "roughness.json"

        if not elev_path.exists() or not slope_path.exists():
            raise FileNotFoundError(
                f"Missing processed layers for sector '{sector_id}'. "
                "Ensure DEM has been downloaded and processed first."
            )

        with open(elev_path, "r", encoding="utf-8") as f:
            elev_json = json.load(f)
        with open(slope_path, "r", encoding="utf-8") as f:
            slope_json = json.load(f)

        rough_json = None
        if rough_path.exists():
            with open(rough_path, "r", encoding="utf-8") as f:
                rough_json = json.load(f)

        # Use 32x32 resampled grids for navigation planning
        elev_grid = np.array(elev_json.get("resampled_grid_32x32", elev_json["grid"]), dtype=np.float32)
        slope_grid = np.array(slope_json.get("resampled_grid_32x32", slope_json["grid"]), dtype=np.float32)

        if rough_json:
            rough_grid = np.array(rough_json.get("resampled_grid_32x32", rough_json["grid"]), dtype=np.float32)
        else:
            rough_grid = np.zeros_like(elev_grid)

        rows, cols = elev_grid.shape

        # Construct lat and lon coordinates spanning the sector bounds
        # Row 0 is max_lat (North), Row -1 is min_lat (South)
        lats = np.linspace(bounds.max_lat, bounds.min_lat, rows)
        # Col 0 is min_lon (West), Col -1 is max_lon (East)
        lons = np.linspace(bounds.min_lon, bounds.max_lon, cols)

        # Spacing in meters on Mars
        d_lat_deg = abs(bounds.max_lat - bounds.min_lat) / max(rows - 1, 1)
        d_lon_deg = abs(bounds.max_lon - bounds.min_lon) / max(cols - 1, 1)

        mean_lat = (bounds.min_lat + bounds.max_lat) / 2.0
        dy = self.MARS_RADIUS_METERS * np.radians(d_lat_deg)
        dx = self.MARS_RADIUS_METERS * np.radians(d_lon_deg) * np.cos(np.radians(mean_lat))

        # Hard constraints: cells with slope > max_slope_deg or NaN are blocked
        traversable = (slope_grid <= max_slope_deg) & (~np.isnan(elev_grid))

        # Normalized risk: R = 0.7 * S + 0.3 * T
        slope_norm = np.clip(slope_grid / max(max_slope_deg, 1.0), 0.0, 1.0)

        rough_min = float(np.min(rough_grid))
        rough_max = float(np.max(rough_grid))
        rough_range = max(rough_max - rough_min, 1e-4)
        rough_norm = np.clip((rough_grid - rough_min) / rough_range, 0.0, 1.0)

        risk = 0.7 * slope_norm + 0.3 * rough_norm
        risk[~traversable] = 1.0  # max risk for untraversable

        # Scientific interest modeling based on terrain topography & geological contacts:
        # 1. Slope sweet-spot: bedrock strata and outcrops are exposed on moderate slopes (3° to 10°)
        slope_sci = np.exp(-((slope_grid - 6.0) ** 2) / (2 * (3.5 ** 2)))

        # 2. Topographic gradient / morphology (craters, scarps, deltas)
        grad_y, grad_x = np.gradient(elev_grid)
        grad_mag = np.sqrt(grad_y ** 2 + grad_x ** 2)
        grad_max = float(np.percentile(grad_mag, 90)) + 1e-4
        grad_norm = np.clip(grad_mag / grad_max, 0.0, 1.0)

        # 3. Known Sector Geological Hotspots (POIs)
        poi_map = np.zeros_like(elev_grid)
        sec_upper = sector_id.upper()
        if "JEZERO" in sec_upper:
            target_pois = [(18.445, 77.450), (18.490, 77.370), (18.380, 77.530)]
            for p_lat, p_lon in target_pois:
                d_lat = (lats[:, None] - p_lat) / 0.15
                d_lon = (lons[None, :] - p_lon) / 0.15
                poi_map += np.exp(-(d_lat ** 2 + d_lon ** 2))
        elif "GALE" in sec_upper:
            target_pois = [(-4.68, 137.40), (-4.75, 137.38), (-4.62, 137.44)]
            for p_lat, p_lon in target_pois:
                d_lat = (lats[:, None] - p_lat) / 0.15
                d_lon = (lons[None, :] - p_lon) / 0.15
                poi_map += np.exp(-(d_lat ** 2 + d_lon ** 2))
        elif "OLYMPUS" in sec_upper:
            target_pois = [(18.55, 226.10), (18.65, 226.20)]
            for p_lat, p_lon in target_pois:
                d_lat = (lats[:, None] - p_lat) / 0.25
                d_lon = (lons[None, :] - p_lon) / 0.25
                poi_map += np.exp(-(d_lat ** 2 + d_lon ** 2))

        max_poi = float(np.max(poi_map)) if np.size(poi_map) > 0 else 0.0
        poi_norm = np.clip(poi_map / max(max_poi, 1e-4), 0.0, 1.0) if max_poi > 0 else np.zeros_like(elev_grid)

        scientific_interest = np.clip(0.40 * slope_sci + 0.35 * grad_norm + 0.25 * poi_norm, 0.0, 1.0)
        scientific_interest[~traversable] = 0.0

        # Compute dynamic Martian wind and dust storm hazard fields
        (
            wind_speed,
            dust_tau,
            storm_hazard,
            storm_obstacle_mask,
        ) = atmospheric_service.compute_atmospheric_grids(
            sector_id=sector_id,
            lats=lats,
            lons=lons,
            elevation=elev_grid,
            slope=slope_grid,
        )

        return TraversabilityGrid(
            elevation=elev_grid,
            slope=slope_grid,
            roughness=rough_grid,
            risk=risk,
            scientific_interest=scientific_interest,
            traversable=traversable,
            wind_speed=wind_speed,
            dust_tau=dust_tau,
            storm_hazard=storm_hazard,
            storm_obstacle_mask=storm_obstacle_mask,
            lats=lats,
            lons=lons,
            dy_meters=float(dy),
            dx_meters=float(dx),
            bounds=bounds,
            max_slope_deg=max_slope_deg,
        )

    def coords_to_indices(
        self,
        grid: TraversabilityGrid,
        coords: tuple[float, float],
    ) -> tuple[int, int]:
        """Convert (lat, lon) coordinates to nearest (row, col) grid cell index."""
        lat, lon = coords
        # Clamp coordinates to sector bounds
        lat_clamped = min(max(lat, grid.bounds.min_lat), grid.bounds.max_lat)
        lon_clamped = min(max(lon, grid.bounds.min_lon), grid.bounds.max_lon)

        row = int(np.argmin(np.abs(grid.lats - lat_clamped)))
        col = int(np.argmin(np.abs(grid.lons - lon_clamped)))
        return (row, col)

    def indices_to_coords(
        self,
        grid: TraversabilityGrid,
        row: int,
        col: int,
    ) -> tuple[float, float]:
        """Convert (row, col) grid index to (lat, lon) coordinates."""
        return (float(grid.lats[row]), float(grid.lons[col]))
