# RED PLANET LAB

**Multi-Mission Data Fusion & Intelligent Exploration Planning System**

An interactive Mars exploration decision-support system that automatically discovers, retrieves, validates, fuses, and analyzes orbital datasets for a user-selected region, then compares explainable exploration routes using terrain risk and scientific-interest indicators.

---

## Architecture Overview

* **Backend:** FastAPI (Python 3.12+), Pydantic, NumPy, HTTPX, SQLite, Rasterio / GDAL.
* **Frontend:** React 19, TypeScript, Vite.
* **Data Storage:** Local partitioned cache (`data/raw/`, `data/processed/`, `data/cache/`, `data/metadata/`).

---

## Quickstart

### 1. Run the Backend API
```powershell
# In project root
.venv\Scripts\Activate.ps1
uvicorn backend.app.main:app --reload --port 8000
```
* **API Documentation:** `http://localhost:8000/api/docs`
* **Health Check:** `http://localhost:8000/api/health`

### 2. Run the Interactive Frontend
```powershell
cd frontend
npm run dev
```
* **Web UI:** `http://localhost:5173`

---

## Project Guide & Development Rules

See [`AGENT.md`](./AGENT.md) for full project specifications, architectural boundaries, and agent development guidelines.
