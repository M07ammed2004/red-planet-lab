"""Automated data acquisition and processing engine."""
from backend.app.data_engine.adapters.ode_adapter import ODEAdapter
from backend.app.data_engine.downloader import Downloader
from backend.app.data_engine.product_selector import ProductSelector

__all__ = ["Downloader", "ODEAdapter", "ProductSelector"]
