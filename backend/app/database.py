from motor.motor_asyncio import AsyncIOMotorClient
from beanie import init_beanie

from app.config import settings
from app.models.player import Player, Deck
from app.models.match import Match


async def init_db():
    """Initialize database connection and Beanie ODM"""
    client = AsyncIOMotorClient(settings.mongodb_url)
    database = client[settings.database_name]

    # Initialize Beanie with all document models
    await init_beanie(
        database=database,
        document_models=[Player, Deck, Match]
    )

    print(f"Connected to MongoDB: {settings.database_name}")


async def close_db():
    """Close database connection"""
    # Motor doesn't require explicit closing, but we can add cleanup logic here if needed
    pass
