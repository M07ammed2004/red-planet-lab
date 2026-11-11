from dataclasses import dataclass
from pathlib import Path
import numpy as np
from backend.app.models.sector import SectorBounds


@dataclass
class ENVIHeader:
    """Parsed ENVI header attributes."""

    samples: int
    lines: int
    bands: int
    data_type: int
    byte_order: int
    data_ignore_value: float | None
    mars_radius_m: float
    map_info: str | None


@dataclass
class CroppedDEM:
    """Elevation data cropped to sector boundaries with metadata."""

    elevation: np.ndarray
    lats: np.ndarray
    lons: np.ndarray
    dx_meters: np.ndarray  # horizontal spacing per row
    dy_meters: float  # vertical spacing
    native_resolution_deg: float
    has_buffer: bool


class DEMReader:
    """Parses planetary DEM files (ENVI / PDS binary) and extracts geographic sub-grids."""

    MARS_RADIUS_METERS = 3396000.0

    def parse_envi_header(self, hdr_path: Path) -> ENVIHeader:
        """Parse ENVI ASCII header file into ENVIHeader dataclass."""
        text = hdr_path.read_text(encoding="utf-8", errors="ignore")
        meta: dict[str, str] = {}
        for line in text.splitlines():
            if "=" in line:
                k, v = line.split("=", 1)
                meta[k.strip().lower()] = v.strip().strip("{}")

        samples = int(meta.get("samples", 1440))
        lines = int(meta.get("lines", 720))
        bands = int(meta.get("bands", 1))
        data_type = int(meta.get("data type", 2))
        byte_order = int(meta.get("byte order", 1))
        ignore_val = float(meta["data ignore value"]) if "data ignore value" in meta else None

        return ENVIHeader(
            samples=samples,
            lines=lines,
            bands=bands,
            data_type=data_type,
            byte_order=byte_order,
            data_ignore_value=ignore_val,
            mars_radius_m=self.MARS_RADIUS_METERS,
            map_info=meta.get("map info"),
        )

    def read_dem(self, hdr_path: Path, img_path: Path) -> tuple[np.ndarray, ENVIHeader]:
        """Read binary raster according to ENVI header specifications."""
        header = self.parse_envi_header(hdr_path)

        endian = ">" if header.byte_order == 1 else "<"
        dtype_map = {1: "u1", 2: "i2", 3: "i4", 4: "f4", 5: "f8", 12: "u2", 13: "u4"}
        np_dtype = f"{endian}{dtype_map.get(header.data_type, 'i2')}"

        with open(img_path, "rb") as f:
            raw_bytes = f.read()

        expected_elements = header.lines * header.samples
        arr = np.frombuffer(raw_bytes, dtype=np_dtype).reshape((header.lines, header.samples)).astype(np.float32)
        return arr, header

    def crop_sector(
        self,
        dem: np.ndarray,
        bounds: SectorBounds,
        buffer_pixels: int = 1,
    ) -> CroppedDEM:
        """
        Crop global DEM to sector bounds.
        Assumes global coverage from 90°N to -90°S (lines) and 0° to 360°E (samples).
        """
        lines, samples = dem.shape
        d_lat = 180.0 / lines
        d_lon = 360.0 / samples

        # Convert lat/lon bounds to pixel indices
        # Lat: 90 is line 0, -90 is line (lines - 1)
        line_start = int(np.floor((90.0 - bounds.max_lat) / d_lat)) - buffer_pixels
        line_end = int(np.ceil((90.0 - bounds.min_lat) / d_lat)) + buffer_pixels

        # Lon: 0 is sample 0, 360 is sample (samples - 1)
        lon_min = bounds.min_lon % 360.0
        lon_max = bounds.max_lon % 360.0
        sample_start = int(np.floor(lon_min / d_lon)) - buffer_pixels
        sample_end = int(np.ceil(lon_max / d_lon)) + buffer_pixels

        # Clamp indices to grid limits
        l_start = max(0, line_start)
        l_end = min(lines, line_end)
        s_start = max(0, sample_start)
        s_end = min(samples, sample_end)

        cropped = dem[l_start:l_end, s_start:s_end].copy()

        # Generate coordinates for cropped pixels
        row_lats = 90.0 - (np.arange(l_start, l_end) + 0.5) * d_lat
        col_lons = (np.arange(s_start, s_end) + 0.5) * d_lon

        # Spatial spacing on Mars
        dy = self.MARS_RADIUS_METERS * np.radians(d_lat)
        dx_per_row = self.MARS_RADIUS_METERS * np.radians(d_lon) * np.cos(np.radians(row_lats))

        return CroppedDEM(
            elevation=cropped,
            lats=row_lats,
            lons=col_lons,
            dx_meters=dx_per_row,
            dy_meters=dy,
            native_resolution_deg=d_lat,
            has_buffer=(buffer_pixels > 0),
        )
