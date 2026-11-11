# RED PLANET LAB

**Multi-Mission Data Fusion & Intelligent Exploration Planning System**

An interactive Mars exploration decision-support system that automatically discovers, retrieves, validates, fuses, and analyzes orbital datasets for a user-selected region, then compares explainable exploration routes using terrain risk and scientific-interest indicators.

---

## Architecture Overview

* **Backend:** FastAPI (Python 3.12+), Pydantic, NumPy, HTTPX, SQLite, Rasterio / GDAL.
* **Frontend:** React, TypeScript, Three.js / Cesium / Map view.
* **Data Storage:** Local partitioned cache (`data/raw/`, `data/processed/`, `data/cache/`, `data/metadata/`).

---

## Quickstart (Backend)

1. Activate virtual environment:
   ```powershell
   .venv\Scripts\Activate.ps1
   ```

2. Run the development server:
   ```powershell
   uvicorn backend.app.main:app --reload --port 8000
   ```

3. Access the API documentation:
   * Swagger UI: `http://localhost:8000/api/docs`
   * Health Check: `http://localhost:8000/api/health`

---

## Project Guide & Development Rules

See [`AGENT.md`](./AGENT.md) for full project specifications, architectural boundaries, and agent development guidelines.
