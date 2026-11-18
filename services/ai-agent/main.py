"""
EHR Clinical AI Agent Microservice Entry Point.
FastAPI Application with automated OpenAPI documentation and CORS support.
"""

import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from api.routes import router
from core.config import settings
from core.logger import get_logger
from core import telemetry

logger = get_logger("main")

root_path = os.getenv("FASTAPI_ROOT_PATH", "/ai-agent")

app = FastAPI(
    title=settings.app_name,
    version=settings.version,
    description="Autonomous Clinical Intelligence, Trend Analysis, and Medical RAG Microservice for Decentralized EHR.",
    docs_url="/docs",
    redoc_url="/redoc",
    root_path=root_path
)

# Enable CORS for external services (Node.js Gateway, React Frontends)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Compatibility endpoint for direct port-8000 access when root_path is set
@app.get("/ai-agent/openapi.json", include_in_schema=False)
def ai_agent_openapi():
    return JSONResponse(app.openapi())

# Mount API routers
app.include_router(router)

@app.on_event("startup")
def start_dashboard_heartbeat() -> None:
    """Report agent liveness to the observability dashboard when it is configured."""
    telemetry.start_heartbeat()

@app.get("/health", tags=["Health"])
def health_check():
    """Health check endpoint for container orchestration and uptime monitoring."""
    return {
        "status": "healthy",
        "service": settings.app_name,
        "version": settings.version,
        "offline_mode": settings.offline_mode
    }

if __name__ == "__main__":
    import uvicorn
    logger.info(f"Starting {settings.app_name} on {settings.api_host}:{settings.api_port}")
    uvicorn.run("main:app", host=settings.api_host, port=settings.api_port, reload=False)
