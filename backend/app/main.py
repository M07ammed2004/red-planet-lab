from pathlib import Path
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from backend.app.api.health import router as health_router
from backend.app.api.jobs import router as jobs_router
from backend.app.api.routes import router as routes_router
from backend.app.api.sectors import router as sectors_router
from backend.app.api.storage import router as storage_router
from backend.app.api.weather import router as weather_router
from backend.app.core.config import settings

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="Multi-Mission Data Fusion & Intelligent Exploration Planning System API",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
)

# Enable CORS for frontend development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Static Rover Images directory
static_rover_dir = Path(__file__).resolve().parent.parent.parent / "frontend" / "public" / "images"
if static_rover_dir.exists():
    app.mount("/images", StaticFiles(directory=str(static_rover_dir)), name="images")

# Static Textures directory
static_textures_dir = Path(__file__).resolve().parent.parent.parent / "frontend" / "public" / "textures"
if static_textures_dir.exists():
    app.mount("/textures", StaticFiles(directory=str(static_textures_dir)), name="textures")

# Register routers
app.include_router(health_router, prefix="/api")
app.include_router(sectors_router, prefix="/api")
app.include_router(routes_router, prefix="/api")
app.include_router(weather_router, prefix="/api")
app.include_router(jobs_router, prefix="/api")
app.include_router(storage_router, prefix="/api")


@app.get("/")
async def root():
    return {
        "name": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "docs": "/api/docs",
        "health": "/api/health",
        "sectors": "/api/sectors",
        "routes": "/api/routes/plan",
        "jobs": "/api/jobs",
        "storage": "/api/storage/status",
    }
