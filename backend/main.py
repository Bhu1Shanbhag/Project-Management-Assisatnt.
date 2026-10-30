"""
main.py — FastAPI Application Entry Point

Configures the FastAPI application with:
  - CORS middleware
  - Lifespan events (database init / teardown)
  - API router mounting
  - Uvicorn server entry point
"""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import router
from app.config.database import connect_to_mongo, close_mongo_connection
from app.config.settings import get_settings
from app.agents.rag_agent import get_chroma_client

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
)
logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────────────────────────────────────
# Lifespan: startup and shutdown events
# ─────────────────────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Manage application lifecycle:
      Startup:  Connect to MongoDB, initialize ChromaDB
      Shutdown: Close MongoDB connection
    """
    settings = get_settings()
    logger.info(f"Starting {settings.APP_NAME} v{settings.APP_VERSION}")

    # Initialize MongoDB
    await connect_to_mongo()

    # Initialize ChromaDB (creates the persistent store directory if needed)
    get_chroma_client()
    logger.info("ChromaDB initialized.")

    yield  # Application runs here

    # Shutdown
    await close_mongo_connection()
    logger.info("Application shutdown complete.")


# ─────────────────────────────────────────────────────────────────────────────
# FastAPI app factory
# ─────────────────────────────────────────────────────────────────────────────

def create_app() -> FastAPI:
    settings = get_settings()

    app = FastAPI(
        title=settings.APP_NAME,
        version=settings.APP_VERSION,
        description=(
            "AI-powered Project Intelligence Platform. "
            "Reduces daily standups by automatically monitoring GitHub, "
            "processing meeting transcripts, and generating AI summaries."
        ),
        lifespan=lifespan,
        docs_url="/docs",
        redoc_url="/redoc",
    )

    # CORS — allow requests from the React dev server
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins_list,
        allow_origin_regex=r"http://(localhost|127\.0\.0\.1)(:\d+)?",
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Mount all API routes
    app.include_router(router)

    return app


app = create_app()


# ─────────────────────────────────────────────────────────────────────────────
# Entry point for direct execution: python main.py
# ─────────────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info",
    )
