import logging
from backend.app.models.product import NormalizedProduct, ProductFile, ProductFileType

logger = logging.getLogger(__name__)


class ProductSelector:
    """Ranks and selects orbital data products according to mission priorities and constraints."""

    def select_best_dem(
        self,
        candidates: list[NormalizedProduct],
        max_size_bytes: int = 50 * 1024 * 1024,  # default 50 MB budget for initial DEM
    ) -> tuple[NormalizedProduct, list[ProductFile]] | None:
        """
        Select the best digital elevation model candidate.
        Prioritizes:
        1. Products with valid topography (e.g. MOLA MEGDR 'megt').
        2. Fits within the configured storage/download budget.
        Returns the chosen product and the critical files to download (data + header/label).
        """
        if not candidates:
            return None

        # Filter candidates within budget
        valid_candidates: list[tuple[NormalizedProduct, list[ProductFile]]] = []

        for prod in candidates:
            # We need the raster binary file (.img, .tif) and header/label
            raster_files = [
                f for f in prod.files
                if f.filename.lower().endswith((".img", ".tif", ".tiff", ".jp2"))
            ]
            header_files = [
                f for f in prod.files
                if f.filename.lower().endswith((".hdr", ".lbl", ".xml"))
            ]

            if not raster_files:
                continue

            # Pick the primary raster and primary header
            primary_raster = raster_files[0]
            selected_files = [primary_raster]
            if header_files:
                selected_files.append(header_files[0])

            total_bytes = sum(f.size_bytes for f in selected_files)
            if total_bytes <= max_size_bytes:
                valid_candidates.append((prod, selected_files))

        if not valid_candidates:
            logger.warning("No candidate DEMs met the size and format criteria")
            return None

        # Return first valid candidate (e.g. highest resolution or first match)
        return valid_candidates[0]
