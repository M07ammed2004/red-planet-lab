import json
import logging
from datetime import datetime, timezone
from pathlib import Path
import struct
import zlib
import numpy as np
from backend.app.core.config import settings
from backend.app.processing.terrain_metrics import resample_grid

logger = logging.getLogger(__name__)


def write_png_rgba(file_path: Path, width: int, height: int, rgba_bytes: bytes) -> None:
    """Write an RGBA image file using Python standard library (zlib + struct)."""
    def chunk(tag: bytes, data: bytes) -> bytes:
        return (
            struct.pack(">I", len(data))
            + tag
            + data
            + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)
        )

    header = b"\x89PNG\r\n\x1a\n"
    ihdr = chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0))
    raw_lines = bytearray()
    row_bytes = width * 4
    for y in range(height):
        raw_lines.append(0)  # filter type 0: None
        raw_lines.extend(rgba_bytes[y * row_bytes : (y + 1) * row_bytes])

    idat = chunk(b"IDAT", zlib.compress(bytes(raw_lines), level=6))
    iend = chunk(b"IEND", b"")

    file_path.parent.mkdir(parents=True, exist_ok=True)
    with open(file_path, "wb") as f:
        f.write(header + ihdr + idat + iend)


def colorize_elevation(grid: np.ndarray) -> bytes:
    """Map elevation in meters to a multi-stop topographic RGBA color palette."""
    min_val = float(np.nanmin(grid))
    max_val = float(np.nanmax(grid))
    val_range = max(max_val - min_val, 1e-5)
    normalized = np.clip((grid - min_val) / val_range, 0.0, 1.0)

    # Color stops: [normalized_pos, (R, G, B)]
    stops = [
        (0.00, (40, 70, 150)),    # Deep blue
        (0.20, (65, 140, 190)),   # Cyan / low basin
        (0.40, (80, 170, 110)),   # Soft green
        (0.60, (210, 190, 80)),   # Warm ochre / yellow
        (0.80, (190, 100, 50)),   # Rusty Mars orange/brown
        (1.00, (245, 240, 235)),  # High peak white/cream
    ]

    height, width = grid.shape
    rgba = bytearray(height * width * 4)

    for y in range(height):
        for x in range(width):
            val = normalized[y, x]
            if np.isnan(val):
                idx = (y * width + x) * 4
                rgba[idx : idx + 4] = bytes([0, 0, 0, 0])
                continue

            # Interpolate between stops
            for i in range(len(stops) - 1):
                p0, c0 = stops[i]
                p1, c1 = stops[i + 1]
                if p0 <= val <= p1:
                    t = (val - p0) / (p1 - p0)
                    r = int(c0[0] + t * (c1[0] - c0[0]))
                    g = int(c0[1] + t * (c1[1] - c0[1]))
                    b = int(c0[2] + t * (c1[2] - c0[2]))
                    break
            else:
                r, g, b = stops[-1][1]

            idx = (y * width + x) * 4
            rgba[idx : idx + 4] = bytes([r, g, b, 255])

    return bytes(rgba)


def colorize_slope(grid: np.ndarray) -> bytes:
    """Map slope in degrees to a risk-graded RGBA color palette."""
    stops = [
        (0.0, (46, 170, 85)),    # Green (0-5 deg): Flat & highly traversable
        (5.0, (140, 195, 60)),   # Yellow-Green (5 deg): Gentle slope
        (12.0, (240, 190, 40)),  # Amber/Yellow (12 deg): Moderate slope
        (20.0, (230, 95, 35)),   # Orange (20 deg): High slope caution
        (30.0, (200, 30, 30)),   # Crimson (30+ deg): Hazardous / impassable
    ]

    height, width = grid.shape
    rgba = bytearray(height * width * 4)

    for y in range(height):
        for x in range(width):
            val = float(grid[y, x])
            if np.isnan(val):
                idx = (y * width + x) * 4
                rgba[idx : idx + 4] = bytes([0, 0, 0, 0])
                continue

            val = min(val, 30.0)
            for i in range(len(stops) - 1):
                p0, c0 = stops[i]
                p1, c1 = stops[i + 1]
                if p0 <= val <= p1:
                    t = (val - p0) / (p1 - p0)
                    r = int(c0[0] + t * (c1[0] - c0[0]))
                    g = int(c0[1] + t * (c1[1] - c0[1]))
                    b = int(c0[2] + t * (c1[2] - c0[2]))
                    break
            else:
                r, g, b = stops[-1][1]

            idx = (y * width + x) * 4
            rgba[idx : idx + 4] = bytes([r, g, b, 255])

    return bytes(rgba)


def colorize_geology(grid: np.ndarray) -> bytes:
    """
    Map USGS SIM 3292 planetary geologic unit codes to standardized geologic colors.
    Units:
      1 = Ancient Noachian Crater Basement & Rim Complex (tan/brown)
      2 = Volcanic Floor Basalt Plain (Hesperian volcanic, purple/violet)
      3 = Deltaic & Fluvio-Lacustrine Fan Deposits (Hesperian, golden-orange)
      4 = Layered Smectite/Sulfate Mound Strata (hydrated minerals, cyan-teal)
      5 = Modern Eolian Sand Sheet & Dune Fields (Amazonian active, amber/ochre)
    """
    unit_palette: dict[int, tuple[int, int, int]] = {
        1: (185, 115, 85),   # Noachian basement complex
        2: (120, 75, 145),   # Volcanic plain basalt
        3: (240, 145, 40),   # Sedimentary deltaic fan
        4: (75, 165, 150),   # Clay / sulfate layered strata
        5: (220, 185, 75),   # Modern eolian dunes
    }

    height, width = grid.shape
    rgba = bytearray(height * width * 4)

    for y in range(height):
        for x in range(width):
            unit_code = int(grid[y, x])
            rgb = unit_palette.get(unit_code, (160, 140, 130))
            idx = (y * width + x) * 4
            rgba[idx : idx + 4] = bytes([rgb[0], rgb[1], rgb[2], 255])

    return bytes(rgba)


def colorize_roughness(grid: np.ndarray) -> bytes:
    """Map roughness (local std dev in meters) to a distinct amber/violet palette."""
    min_val = float(np.nanmin(grid))
    max_val = float(np.nanmax(grid))
    val_range = max(max_val - min_val, 1e-5)
    normalized = np.clip((grid - min_val) / val_range, 0.0, 1.0)

    stops = [
        (0.0, (40, 60, 100)),    # Low roughness (smooth floor)
        (0.25, (60, 120, 140)),  # Moderate roughness
        (0.5, (140, 160, 80)),   # Boulder field
        (0.75, (220, 150, 40)),  # High roughness
        (1.0, (230, 60, 50)),    # Extreme rugged terrain
    ]

    height, width = grid.shape
    rgba = bytearray(height * width * 4)

    for y in range(height):
        for x in range(width):
            val = normalized[y, x]
            for i in range(len(stops) - 1):
                p0, c0 = stops[i]
                p1, c1 = stops[i + 1]
                if p0 <= val <= p1:
                    t = (val - p0) / (p1 - p0)
                    r = int(c0[0] + t * (c1[0] - c0[0]))
                    g = int(c0[1] + t * (c1[1] - c0[1]))
                    b = int(c0[2] + t * (c1[2] - c0[2]))
                    break
            else:
                r, g, b = stops[-1][1]

            idx = (y * width + x) * 4
            rgba[idx : idx + 4] = bytes([r, g, b, 255])

    return bytes(rgba)


class LayerExporter:
    """Exports processed geospatial grids and visual raster assets."""

    def __init__(self, processed_dir: Path | None = None):
        self.processed_dir = processed_dir or settings.DATA_PROCESSED_DIR
        self.processed_dir.mkdir(parents=True, exist_ok=True)

    def export_layer(
        self,
        sector_id: str,
        layer_type: str,
        grid: np.ndarray,
        lats: np.ndarray,
        lons: np.ndarray,
        units: str,
        metadata: dict,
    ) -> dict:
        """Export layer grid JSON and PNG raster preview."""
        sector_dir = self.processed_dir / sector_id
        sector_dir.mkdir(parents=True, exist_ok=True)

        # Compute summary statistics
        valid_mask = ~np.isnan(grid)
        stats = {
            "min": float(np.min(grid[valid_mask])) if np.any(valid_mask) else 0.0,
            "max": float(np.max(grid[valid_mask])) if np.any(valid_mask) else 0.0,
            "mean": float(np.mean(grid[valid_mask])) if np.any(valid_mask) else 0.0,
            "std": float(np.std(grid[valid_mask])) if np.any(valid_mask) else 0.0,
        }

        # Generate a resampled 32x32 representation for smooth 3D terrain rendering
        resampled_32 = resample_grid(grid, 32, 32)

        # Save JSON metadata & grid
        json_payload = {
            "sector_id": sector_id,
            "layer_type": layer_type,
            "units": units,
            "dimensions": list(grid.shape),
            "stats": stats,
            "lats": lats.tolist(),
            "lons": lons.tolist(),
            "grid": grid.tolist(),
            "resampled_grid_32x32": resampled_32.tolist(),
            "metadata": metadata,
            "exported_at": datetime.now(timezone.utc).isoformat(),
        }

        json_path = sector_dir / f"{layer_type}.json"
        with open(json_path, "w", encoding="utf-8") as f:
            json.dump(json_payload, f, indent=2)

        # Generate preview PNG at native grid resolution for crystal-clear 3D draping
        png_path = sector_dir / f"{layer_type}.png"
        h, w = grid.shape
        if layer_type == "elevation":
            rgba = colorize_elevation(grid)
        elif layer_type == "slope":
            rgba = colorize_slope(grid)
        elif layer_type == "roughness":
            rgba = colorize_roughness(grid)
        elif layer_type == "geology":
            rgba = colorize_geology(grid)
        else:
            rgba = colorize_elevation(grid)

        write_png_rgba(png_path, w, h, rgba)

        logger.info(f"Exported layer {layer_type} to {json_path} and {png_path}")
        return {
            "json_path": str(json_path),
            "png_path": str(png_path),
            "stats": stats,
            "dimensions": list(grid.shape),
        }
