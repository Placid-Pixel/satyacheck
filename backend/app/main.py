from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pathlib import Path
import os

from app.core.config import settings
from app.api.auth import router as auth_router
from app.api.applications import router as applications_router
from app.api.findings import router as findings_router
from app.api.rules import router as rules_router
from app.api.audit import router as audit_router
from app.api.verification import router as verification_router
from app.api.infrastructure import router as infrastructure_router
from app.api.graph import router as graph_router
from app.api.evaluation import router as evaluation_router
from app.api.agent import router as agent_router

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="SatyaCheck — AICTE Trust Layer for Regulatory Compliance & Application Validation"
)

# CORS Configuration for Local & Deployed Cloud Environments
cors_origins_env = os.getenv("CORS_ORIGINS", "")
if cors_origins_env and cors_origins_env.strip() != "*":
    origins = [orig.strip() for orig in cors_origins_env.split(",") if orig.strip()]
    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
else:
    # Allow all local and deployed origins dynamically while supporting credentials
    app.add_middleware(
        CORSMiddleware,
        allow_origin_regex=os.getenv("CORS_ORIGIN_REGEX", r"^https?://.*$"),
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

# Include Routers
app.include_router(auth_router, prefix=settings.API_V1_STR)
app.include_router(applications_router, prefix=settings.API_V1_STR)
app.include_router(findings_router, prefix=settings.API_V1_STR)
app.include_router(rules_router, prefix=settings.API_V1_STR)
app.include_router(audit_router, prefix=settings.API_V1_STR)
app.include_router(verification_router, prefix=settings.API_V1_STR)
app.include_router(infrastructure_router, prefix=settings.API_V1_STR)
app.include_router(graph_router, prefix=settings.API_V1_STR)
app.include_router(evaluation_router, prefix=settings.API_V1_STR)
app.include_router(agent_router, prefix=settings.API_V1_STR)

# Static file mount for uploaded and generated documents
storage_path = Path(settings.DATA_DIR)
storage_path.mkdir(parents=True, exist_ok=True)
app.mount("/static", StaticFiles(directory=str(storage_path)), name="static")

@app.get("/health")
@app.get("/api/health")
def health_check():
    return {
        "status": "healthy",
        "service": "SatyaCheck AICTE Trust Layer",
        "version": settings.VERSION,
        "mode": "Decision-Support (No Auto-Rejection)"
    }

# Optional Frontend Static Files (Single-container or production unified deployment)
frontend_dist_env = os.getenv("FRONTEND_DIST")
frontend_dist = Path(frontend_dist_env) if frontend_dist_env else (Path(__file__).resolve().parent.parent.parent / "frontend" / "dist")

if frontend_dist.exists() and (frontend_dist / "index.html").exists():
    assets_dir = frontend_dist / "assets"
    if assets_dir.exists():
        app.mount("/assets", StaticFiles(directory=str(assets_dir)), name="frontend-assets")

    @app.get("/{full_path:path}")
    async def serve_frontend(full_path: str):
        if full_path.startswith("api") or full_path.startswith("static") or full_path == "health" or full_path.startswith("docs") or full_path.startswith("openapi.json"):
            raise HTTPException(status_code=404, detail="Not Found")
        target = frontend_dist / full_path
        if target.is_file():
            return FileResponse(str(target))
        return FileResponse(str(frontend_dist / "index.html"))

