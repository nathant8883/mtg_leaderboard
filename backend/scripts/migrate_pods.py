"""
Database migration script to add pod support to existing data.

This script:
1. Creates a "Default Pod" containing all existing players
2. Sets the superuser as the pod creator
3. Makes all existing players admins of the Default Pod
4. Updates all players with pod_ids and current_pod_id
5. Assigns all existing matches to the Default Pod
"""

import asyncio
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


async def migrate():
    """Run the pod migration"""
    print("🚀 Starting pod migration...")

    # Initialize database connection
    client = AsyncIOMotorClient(settings.mongodb_url)
    database = client[settings.database_name]

    # Initialize Beanie
    await init_beanie(
        database=database,
        document_models=[Player, Deck, Match, Pod, PodInvite]
    )

    print(f"✅ Connected to database: {settings.database_name}")

    # Check if Default Pod already exists
    existing_pod = await Pod.find_one(Pod.name == "Default Pod")
    if existing_pod:
        print("⚠️  Default Pod already exists. Migration may have been run before.")
        response = input("Do you want to continue anyway? (yes/no): ")
        if response.lower() != "yes":
            print("❌ Migration cancelled.")
            return
        default_pod = existing_pod
    else:
        # Get all existing players
        all_players = await Player.find_all().to_list()
        print(f"📊 Found {len(all_players)} existing players")

        if len(all_players) == 0:
            print("⚠️  No players found. Creating Default Pod anyway...")

        # Find superuser (creator of the pod)
        superuser = await Player.find_one(Player.is_superuser == True)
        if not superuser:
            print("⚠️  No superuser found. Using first player as creator (or creating placeholder)...")
            if len(all_players) > 0:
                superuser = all_players[0]
            else:
                # Create a placeholder superuser
                superuser = Player(
                    name="Admin",
                    is_superuser=True,
                    email="admin@mtgleaderboard.local"
                )
                await superuser.insert()
                print(f"✅ Created placeholder superuser: {superuser.name}")

        # Get all player IDs
        player_ids = [str(p.id) for p in all_players]

        # Create Default Pod
        default_pod = Pod(
            name="Default Pod",
            description="Default pod containing all existing players and matches",
            creator_id=str(superuser.id),
            admin_ids=player_ids,  # Make all existing players admins
            member_ids=player_ids
        )
        await default_pod.insert()
        print(f"✅ Created Default Pod with {len(player_ids)} members")

    default_pod_id = str(default_pod.id)

    # Update all players with pod_ids and current_pod_id
    all_players = await Player.find_all().to_list()
    updated_player_count = 0
    for player in all_players:
        # Only update if they don't already have pod membership
        if default_pod_id not in player.pod_ids:
            await player.set({
                Player.pod_ids: [default_pod_id],
                Player.current_pod_id: default_pod_id
            })
            updated_player_count += 1

    print(f"✅ Updated {updated_player_count} players with pod membership")

    # Assign all matches to Default Pod
    all_matches = await Match.find_all().to_list()
    updated_match_count = 0
    for match in all_matches:
        if match.pod_id is None:
            await match.set({Match.pod_id: default_pod_id})
            updated_match_count += 1

    print(f"✅ Assigned {updated_match_count} matches to Default Pod")

    # Summary
    print("\n" + "="*50)
    print("📊 MIGRATION SUMMARY")
    print("="*50)
    print(f"Pod Name: {default_pod.name}")
    print(f"Pod ID: {default_pod_id}")
    print(f"Creator: {(await Player.get(default_pod.creator_id)).name}")
    print(f"Members: {len(default_pod.member_ids)}")
    print(f"Admins: {len(default_pod.admin_ids)}")
    print(f"Players Updated: {updated_player_count}")
    print(f"Matches Assigned: {updated_match_count}")
    print("="*50)
    print("✅ Migration completed successfully!")


if __name__ == "__main__":
    asyncio.run(migrate())
