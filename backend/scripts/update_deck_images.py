"""
Script to update all deck commander images to higher resolution.

This script:
1. Fetches all decks from the database
2. For each deck, looks up the commander on Scryfall
3. Updates the commander_image_url to use image_normal (488x680) instead of art_crop
"""

import asyncio
import httpx
from motor.motor_asyncio import AsyncIOMotorClient
from beanie import init_beanie
import sys
import os

# Add parent directory to path so we can import app modules
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app.config import settings
from app.models.player import Player, Deck
from app.models.match import Match
from app.models.pod import Pod, PodInvite

SCRYFALL_API_BASE = "https://api.scryfall.com"


async def get_commander_image(client: httpx.AsyncClient, commander_name: str) -> str | None:
    """Fetch high-resolution commander image from Scryfall."""
    try:
        response = await client.get(
            f"{SCRYFALL_API_BASE}/cards/named",
            params={"exact": commander_name},
            timeout=10.0
        )

        if response.status_code != 200:
            return None

        card = response.json()

        # Handle double-faced cards
        if "card_faces" in card and len(card["card_faces"]) > 0:
            image_uris = card["card_faces"][0].get("image_uris", {})
        else:
            image_uris = card.get("image_uris", {})

        # Use art_crop for cropped artwork display
        return image_uris.get("art_crop") or image_uris.get("normal")

    except Exception as e:
        print(f"  Error fetching {commander_name}: {e}")
        return None


async def update_deck_images():
    """Update all deck commander images to high resolution."""
    print("Starting deck image update...")

    # Initialize database connection
    client = AsyncIOMotorClient(settings.mongodb_url)
    database = client[settings.database_name]

    # Initialize Beanie
    await init_beanie(
        database=database,
        document_models=[Player, Deck, Match, Pod, PodInvite]
    )

    print(f"Connected to database: {settings.database_name}")

    # Get all decks
    all_decks = await Deck.find_all().to_list()
    print(f"Found {len(all_decks)} decks to process")

    updated_count = 0
    skipped_count = 0
    error_count = 0

    async with httpx.AsyncClient() as http_client:
        for i, deck in enumerate(all_decks, 1):
            print(f"[{i}/{len(all_decks)}] Processing: {deck.name} ({deck.commander})")

            # Check if already using art_crop image
            if deck.commander_image_url and "art_crop" in deck.commander_image_url:
                print(f"  Already using art_crop image, skipping")
                skipped_count += 1
                continue

            # Fetch new image URL from Scryfall
            new_image_url = await get_commander_image(http_client, deck.commander)

            if not new_image_url:
                print(f"  Could not fetch image, skipping")
                error_count += 1
                continue

            # Check if image actually changed
            if new_image_url == deck.commander_image_url:
                print(f"  Image URL unchanged, skipping")
                skipped_count += 1
                continue

            # Update the deck
            old_url = deck.commander_image_url or "None"
            await deck.set({Deck.commander_image_url: new_image_url})
            print(f"  Updated: {old_url[:50]}... -> {new_image_url[:50]}...")
            updated_count += 1

            # Small delay to be nice to Scryfall API
            await asyncio.sleep(0.1)

    # Summary
    print("\n" + "=" * 50)
    print("UPDATE SUMMARY")
    print("=" * 50)
    print(f"Total decks:    {len(all_decks)}")
    print(f"Updated:        {updated_count}")
    print(f"Skipped:        {skipped_count}")
    print(f"Errors:         {error_count}")
    print("=" * 50)
    print("Done!")


if __name__ == "__main__":
    asyncio.run(update_deck_images())
