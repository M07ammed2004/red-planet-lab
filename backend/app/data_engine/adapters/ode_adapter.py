import logging
from datetime import datetime
from typing import Any
import httpx
from backend.app.core.config import settings
from backend.app.models.product import (
    NormalizedProduct,
    ProductFile,
    ProductFileType,
    SpatialFootprint,
)
from backend.app.models.sector import SectorBounds

logger = logging.getLogger(__name__)


class ODEAdapter:
    """Adapter for NASA PDS Geosciences Node Orbital Data Explorer (ODE) REST API."""

    def __init__(
        self,
        base_url: str | None = None,
        timeout: int | None = None,
    ):
        self.base_url = base_url or "https://oderest.rsl.wustl.edu/live2/"
        self.timeout = timeout or settings.REQUEST_TIMEOUT_SECONDS
        self.headers = {
            "User-Agent": f"RedPlanetLab/{settings.VERSION} (Exploration Decision Support System)",
            "Accept": "application/json",
        }

    def _map_file_type(self, raw_type: str | None, filename: str) -> ProductFileType:
        """Categorize product file based on ODE descriptor and file extension."""
        upper_type = (raw_type or "").upper()
        ext = filename.split(".")[-1].lower() if "." in filename else ""

        if "PRODUCT" in upper_type or ext in ("img", "tif", "jp2", "cub"):
            return ProductFileType.PRODUCT
        if "LABEL" in upper_type or ext in ("lbl", "xml"):
            return ProductFileType.LABEL
        if "HEADER" in upper_type or ext in ("hdr",):
            return ProductFileType.HEADER
        if "BROWSE" in upper_type or "COLOR IMAGE" in upper_type or ext in ("png", "jpg", "jpeg"):
            return ProductFileType.BROWSE
        if "DERIVED" in upper_type:
            return ProductFileType.DERIVED
        if "DOCUMENT" in upper_type or ext in ("pdf", "txt"):
            return ProductFileType.DOCUMENT
        return ProductFileType.REFERENCED

    def _normalize_product_item(
        self,
        item: dict[str, Any],
        mission: str,
        instrument: str,
        product_type: str,
    ) -> NormalizedProduct:
        """Convert an individual ODE product dict into a NormalizedProduct."""
        # Product ID resolution
        pds_id = (
            item.get("pdsid")
            or item.get("PdsId")
            or item.get("Observation_id")
            or item.get("Product_name")
            or item.get("ProductURL", "").split("product_id=")[-1].split("&")[0]
            or "UNKNOWN_ID"
        )
        if isinstance(pds_id, str) and "." in pds_id and len(pds_id) > 4:
            base_pds = pds_id.split(".")[0]
        else:
            base_pds = pds_id

        # Footprint parsing
        def _to_float(v: Any, default: float = 0.0) -> float:
            try:
                return float(v) if v is not None else default
            except (ValueError, TypeError):
                return default

        min_lat = _to_float(item.get("Minimum_latitude"), -90.0)
        max_lat = _to_float(item.get("Maximum_latitude"), 90.0)
        w_lon = _to_float(item.get("Westernmost_longitude"), 0.0)
        e_lon = _to_float(item.get("Easternmost_longitude"), 360.0)
        c_lat = _to_float(item.get("Center_latitude"), (min_lat + max_lat) / 2.0)
        c_lon = _to_float(item.get("Center_longitude"), (w_lon + e_lon) / 2.0)

        footprint = SpatialFootprint(
            min_lat=min_lat,
            max_lat=max_lat,
            western_lon=w_lon,
            eastern_lon=e_lon,
            center_lat=c_lat,
            center_lon=c_lon,
            geometry_wkt=item.get("Footprint_geometry") or item.get("Footprint_C0_geometry"),
        )

        # Observation time
        obs_time = None
        obs_str = item.get("UTC_start_time") or item.get("Observation_time")
        if obs_str:
            try:
                obs_time = datetime.fromisoformat(obs_str.replace("Z", "+00:00"))
            except Exception:
                pass

        # Resolution / pixel scale
        map_scale = _to_float(item.get("Map_scale"))
        pixel_scale = map_scale if map_scale > 0 else None

        return NormalizedProduct(
            product_id=base_pds,
            source_archive="ODE",
            mission=mission,
            instrument=instrument,
            product_type=product_type,
            description=item.get("Description"),
            spatial_footprint=footprint,
            pixel_scale_meters=pixel_scale,
            observation_time=obs_time,
            product_url=item.get("ProductURL"),
            label_url=item.get("LabelURL"),
            files=[],
            estimated_download_bytes=0,
            quality_flags={
                "cross_meridian": item.get("Footprints_cross_meridian", False),
                "georeferenced": item.get("BB_georeferenced", True),
                "producer_id": item.get("Producer_id", ""),
            },
        )

    async def get_product_files(
        self,
        product_id: str,
        mission: str,
        instrument: str,
        product_type: str,
    ) -> list[ProductFile]:
        """Fetch file list and download URLs for a specific product ID."""
        params = {
            "query": "product",
            "target": "mars",
            "ihid": mission,
            "iid": instrument,
            "pt": product_type,
            "pdsid": product_id,
            "output": "JSON",
            "results": "f",
        }
        try:
            async with httpx.AsyncClient(timeout=self.timeout, follow_redirects=True) as client:
                resp = await client.get(self.base_url, params=params, headers=self.headers)
                resp.raise_for_status()
                data = resp.json()

            products_wrapper = data.get("ODEResults", {}).get("Products", {})
            if isinstance(products_wrapper, dict):
                prod_block = products_wrapper.get("Product", {})
            else:
                prod_block = {}

            if isinstance(prod_block, list):
                prod_block = prod_block[0] if prod_block else {}
            if not isinstance(prod_block, dict):
                return []

            files_wrapper = prod_block.get("Product_files", {})
            if isinstance(files_wrapper, dict):
                raw_files = files_wrapper.get("Product_file", [])
            else:
                raw_files = []
            if isinstance(raw_files, dict):
                raw_files = [raw_files]

            files_list: list[ProductFile] = []
            for f in raw_files:
                fname = f.get("FileName", "unknown")
                furl = f.get("URL", "")
                try:
                    kbytes = float(f.get("KBytes", 0))
                except (ValueError, TypeError):
                    kbytes = 0.0
                bytes_size = int(kbytes * 1024)
                ftype = self._map_file_type(f.get("Description") or f.get("Type"), fname)
                files_list.append(
                    ProductFile(
                        filename=fname,
                        url=furl,
                        size_bytes=bytes_size,
                        file_type=ftype,
                        description=f.get("Description"),
                    )
                )
            return files_list

        except Exception as e:
            logger.warning(f"Failed to fetch files for product {product_id}: {e}")
            return []

    async def query_products(
        self,
        bounds: SectorBounds,
        mission: str,
        instrument: str,
        product_type: str,
        limit: int = 5,
        fetch_files_for_top: int = 1,
    ) -> list[NormalizedProduct]:
        """Query products covering the given bounds from ODE."""
        params: dict[str, Any] = {
            "query": "product",
            "target": "mars",
            "ihid": mission,
            "iid": instrument,
            "pt": product_type,
            "output": "JSON",
            "minlat": bounds.min_lat,
            "maxlat": bounds.max_lat,
            "westernlon": bounds.min_lon,
            "easternlon": bounds.max_lon,
            "results": "m",  # fetch metadata reliably across ODE versions
            "limit": limit,
        }

        try:
            async with httpx.AsyncClient(timeout=self.timeout, follow_redirects=True) as client:
                resp = await client.get(self.base_url, params=params, headers=self.headers)
                resp.raise_for_status()
                data = resp.json()

            results_block = data.get("ODEResults", {})
            if results_block.get("Status") != "Success":
                error_msg = results_block.get("Error", "Unknown ODE API error")
                logger.warning(f"ODE API returned error: {error_msg}")
                return []

            products_raw = results_block.get("Products", {}).get("Product", [])
            if isinstance(products_raw, dict):
                products_raw = [products_raw]

            normalized: list[NormalizedProduct] = []
            for item in products_raw:
                prod = self._normalize_product_item(item, mission, instrument, product_type)
                normalized.append(prod)

            # Fetch files for top products if requested
            for i in range(min(fetch_files_for_top, len(normalized))):
                prod = normalized[i]
                prod.files = await self.get_product_files(
                    product_id=prod.product_id,
                    mission=mission,
                    instrument=instrument,
                    product_type=product_type,
                )
                prod.estimated_download_bytes = sum(f.size_bytes for f in prod.files)

            return normalized

        except httpx.HTTPError as e:
            logger.error(f"HTTP error connecting to ODE API: {e}")
            raise
        except Exception as e:
            logger.error(f"Unexpected error querying ODE API: {e}")
            raise

    async def query_mola_topography(
        self,
        bounds: SectorBounds,
        limit: int = 5,
    ) -> list[NormalizedProduct]:
        """Query MOLA Experiment Gridded Topography (MEGDR) products."""
        all_prods = await self.query_products(
            bounds=bounds,
            mission="MGS",
            instrument="MOLA",
            product_type="MEGDR",
            limit=limit * 2,  # query more to allow filtering for megt
            fetch_files_for_top=0,
        )
        # Filter for 'megt' (topography) products
        topography_prods = [
            p for p in all_prods
            if p.product_id.lower().startswith("megt")
        ]
        # Attach files to the top topography product
        if topography_prods:
            top_prod = topography_prods[0]
            top_prod.files = await self.get_product_files(
                product_id=top_prod.product_id,
                mission="MGS",
                instrument="MOLA",
                product_type="MEGDR",
            )
            top_prod.estimated_download_bytes = sum(f.size_bytes for f in top_prod.files)

        return topography_prods[:limit]

    async def query_hirise_imagery(
        self,
        bounds: SectorBounds,
        limit: int = 3,
    ) -> list[NormalizedProduct]:
        """Query MRO HiRISE RDR imagery products."""
        return await self.query_products(
            bounds=bounds,
            mission="MRO",
            instrument="HIRISE",
            product_type="RDRV11",
            limit=limit,
            fetch_files_for_top=1,
        )
