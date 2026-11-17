"""
EHR Clinical AI Agent Microservice Entry Point.
FastAPI Application with automated OpenAPI documentation and CORS support.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from api.routes import router
from core.config import settings
from core.logger import get_logger

logger = get_logger("main")

app = FastAPI(
    title=settings.app_name,
    version=settings.version,
    description="Autonomous Clinical Intelligence, Trend Analysis, and Medical RAG Microservice for Decentralized EHR.",
    docs_url="/docs",
    redoc_url="/redoc"
)

# Enable CORS for external services (Node.js Gateway, React Frontends)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount API routers
app.include_router(router)

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
