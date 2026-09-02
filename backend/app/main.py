from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings

app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    description="Automated Oil Spill Detection, Backward Lagrangian Drift & AIS Attribution C2 API"
)

# CORS Policy Configuration (tech_stack.md §11)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def root():
    return {
        "status": "ONLINE",
        "service": settings.PROJECT_NAME,
        "compliance": ["MARPOL Annex I", "Indian Merchant Shipping Act 1958 §356"],
        "docs": "/docs"
    }

@app.get("/api/v1/health")
async def health_check():
    return {
        "status": "HEALTHY",
        "database": "PostgreSQL 16 + PostGIS 3.4",
        "task_queue": "Celery + Redis",
        "sar_source": "Copernicus Data Space Ecosystem (CDSE)"
    }


from app.api.v1.endpoints import router as api_router
app.include_router(api_router, prefix=settings.API_V1_STR)

from app.api.v1.sentinelhub_router import router as sh_router
app.include_router(sh_router, prefix=settings.API_V1_STR)
