import numpy as np
from backend.app.processing.dem_reader import CroppedDEM


def compute_slope(
    cropped: CroppedDEM,
    trim_buffer: bool = True,
    nodata_value: float | None = None,
) -> tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray]:
    """
    Calculate terrain slope in degrees from a CroppedDEM.

    Formula (AGENT.md Section 9.1):
        Slope = arctan( sqrt( (dz/dx)^2 + (dz/dy)^2 ) )

    Returns:
        (slope_deg, trimmed_elevation, trimmed_lats, trimmed_lons)
    """
    elev = cropped.elevation.copy()
    rows, cols = elev.shape

    # Handle NoData mask if provided
    mask = np.zeros_like(elev, dtype=bool)
    if nodata_value is not None:
        mask = (elev == nodata_value)

    # Compute vertical gradient (dz/dy)
    # Note: line index 0 is north, so increasing row means decreasing latitude (moving south)
    # central differences with dy
    grad_y = np.zeros_like(elev)
    dy = cropped.dy_meters

    # Interior rows
    grad_y[1:-1, :] = (elev[2:, :] - elev[:-2, :]) / (2.0 * dy)
    # Edge rows (forward/backward difference)
    grad_y[0, :] = (elev[1, :] - elev[0, :]) / dy
    grad_y[-1, :] = (elev[-1, :] - elev[-2, :]) / dy

    # Compute horizontal gradient (dz/dx) using row-specific dx
    grad_x = np.zeros_like(elev)
    for r in range(rows):
        dx_row = max(cropped.dx_meters[r], 1.0)
        # Interior cols
        grad_x[r, 1:-1] = (elev[r, 2:] - elev[r, :-2]) / (2.0 * dx_row)
        # Edge cols
        grad_x[r, 0] = (elev[r, 1] - elev[r, 0]) / dx_row
        grad_x[r, -1] = (elev[r, -1] - elev[r, -2]) / dx_row

    # Combined magnitude of slope gradient
    gradient_magnitude = np.sqrt(grad_x**2 + grad_y**2)
    slope_radians = np.arctan(gradient_magnitude)
    slope_degrees = np.degrees(slope_radians)

    # Apply mask
    slope_degrees[mask] = np.nan

    # Trim 1-pixel buffer if requested to avoid edge artifacts
    if trim_buffer and cropped.has_buffer and rows > 2 and cols > 2:
        slope_final = slope_degrees[1:-1, 1:-1]
        elev_final = elev[1:-1, 1:-1]
        lats_final = cropped.lats[1:-1]
        lons_final = cropped.lons[1:-1]
    else:
        slope_final = slope_degrees
        elev_final = elev
        lats_final = cropped.lats
        lons_final = cropped.lons

    return slope_final, elev_final, lats_final, lons_final


def compute_roughness(elevation: np.ndarray, window_size: int = 3) -> np.ndarray:
    """
    Calculate terrain roughness as local elevation standard deviation
    within a moving window (AGENT.md Section 9.2).
    """
    rows, cols = elevation.shape
    half = window_size // 2
    roughness = np.zeros_like(elevation)

    # Pad elevation at edges
    padded = np.pad(elevation, pad_width=half, mode="edge")

    for r in range(rows):
        for c in range(cols):
            window = padded[r : r + window_size, c : c + window_size]
            roughness[r, c] = np.std(window)

    return roughness


def resample_grid(grid: np.ndarray, target_rows: int, target_cols: int) -> np.ndarray:
    """
    Bilinear interpolation to resample a grid into a target shape.
    Useful for local surface 3D mesh rendering while preserving min/max boundaries.
    """
    src_rows, src_cols = grid.shape
    if (src_rows, src_cols) == (target_rows, target_cols):
        return grid.copy()

    # Create coordinate grids
    r_coords = np.linspace(0, src_rows - 1, target_rows)
    c_coords = np.linspace(0, src_cols - 1, target_cols)

    r0 = np.floor(r_coords).astype(int)
    r1 = np.minimum(r0 + 1, src_rows - 1)
    c0 = np.floor(c_coords).astype(int)
    c1 = np.minimum(c0 + 1, src_cols - 1)

    dr = (r_coords - r0)[:, None]
    dc = (c_coords - c0)[None, :]

    top = (1 - dc) * grid[r0[:, None], c0[None, :]] + dc * grid[r0[:, None], c1[None, :]]
    bottom = (1 - dc) * grid[r1[:, None], c0[None, :]] + dc * grid[r1[:, None], c1[None, :]]

    resampled = (1 - dr) * top + dr * bottom
    return resampled.astype(np.float32)
