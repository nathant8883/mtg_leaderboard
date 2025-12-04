#!/usr/bin/env python3
"""
Backfill Elo ratings from existing match history.

This script processes all existing matches chronologically to
calculate and store Elo ratings for all players in each pod.

Usage:
    cd backend
    uv run python -m scripts.backfill_elo
"""

import asyncio
import sys
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from motor.motor_asyncio import AsyncIOMotorClient
from beanie import init_beanie

from app.config import settings
from app.models.player import Player, Deck
from app.models.match import Match
from app.models.pod import Pod, PodInvite
from app.models.analytics import PlayerEloRating, EloHistoryEntry
from app.services.elo_service import recalculate_pod_elo


async def init_db():
    """Initialize database connection"""
    client = AsyncIOMotorClient(settings.mongodb_url)
    database = client[settings.database_name]

    await init_beanie(
        database=database,
        document_models=[Player, Deck, Match, Pod, PodInvite, PlayerEloRating, EloHistoryEntry]
    )
    print(f"Connected to MongoDB: {settings.database_name}")


async def backfill_all_pods():
    """Backfill Elo ratings for all pods"""
    await init_db()

    # Get all pods
    pods = await Pod.find_all().to_list()
    print(f"Found {len(pods)} pods to process")

    if not pods:
        print("No pods found. Nothing to backfill.")
        return

    total_matches = 0
    for pod in pods:
        pod_id = str(pod.id)
        print(f"\nProcessing pod: {pod.name} ({pod_id})")

        # Count matches for this pod before processing
        match_count = await Match.find(Match.pod_id == pod_id).count()
        print(f"  Found {match_count} matches")

        if match_count > 0:
            matches_processed = await recalculate_pod_elo(pod_id)
            total_matches += matches_processed
            print(f"  Processed {matches_processed} matches")

            # Show resulting Elo ratings
            ratings = await PlayerEloRating.find(
                PlayerEloRating.pod_id == pod_id
            ).sort(-PlayerEloRating.current_elo).to_list()

            print(f"  Elo ratings:")
            for rating in ratings:
                player = await Player.get(rating.player_id)
                player_name = player.name if player else "Unknown"
                print(f"    {player_name}: {round(rating.current_elo)} (peak: {round(rating.peak_elo)}, games: {rating.games_rated})")
        else:
            print("  No matches to process")

    print(f"\n{'='*50}")
    print(f"Backfill complete! Processed {total_matches} total matches across {len(pods)} pods")


async def backfill_single_pod(pod_id: str):
    """Backfill Elo ratings for a specific pod"""
    await init_db()

    pod = await Pod.get(pod_id)
    if not pod:
        print(f"Pod {pod_id} not found")
        return

    print(f"Processing pod: {pod.name} ({pod_id})")

    match_count = await Match.find(Match.pod_id == pod_id).count()
    print(f"Found {match_count} matches")

    if match_count > 0:
        matches_processed = await recalculate_pod_elo(pod_id)
        print(f"Processed {matches_processed} matches")

        # Show resulting Elo ratings
        ratings = await PlayerEloRating.find(
            PlayerEloRating.pod_id == pod_id
        ).sort(-PlayerEloRating.current_elo).to_list()

        print(f"\nElo ratings:")
        for rating in ratings:
            player = await Player.get(rating.player_id)
            player_name = player.name if player else "Unknown"
            print(f"  {player_name}: {round(rating.current_elo)} (peak: {round(rating.peak_elo)}, games: {rating.games_rated})")
    else:
        print("No matches to process")


if __name__ == "__main__":
    if len(sys.argv) > 1:
        # Backfill specific pod
        pod_id = sys.argv[1]
        asyncio.run(backfill_single_pod(pod_id))
    else:
        # Backfill all pods
        asyncio.run(backfill_all_pods())
