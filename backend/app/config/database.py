"""
database.py — MongoDB Connection & Collection Management

Uses Motor (async MongoDB driver) to connect to the database.
All collections are initialized here and made available as globals.

Collections:
  - users        : Application user accounts
  - projects     : Project definitions and state
  - tasks        : Individual project tasks
  - meetings     : Processed meeting transcripts
  - documents    : Uploaded document metadata
  - summaries    : Generated AI summaries
"""

import logging
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from app.config.settings import get_settings

logger = logging.getLogger(__name__)

# Global database client and reference — initialized at startup
_client: AsyncIOMotorClient | None = None
_db: AsyncIOMotorDatabase | None = None


async def connect_to_mongo() -> None:
    """
    Establish the MongoDB connection.
    Called during FastAPI's lifespan startup event.
    """
    global _client, _db
    settings = get_settings()

    logger.info(f"Connecting to MongoDB at: {settings.MONGODB_URI}")
    
    kwargs = {
        "serverSelectionTimeoutMS": 5000,
        "connectTimeoutMS": 5000,
        "tlsAllowInvalidCertificates": True,
    }
    if "mongodb+srv" in settings.MONGODB_URI:
        try:
            import certifi
            kwargs["tlsCAFile"] = certifi.where()
        except ImportError:
            pass

    _client = AsyncIOMotorClient(settings.MONGODB_URI, **kwargs)
    _db = _client[settings.MONGODB_DB_NAME]

    try:
        import asyncio
        await asyncio.wait_for(_client.admin.command("ping"), timeout=2.0)
        logger.info(f"MongoDB connected — database: '{settings.MONGODB_DB_NAME}'")
        await _create_indexes()
    except Exception as e:
        logger.warning(f"MongoDB ping timed out or deferred ({e}). Backend will continue.")


async def close_mongo_connection() -> None:
    """
    Close the MongoDB connection.
    Called during FastAPI's lifespan shutdown event.
    """
    global _client
    if _client:
        _client.close()
        logger.info("MongoDB connection closed.")


async def _create_indexes() -> None:
    """
    Create database indexes for performance-critical queries.
    """
    db = get_database()

    # Users: unique email index
    await db.users.create_index("email", unique=True)

    # Projects: fast lookup by owner
    await db.projects.create_index("owner_id")

    # Tasks: fast lookup by project
    await db.tasks.create_index("project_id")

    # Meetings: fast lookup by project
    await db.meetings.create_index("project_id")

    # Documents: fast lookup by project
    await db.documents.create_index("project_id")

    # Summaries: fast lookup by project
    await db.summaries.create_index("project_id")

    logger.info("MongoDB indexes created.")


def get_database() -> AsyncIOMotorDatabase:
    """
    Return the active database reference.
    Raises RuntimeError if called before connect_to_mongo().
    """
    if _db is None:
        raise RuntimeError("Database not initialized. Call connect_to_mongo() first.")
    return _db
