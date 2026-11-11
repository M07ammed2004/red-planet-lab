# RED PLANET LAB --- Project Agent Guide

> **Document purpose:** Single source of truth for AI coding agents and
> human contributors. **Project status:** Pre-implementation / hackathon
> MVP planning. **Last updated:** 2026-11-11

------------------------------------------------------------------------

## 1. Project Identity

**Project name:** RED PLANET LAB\
**Full name:** Multi-Mission Data Fusion & Intelligent Exploration
Planning System

**One-line description:**\
An interactive Mars exploration decision-support system that
automatically discovers, retrieves, validates, fuses, and analyzes
orbital datasets for a user-selected region, then compares explainable
exploration routes using terrain risk and scientific-interest
indicators.

**Core promise:**\
The user selects a region. The system handles the data workflow
automatically wherever source access permits: discover suitable
products, select them, download them, validate and process them,
generate analysis layers, and prepare route-planning options.

**Important scope statement:**\
This is a regional mission-planning and scientific decision-support
prototype. It is not a rover controller, autonomous driving system,
real-time obstacle detector, or a claim of new scientific discovery.

------------------------------------------------------------------------

## 2. Problem and Proposed Value

Mars data is distributed across multiple missions, instruments,
archives, formats, coordinate systems, and resolutions. A user should
not need to manually search several portals, download files, crop
rasters, align layers, and build a route-analysis workflow.

RED PLANET LAB aims to: 1. Make relevant Mars orbital data discoverable
through one workflow. 2. Reduce unnecessary downloads by retrieving only
data relevant to a selected region. 3. Keep source provenance and data
limitations visible. 4. Derive interpretable terrain and science
indicators. 5. Compare routes under different mission priorities. 6.
Present the workflow as an engaging exploration experience without
sacrificing scientific honesty.

------------------------------------------------------------------------

## 3. Product Principles

1.  **Automation first:** Manual file handling is not the normal user
    workflow.
2.  **Selective retrieval:** Never attempt to download the entire Mars
    archive for the MVP.
3.  **Evidence over decoration:** Every displayed scientific layer must
    trace back to a source product or a documented calculation.
4.  **Graceful degradation:** Missing data is represented as missing,
    never fabricated.
5.  **Explainability:** Show why a product, score, risk level, or route
    was selected.
6.  **Reproducibility:** Save source IDs, URLs, timestamps, processing
    parameters, coordinate reference systems, and software versions.
7.  **Cache intelligently:** Reuse validated downloads and processed
    outputs.
8.  **Safety constraints first:** Scientific reward must never override
    a hard route-safety constraint.
9.  **Honest storytelling:** "Discovered" means processed by this
    application, not newly discovered by humanity or unknown to NASA.
10. **Hackathon realism:** Deliver a working narrow vertical slice
    before optional advanced features.

------------------------------------------------------------------------

## 4. Target User Experience

The proposed experience has three main screens.

### 4.1 MARS OVERVIEW

-   Display a Mars global map or globe.
-   Overlay a selectable grid of sectors.
-   Show each sector's application state and known data coverage.
-   Let the user select a sector and inspect its ID, coordinates, area,
    known coverage, and estimated download size.
-   Start the automatic exploration pipeline.

### 4.2 SECTOR EXPLORATION

-   Show the selected sector in a local 3D terrain view when a valid DEM
    is available.
-   Provide independently switchable layers:
    -   Imagery
    -   Elevation
    -   Slope
    -   Roughness
    -   Thermal
    -   Mineral / spectral indicators
    -   Risk
    -   Scientific interest
-   Clearly label unavailable, pending, failed, or low-confidence
    layers.
-   Display data source and processing details for each layer.

### 4.3 MISSION CONTROL

-   Let the user select start and destination points inside the valid
    planning area.
-   Compare:
    -   Fastest Route
    -   Safest Route
    -   Scientific Exploration Route
-   Show route distance, cost, elevation profile where available, risk
    exposure, science score, and a plain-language explanation.
-   Generate a mission summary/report with sources and limitations.

**UI direction:** Gaming-inspired, interactive, and story-driven, but
scientifically accurate. Proposed default is a 3D Mars overview followed
by a local surface view. This visual decision is not final until the
team confirms it.

------------------------------------------------------------------------

## 5. Sector Grid and State Model

### 5.1 Grid strategy

Proposed implementation: - Use a **square grid internally** for simple
raster indexing, bounding-box calculation, and processing. - Optionally
render the sectors as **hexagons visually** for a game-like map. - A
geological-region model is a possible later alternative.

The visual grid choice is still a product decision. Do not hard-code the
internal data model to depend on hexagonal geometry.

### 5.2 Sector identity

Each sector should have a stable ID and a geographic definition in the
selected Mars coordinate reference system.

Suggested metadata: - `sector_id` - `name` - `bounds` - `center` -
`area_km2` - `coordinate_reference_system` - `state` - `created_at` -
`updated_at` - `last_scan_at` - `available_layers` - `missing_layers` -
`source_products` - `estimated_download_bytes` - `processing_version` -
`error_message`

### 5.3 Sector state machine

Recommended states: - `UNSCOUTED` - `SCANNING` - `DATA_FOUND` -
`DOWNLOADING` - `PROCESSING` - `DISCOVERED` - `PARTIALLY_DISCOVERED` -
`FAILED`

Rules: - `DISCOVERED` requires the agreed minimum viable layer set to
pass validation. - `PARTIALLY_DISCOVERED` means useful data exists, but
one or more required or expected layers are unavailable or invalid. -
Optional layers being absent does not automatically make a sector
unusable. - A failed step must preserve diagnostic information and
support retry. - State must persist across application restarts. -
"Unscouted" means not yet processed by this application; it does not
mean NASA has never studied the region.

Each layer also has its own state, independent of the sector state: -
`NOT_CHECKED` - `SEARCHING` - `AVAILABLE` - `DOWNLOADING` -
`PROCESSING` - `READY` - `UNAVAILABLE` - `FAILED`

------------------------------------------------------------------------

## 6. Automatic Data Pipeline

The intended user workflow is:

1.  User selects a sector.
2.  Convert sector geometry into a valid spatial query / bounding
    region.
3.  Discover candidate products from supported archives.
4.  Normalize product metadata into a common internal schema.
5.  Filter products by spatial overlap, instrument, resolution, quality,
    format, date, and file size.
6.  Rank candidates and select products according to the configured
    policy.
7.  Estimate download volume and check available disk space.
8.  Download selected products automatically.
9.  Validate file integrity, format, dimensions, NoData values, units,
    metadata, and spatial reference.
10. Reproject, crop, resample, and align data only where scientifically
    appropriate.
11. Generate derived layers.
12. Save source provenance, processing metadata, and cached outputs.
13. Update sector and layer states.
14. Render the available layers in the UI.
15. Make valid layers available to route planning.

### 6.1 Automation requirements

-   No manual download step should be required in the normal path.
-   Use asynchronous/background jobs for long-running discovery,
    download, and processing tasks.
-   Provide progress events for each stage.
-   Support retry with bounded retries and backoff.
-   Support cancellation where practical.
-   Avoid downloading the same product twice.
-   Use temporary files and atomic finalization so incomplete downloads
    are not treated as valid.
-   Enforce configurable download and storage limits.
-   Record errors per product; one failed optional product should not
    necessarily fail the entire sector.
-   Do not silently substitute unrelated data.
-   If the network or archive is unavailable, show a clear error and
    optionally use a clearly labelled cached demo dataset.

### 6.2 Product selection

Candidate ranking may consider: - Spatial overlap with sector - Spatial
resolution / pixel scale - Coverage fraction - Instrument suitability
for the layer - Product quality and processing level - File size and
download feasibility - Acquisition time, where relevant

The ranking policy must be documented and visible enough to explain why
a product was selected. Do not assume all instruments cover the same
sector or provide compatible products.

------------------------------------------------------------------------

## 7. Data Sources and Their Roles

These are candidate sources. Each adapter must be implemented and tested
against current documentation and actual responses.

  -----------------------------------------------------------------------
  Source                  Main role               Notes
  ----------------------- ----------------------- -----------------------
  NASA PDS APIs /         Product discovery and   Use archive/product
  archives                metadata                identifiers and
                                                  official access paths.

  Mars Orbital Data       Spatial search,         Useful for Mars orbital
  Explorer (ODE)          coverage, product       product discovery.
                          metadata and download   
                          discovery               

  MOLA                    Elevation / topography  Select a suitable DEM
                                                  product and document
                                                  its resolution and
                                                  limitations.

  HiRISE                  High-resolution surface Large products; select
                          imagery                 only relevant images
                                                  and suitable processing
                                                  products.

  THEMIS                  Thermal / infrared      Availability and
                          observations            product type vary by
                                                  region and instrument
                                                  mode.

  CRISM                   Spectral / mineral      Requires careful
                          indicators              interpretation; do not
                                                  label raw spectral
                                                  values as confirmed
                                                  minerals without a
                                                  valid method.

  NASA Mars Trek WMTS     Global basemap and map  Suitable for map
                          tiles                   visualization; not a
                                                  replacement for a
                                                  quantitative DEM used
                                                  for slope calculations.
  -----------------------------------------------------------------------

Useful official starting points: - Mars Trek:
https://trek.nasa.gov/mars/ - Mars Trek WMTS documentation:
https://trek.nasa.gov/tiles/apidoc/trekAPI.html?body=mars - Mars ODE:
https://ode.rsl.wustl.edu/mars2/ - NASA PDS API documentation:
https://nasa-pds.github.io/pds-api/ - MOLA archive:
https://pds-geosciences.wustl.edu/ - HiRISE: https://www.uahirise.org/ -
THEMIS: https://themis.asu.edu/ - CRISM:
https://pds-geosciences.wustl.edu/missions/mro/crism.htm

### 7.1 Adapter design

Keep each source behind a separate adapter, for example: -
`PDSAdapter` - `ODEAdapter` - `MOLAAdapter` - `HiRISEAdapter` -
`THEMISAdapter` - `CRISMAdapter` - `MarsTrekTileAdapter`

Adapters should return normalized metadata objects rather than leaking
source-specific response structures into the rest of the application.

A normalized product record should include, when available: - Product
ID - Source/archive - Mission and instrument - Product type / processing
level - Spatial footprint / bounds - Coordinate reference system - Pixel
scale / resolution - Acquisition time - Format - File size - Download
URL - Metadata URL - Quality / processing flags - Availability and
access status

Never assume every field is present. Preserve unknown values as unknown.

------------------------------------------------------------------------

## 8. Geospatial Processing Rules

Use a consistent, explicitly documented Mars coordinate reference system
for each product and operation.

Important rules: - Do not assume Mars data uses Earth WGS84. - Inspect
source labels and metadata for coordinate system, datum, projection,
units, and axis conventions. - Do not align rasters by simply resizing
images. - Reproject only with a scientifically appropriate target CRS. -
Choose a target pixel size deliberately; avoid implying that resampling
creates new information. - Track NoData masks through every operation. -
Preserve original source files separately from processed derivatives. -
Keep layer metadata, resolution, and uncertainty attached to outputs. -
Use WMTS for visualization tiles, not as a quantitative elevation source
unless a documented service explicitly provides suitable elevation data.

Suggested tools: - Rasterio - GDAL - PyProj - NumPy - SciPy - GeoPandas
when vector geometry workflows require it

------------------------------------------------------------------------

## 9. Analysis and Algorithms

All scores below are prototype indicators. They must be normalized,
documented, and tested against real data. Their weights are
configurable, not universal scientific constants.

### 9.1 Slope

For elevation surface `z`:

\[ Slope =
`\tan`{=tex}\^{-1}`\left`{=tex}(`\sqrt{(\partial z/\partial x)^2 + (\partial z/\partial y)^2}`{=tex}`\right`{=tex})
\]

Implementation must account for horizontal and vertical units, pixel
spacing, NoData cells, and the map projection.

### 9.2 Roughness

Choose and document a reproducible terrain roughness measure, such as
local elevation standard deviation or a defined neighborhood-based
metric. Do not mix roughness definitions without recording which was
used.

### 9.3 Risk indicator

Prototype form:

\[ R = w_s S + w_r T + w_u U \]

Where: - `S`: normalized slope indicator - `T`: normalized roughness
indicator - `U`: uncertainty / data-quality indicator - `w_s`, `w_r`,
`w_u`: configurable weights

Interpretation: - This is a relative planning risk indicator, not a
calibrated probability of rover failure or accident. - Missing or
low-quality data should increase uncertainty or reduce confidence, not
be silently treated as safe. - Define hard constraints for cells that
exceed configured limits.

### 9.4 Scientific-interest indicator

Prototype form:

\[ SCI = w_m M + w_g G + w_d D \]

Where: - `M`: supported mineral / spectral indicators from suitable
CRISM products - `G`: documented geological context or evidence - `D`:
selected geomorphological / terrain features

Do not claim mineral identification unless the input product and
processing method support that interpretation. Store the evidence and
confidence for each component.

### 9.5 Route cost

Prototype edge cost:

\[ C\_{edge} = d(1 + `\alpha `{=tex}R - `\beta `{=tex}SCI) \]

Requirements: - `d` is distance between adjacent cells. - Normalize risk
and science terms before combining. - Apply hard safety constraints
before science reward. - Ensure edge costs remain non-negative and
suitable for the selected pathfinding algorithm. - Prevent
scientific-interest rewards from making forbidden or unsafe cells
traversable. - Document the meaning and range of `alpha` and `beta`.

### 9.6 Route options

-   **Fastest:** minimize distance or travel cost under the same hard
    constraints.
-   **Safest:** minimize risk-weighted cost.
-   **Scientific Exploration:** optimize a documented
    science/risk/distance trade-off while respecting hard safety
    constraints.

Use A\* or another justified algorithm. Ensure the heuristic is
admissible if optimality is claimed. If using a non-admissible heuristic
or approximate method, label the result accordingly.

### 9.7 Scientific and engineering limitations

-   Orbital DEMs do not reveal every small obstacle a rover would
    encounter at ground level.
-   Route results are regional planning paths, not autonomous rover
    navigation.
-   Different datasets may have different resolution, coverage,
    acquisition times, and uncertainty.
-   Do not imply that a missing layer has zero risk or zero scientific
    value.
-   Report uncertainty and data gaps alongside route recommendations.

------------------------------------------------------------------------

## 10. Proposed Technical Architecture

### 10.1 Recommended stack

**Frontend** - React - TypeScript - Three.js for globe / local 3D
terrain rendering - A suitable map component for 2D sector interaction

**Backend** - Python - FastAPI - Pydantic for request/response and
normalized metadata models

**Data and processing** - Rasterio / GDAL - PyProj - NumPy / SciPy -
GeoPandas where needed

**Algorithms** - NetworkX or a focused custom grid-based A\*
implementation

**Persistence** - SQLite for sector state, product metadata, jobs, and
provenance in the MVP - Local filesystem cache for raw and processed
raster assets

**Integration** - HTTP clients such as Requests or HTTPX - Background
job mechanism appropriate to the MVP - WebSocket or polling for progress
updates

### 10.2 Architecture boundaries

-   Frontend must not directly download and process large archive
    products.
-   Backend owns discovery, product selection, downloads, validation,
    processing, analysis, and route planning.
-   Source adapters isolate external APIs and archive-specific formats.
-   Processing modules must be testable without the UI.
-   Long-running work must not block ordinary API requests.
-   The UI consumes normalized API responses and progress events.

### 10.3 Suggested repository structure

``` text
red-planet-lab/
├── AGENT.md
├── README.md
├── .gitignore
├── .env.example
├── backend/
│   ├── app/
│   │   ├── main.py
│   │   ├── api/
│   │   ├── core/
│   │   ├── models/
│   │   ├── database/
│   │   ├── jobs/
│   │   ├── data_engine/
│   │   │   ├── adapters/
│   │   │   ├── discovery.py
│   │   │   ├── product_selector.py
│   │   │   └── downloader.py
│   │   ├── processing/
│   │   ├── intelligence/
│   │   ├── route_planning/
│   │   └── reporting/
│   ├── tests/
│   └── pyproject.toml
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   ├── components/
│   │   ├── features/
│   │   ├── services/
│   │   └── types/
│   └── package.json
├── data/
│   ├── raw/
│   ├── processed/
│   ├── cache/
│   └── metadata/
└── docs/
    ├── architecture/
    ├── data-sources/
    └── decisions/
```

This is a target structure, not a requirement to create every folder on
day one. Build incrementally.

------------------------------------------------------------------------

## 11. API Design Direction

Initial API surface (names may evolve): - `GET /api/health` -
`GET /api/sectors` - `GET /api/sectors/{sector_id}` -
`POST /api/sectors/{sector_id}/scan` - `GET /api/jobs/{job_id}` -
`POST /api/jobs/{job_id}/cancel` -
`GET /api/sectors/{sector_id}/layers` -
`GET /api/sectors/{sector_id}/products` - `POST /api/routes/plan` -
`GET /api/reports/{report_id}`

API responses should use explicit schemas and stable status values. Do
not expose raw upstream API responses as the frontend contract.

------------------------------------------------------------------------

## 12. Storage, Cache, and Download Policy

-   Never download the complete Mars archive for the MVP.
-   Discover metadata globally or over the relevant search service, then
    retrieve only selected products for the chosen sector.
-   WMTS tiles should load on demand and use browser/server caching
    where appropriate.
-   Separate `raw`, `processed`, and `cache` directories.
-   Store product ID, source, URL, checksum when available, download
    time, file size, and validation status.
-   Use a configurable per-sector and total-cache budget.
-   Check available disk space before large downloads.
-   Keep a manifest for each sector.
-   Do not delete original raw data automatically unless an explicit
    retention policy allows it.
-   A reasonable initial planning target is to keep a sector's MVP
    working set small (for example, around 0.5--2 GB), but this is not a
    guaranteed size. Actual volume depends heavily on product selection,
    image resolution, and source format.

------------------------------------------------------------------------

## 13. Security, Configuration, and Reliability

-   Keep secrets and private tokens out of source control.
-   Use `.env.example` for documented configuration names and safe
    placeholders.
-   Validate URLs and only download from trusted, expected archive
    hosts.
-   Apply request timeouts and bounded retries.
-   Set download size limits and protect against unexpectedly large
    products.
-   Validate file type and content; do not trust file extensions alone.
-   Log errors without leaking secrets.
-   Use structured logs with job ID, sector ID, source, and product ID.
-   Avoid hard-coded absolute paths.
-   Make data directories configurable.
-   Do not claim a source integration works until a real request and a
    representative response have been tested.

------------------------------------------------------------------------

## 14. MVP Scope and Priorities

### P0 --- Minimum viable vertical slice

1.  Backend health endpoint.
2.  One sector definition and spatial bounds.
3.  One real data-source discovery flow.
4.  Automatic selection and download of one suitable DEM.
5.  Validation and metadata manifest.
6.  Slope generation from the DEM.
7.  One imagery layer if a suitable product is available.
8.  Basic sector state and progress tracking.
9.  Local map / terrain visualization.
10. At least two route alternatives with clear explanations.
11. Source citations and limitation notes.

### P1 --- Improve the demonstration

-   More source adapters.
-   Persistent sector state.
-   Layer toggles and coverage indicators.
-   Roughness and risk layers.
-   Three route strategies.
-   Scientific-interest indicator when supported data exists.
-   Elevation profile and mission report.

### P2 --- Stretch goals

-   Advanced 3D terrain effects.
-   Geological classification / ML.
-   Voice assistant.
-   Rover animation (clearly illustrative).
-   Advanced caching and concurrent downloads.
-   More sophisticated uncertainty propagation.

Do not start P1/P2 while the P0 vertical slice is not working
end-to-end.

------------------------------------------------------------------------

## 15. Team Responsibilities

Suggested five-person split: 1. **Data Engineer:** source adapters,
discovery, metadata normalization, downloader. 2. **GIS / Scientific
Processing:** CRS handling, DEM validation, raster processing, derived
layers. 3. **Algorithms Engineer:** risk/science indicators, grid graph,
A\*, route comparison. 4. **Frontend / Visualization:** React UI, Mars
overview, sector selection, 3D terrain, layer controls. 5. **Integration
/ QA / Storytelling:** API integration, testing, error flows,
documentation, demo narrative.

For a four-person team, combine integration/QA with frontend or backend
only if someone explicitly owns end-to-end testing and documentation.

------------------------------------------------------------------------

## 16. Development Workflow and Agent Rules

AI coding agents and contributors must follow these rules:

1.  Read this file before making architectural changes.
2.  Inspect the existing repository before creating or overwriting
    files.
3.  Do not invent API endpoints, product IDs, archive fields, or source
    capabilities.
4.  Verify external API behavior with official documentation and real
    sample responses.
5.  Implement one small, testable vertical slice at a time.
6.  Add tests for data parsing, coordinate handling, NoData behavior,
    product selection, state transitions, and route costs.
7.  Keep scientific calculations in isolated functions with documented
    units and assumptions.
8.  Use type hints and clear names in Python; use TypeScript types in
    the frontend.
9.  Avoid giant modules and hidden global state.
10. Do not put long-running downloads or raster processing inside
    request handlers.
11. Do not commit downloaded large datasets, secrets, virtual
    environments, build output, or cache files.
12. Update README and this file when a project-level decision changes.
13. Never mark a task complete based only on code generation; run the
    relevant tests or clearly state that they were not run.
14. If a source is unavailable, report it and preserve the adapter
    boundary; do not fabricate a successful result.
15. Keep demo fixtures clearly labelled as fixtures, not live NASA
    retrievals.

### Definition of Done

A feature is done only when: - Its behavior is implemented. - Inputs and
outputs are validated. - Errors and missing data are handled. - Relevant
tests pass, or unrun tests are explicitly disclosed. - Documentation is
updated where needed. - The UI does not overstate scientific certainty
or data availability.

------------------------------------------------------------------------

## 17. First Implementation Milestones

### Milestone 0 --- Local environment

-   Confirm OS, Python, Node.js, Git, and available disk space.
-   Create repository and folder structure.
-   Create Python virtual environment.
-   Install backend dependencies.
-   Create React + TypeScript frontend.
-   Confirm backend and frontend run locally.

### Milestone 1 --- First vertical slice

-   Define a fixed test sector.
-   Query one archive for actual products.
-   Normalize and display product metadata.
-   Download one small suitable product automatically.
-   Validate it and save a manifest.

### Milestone 2 --- First scientific layer

-   Read DEM.
-   Inspect CRS, units, resolution, and NoData.
-   Crop to sector.
-   Generate slope.
-   Export a visualization-ready layer.

### Milestone 3 --- First mission route

-   Build a grid from valid terrain cells.
-   Apply hard constraints.
-   Generate and compare routes.
-   Explain route costs and limitations.

### Milestone 4 --- Interactive experience

-   Connect the UI to real job status.
-   Show sector state transitions.
-   Render available layers.
-   Present route comparison and a mission report.

------------------------------------------------------------------------

## 18. Open Decisions --- Do Not Assume

These decisions require confirmation or evidence: - Main overview
presentation: 3D globe, 2D map, or globe-to-local-map transition. -
Sector visual grid: hexagonal, square, or geological regions. - Exact
Mars CRS and grid definition for the first test area. - Which
archive/source will be the first real integration. - Which DEM product
is suitable and accessible for the chosen region. - Minimum layer
requirements for `DISCOVERED`. - Initial download/cache budget based on
the actual machine and product sizes. - Whether the hackathon rules
permit using pre-existing code or only environment/API preparation
before the event.

Current recommendation: - Use a globe-to-local-surface experience if
feasible. - Use square cells internally; optionally render hexagons. -
Start with one real DEM workflow and one imagery workflow. - Keep the
first region small and choose it based on actual data coverage.

------------------------------------------------------------------------

## 19. Demo Narrative

A truthful demo story: 1. "Choose a sector of Mars." 2. "The system
searches orbital archives for data covering this sector." 3. "It selects
and retrieves suitable products automatically." 4. "It validates and
processes the available data." 5. "The sector becomes discovered inside
this application." 6. "Explore elevation and derived terrain layers." 7.
"Compare routes based on distance, risk, and supported
scientific-interest indicators." 8. "Review the evidence, missing data,
uncertainty, and source products."

Never say the application discovered a place that NASA had never
studied. Never describe a regional path as a rover-safe autonomous
route.

------------------------------------------------------------------------

## 20. Immediate Next Step

Start with **Milestone 0**. Before installing heavy geospatial packages,
inspect the developer machine and confirm: - Windows version - Python
version - Node.js and npm versions - Git version - Free disk space -
Whether WSL2 is installed and usable

Then choose a reproducible setup. Prefer a Python virtual environment
for the backend and Node/npm for the frontend. Install GDAL/Rasterio
using a compatible distribution and pinned versions; do not randomly mix
system GDAL, pip wheels, and conda packages.

**The first implementation goal is not a beautiful dashboard. It is one
sector that can automatically discover, download, validate, and process
one real Mars dataset.**
