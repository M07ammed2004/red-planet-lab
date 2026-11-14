# RED PLANET LAB

**Multi-Mission Data Fusion & Intelligent Mars Exploration Planning System**

An interactive Mars exploration decision-support platform that discovers, retrieves, validates, fuses, and analyzes real orbital and in-situ scientific datasets for any user-selected Martian sector. It reconstructs 3D terrain and computes explainable, physics-constrained exploration routes comparing distance, terrain hazards, atmospheric storms, and scientific return against actual NASA rover benchmarks.

---

## 🌐 Live Demo (Frontend Preview)

> [!NOTE]  
> **Live Web Demo:** [https://red-planet-lab-five.vercel.app/](https://red-planet-lab-five.vercel.app/)  
> **Important Notice:** This deployed URL provides a **frontend-only interactive preview** demonstrating the UI/UX, Deluxe Observatory styling, 3D Martian globe, 3D terrain meshes, and visual telemetry components. Full dynamic route calculation, live topographic raster processing, and local cache management require running the FastAPI backend locally.

---

## 🚀 Key Features

* **3D Interactive Mars Globe:** Orbit and explore Mars with 39+ USGS/IAU officially cataloged landmarks, rover landing sites, volcanic shields, and exploration sectors.
* **Multi-Mission Orbital Data Fusion:** Seamlessly switches between MOLA elevation relief, Viking orbital imagery mosaics, USGS geologic stratigraphic units, and traversability slope hazard maps.
* **Multi-Strategy 3D Traverse Planner ($A^*$):**
  * ⚡ **FASTEST:** Distance and traverse time minimization.
  * 🛡️ **SAFEST:** Minimizes slope gradients, terrain roughness, and actively bypasses atmospheric dust hazards.
  * 🔬 **SCIENTIFIC EXPLORATION:** Maximizes scientific ROI by guiding rovers toward high-value geologic outcrops, bedrock contacts, and crater rims.
  * 🚀 **NASA GROUND TRUTH BENCHMARKS:** Direct overlay and comparison against historical NASA rover paths (Perseverance in Jezero Crater and Curiosity in Gale Crater).
* **Martian Atmosphere & Dust Storm Simulation:**
  * Real-time telemetry modeled from NASA in-situ weather stations.
  * Dynamic volumetric 3D dust storm vortexes with wind shear rings.
  * Autonomous storm evasion: active storm cores act as impassable hazard obstacles, forcing the Safest path to execute calibrated safety detours.
* **In-Situ Rover Surface Photography:** High-resolution surface images captured by Mastcam-Z, Navcam, and MAHLI matched to sector coordinates and geology.

---

## 🛰️ Scientific Datasets & Resources Used

Red Planet Lab relies on authenticated, peer-reviewed planetary datasets and mission archives provided by NASA, USGS, and the IAU:

### 1. Topography & Elevation (Digital Elevation Models - DEM)
* **NASA MGS MOLA MEGDR (Mars Orbiter Laser Altimeter):**  
  Global elevation data at 128 pixels/degree (~463 meters/pixel spatial resolution) referenced to the Martian areoid ($R = 3,396,190\text{ m}$).  
  *Source:* NASA Planetary Data System (PDS) Geosciences Node / USGS Astrogeology.
* **High-Resolution Elevation References:** HiRISE and HRSC DTM regional benchmarks for rover-scale slope validation.

### 2. Orbital Imagery & Remote Sensing
* **Viking MDIM 2.1 (Mars Digital Image Mosaic):**  
  Global radiometric and geodetically controlled visible basemap.  
  *Source:* USGS Astrogeology Science Center & NASA Mars Trek WMS API.
* **MRO Context Camera (CTX) & HiRISE:**  
  Detailed surface morphology and targeted crater/delta reconnaissance.  
  *Source:* NASA Jet Propulsion Laboratory (JPL) / University of Arizona.

### 3. Planetary Nomenclature & Geologic Mapping
* **USGS / IAU Gazetteer of Planetary Nomenclature:**  
  Official database of planetary feature names, coordinates, feature types, and approvals maintained by the International Astronomical Union (IAU) Working Group for Planetary System Nomenclature (WGPSN).
* **Global Geologic Map of Mars (USGS SIM 3292):**  
  Stratigraphic unit classification (Amazonian, Hesperian, Noachian units, volcanic plains, and fluvial-lacustrine sedimentary units) based on Tanaka et al. (2014).

### 4. In-Situ Atmospheric & Meteorological Telemetry
* **NASA Mars 2020 Perseverance MEDA (Mars Environmental Dynamics Analyzer):**  
  Real surface atmospheric pressure (~740 Pa in Jezero), air/ground temperatures, prevailing wind vectors, and dust optical depth ($\tau$) measurements.
* **NASA MSL Curiosity REMS (Rover Environmental Monitoring Station):**  
  Diurnal meteorological cycle data, atmospheric density, and katabatic wind patterns across Gale Crater and Mount Sharp.
* **NASA InSight APSS (Auxiliary Payload Sensor Suite):**  
  Martian dust devil vortex dynamics and pressure drop profiles.

### 5. Ground Truth Rover Traverses & In-Situ Surface Photos
* **NASA Mars 2020 Perseverance Traverse Logs:**  
  Waypoint-by-waypoint historical mission route from Octavia E. Butler Landing across the delta front to the crater margin.  
  *Source:* NASA PDS & Mars Trek GeoJSON API.
* **NASA MSL Curiosity Traverse Logs:**  
  Traverse data from Bradbury Landing through Yellowknife Bay and the Pahrump Hills up Mount Sharp.
* **NASA Mars Surface Raw Imagery:**  
  In-situ ground photos from Mastcam-Z, Navcam, Hazcam, and MAHLI instruments retrieved via the NASA Mars Photos API and PDS Imaging Node.

---

## 🏗️ Architecture & Tech Stack

* **Frontend:**
  * React 19, TypeScript, Vite.
  * **Three.js / WebGL:** 3D interactive Mars globe, volumetric dust storm vortex, and dynamically lit elevation terrains.
  * **Design System:** Deluxe Observatory Theme (warm parchment palette, responsive HUD, custom SVG elevation profiles).
* **Backend:**
  * Python 3.12+, FastAPI, Uvicorn (ASGI).
  * **Scientific Computing:** NumPy, SciPy (traversability matrices, Gaussian plume grids, gradient operators).
  * **Data Access & Storage:** HTTPX (async REST & WMS client), SQLite, local cache tier (`data/raw/`, `data/processed/`, `data/cache/`).
* **Pathfinding & AI Navigation:**
  * Multi-criteria $A^*$ algorithm with dynamic hazard weights, slope cutoffs, and wind vector penalties.

---

## 🛠️ Quickstart (Running Locally)

### Prerequisites
* Python 3.11+ or 3.12+
* Node.js 18+ and npm

### 1. Run the Backend API
```powershell
# In project root
.venv\Scripts\Activate.ps1
# Install dependencies
pip install -r backend/requirements.txt
# Launch FastAPI
uvicorn backend.app.main:app --reload --port 8000
```
* **Interactive API Docs (Swagger):** `http://localhost:8000/api/docs`
* **Health Check:** `http://localhost:8000/api/health`

### 2. Run the Interactive Frontend
```powershell
cd frontend
npm install
npm run dev
```
* **Web Application:** `http://localhost:5173`

---

## 📖 Project Documentation & Guidelines

* See [`AGENT.md`](./AGENT.md) for architectural boundaries, coordinate frame standards (IAU 2000 Mars Areoid), and development guidelines.
