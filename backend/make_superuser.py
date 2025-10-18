#!/usr/bin/env python3
"""
Utility script to upgrade a user to superuser status by email.

Usage:
    python make_superuser.py user@example.com

Or with uv:
    uv run make_superuser.py user@example.com
"""

import asyncio
import sys
from motor.motor_asyncio import AsyncIOMotorClient
from beanie import init_beanie

from app.config import settings
from app.models.player import Player, Deck
from app.models.match import Match


async def make_superuser(email: str):
    """Upgrade a user to superuser status by email"""

    # Initialize database connection
    client = AsyncIOMotorClient(settings.mongodb_url)
    database = client[settings.database_name]

    # Initialize Beanie with all document models
    await init_beanie(
        database=database,
        document_models=[Player, Deck, Match]
    )

    print(f"Connected to MongoDB: {settings.database_name}")
    print(f"Looking for user with email: {email}")

    # Find player by email
    player = await Player.find_one(Player.email == email)

    if not player:
        print(f"❌ Error: No player found with email '{email}'")
        print("\nTip: Make sure the user has logged in at least once via Google OAuth.")
        sys.exit(1)

    # Check if already superuser
    if player.is_superuser:
        print(f"ℹ️  User '{player.name}' ({email}) is already a superuser")
        sys.exit(0)

    # Update to superuser
    await player.set({Player.is_superuser: True})

    print(f"✅ Successfully upgraded '{player.name}' ({email}) to superuser!")
    print(f"   Player ID: {player.id}")
    print(f"   Player Name: {player.name}")
    print(f"   Is Superuser: {player.is_superuser}")


async def main():
    """Main entry point"""

    if len(sys.argv) != 2:
        print("Usage: python make_superuser.py <email>")
        print("Example: python make_superuser.py user@example.com")
        sys.exit(1)

    email = sys.argv[1]

    # Basic email validation
    if "@" not in email:
        print(f"❌ Error: '{email}' doesn't look like a valid email address")
        sys.exit(1)

    await make_superuser(email)


if __name__ == "__main__":
    asyncio.run(main())
