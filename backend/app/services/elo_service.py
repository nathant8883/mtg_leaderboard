"""
Elo service layer for managing player ratings.

Handles database operations for Elo ratings including:
- Creating/updating ratings after matches
- Recalculating all ratings for a pod
- Querying historical data for analytics
"""

from datetime import datetime
from typing import Dict, List, Optional
from beanie import PydanticObjectId

from app.models.analytics import PlayerEloRating, EloHistoryEntry
from app.models.match import Match
from app.services.elo_calculator import (
    calculate_multiplayer_elo_changes,
    DEFAULT_ELO,
)


async def get_or_create_player_elo(player_id: str, pod_id: str) -> PlayerEloRating:
    """
    Get existing Elo rating for a player in a pod, or create with defaults.
    """
    rating = await PlayerEloRating.find_one(
        PlayerEloRating.player_id == player_id,
        PlayerEloRating.pod_id == pod_id
    )
    if not rating:
        rating = PlayerEloRating(
            player_id=player_id,
            pod_id=pod_id,
            current_elo=DEFAULT_ELO,
            peak_elo=DEFAULT_ELO,
            lowest_elo=DEFAULT_ELO,
        )
        await rating.insert()
    return rating


async def process_match_elo(match: Match) -> Dict[str, float]:
    """
    Process a match and update all player Elo ratings.

    Args:
        match: The match document to process

    Returns:
        Dict mapping player_id to their Elo change
    """
    if not match.pod_id:
        return {}

    # Get current Elo for all players in the match
    player_elos = []
    for mp in match.players:
        rating = await get_or_create_player_elo(mp.player_id, match.pod_id)
        player_elos.append((mp.player_id, rating.current_elo))

    # Calculate Elo changes
    changes = calculate_multiplayer_elo_changes(player_elos, match.winner_player_id)

    # Apply changes to each player
    for player_id, change in changes.items():
        rating = await PlayerEloRating.find_one(
            PlayerEloRating.player_id == player_id,
            PlayerEloRating.pod_id == match.pod_id
        )
        if rating:
            old_elo = rating.current_elo
            rating.current_elo += change
            rating.last_elo_change = change
            rating.games_rated += 1
            rating.peak_elo = max(rating.peak_elo, rating.current_elo)
            rating.lowest_elo = min(rating.lowest_elo, rating.current_elo)
            rating.last_updated = datetime.utcnow()
            await rating.save()

            # Record history entry
            history = EloHistoryEntry(
                player_id=player_id,
                pod_id=match.pod_id,
                match_id=str(match.id),
                elo_before=old_elo,
                elo_after=rating.current_elo,
                elo_change=change,
                timestamp=datetime.utcnow(),
            )
            await history.insert()

    return changes


async def recalculate_pod_elo(pod_id: str) -> int:
    """
    Recalculate all Elo ratings for a pod from scratch.

    This processes all matches in chronological order and rebuilds
    the entire rating history. Use this after match edits/deletes.

    Args:
        pod_id: The pod ID to recalculate

    Returns:
        Number of matches processed
    """
    # Delete all existing ratings and history for this pod
    await PlayerEloRating.find(PlayerEloRating.pod_id == pod_id).delete()
    await EloHistoryEntry.find(EloHistoryEntry.pod_id == pod_id).delete()

    # Get all matches for pod, sorted chronologically
    matches = await Match.find(
        Match.pod_id == pod_id
    ).sort(Match.created_at).to_list()

    # Process each match in order
    for match in matches:
        await process_match_elo(match)

    return len(matches)


async def get_player_elo_gain(
    player_id: str,
    pod_id: str,
    last_n_matches: int = 30
) -> float:
    """
    Calculate a player's Elo gain over the last N pod matches.

    This is used for Rising Star detection.

    Args:
        player_id: The player to check
        pod_id: The pod context
        last_n_matches: Number of recent pod matches to consider

    Returns:
        Elo change over the window (positive = gaining, negative = losing)
    """
    # Get the last N matches for this pod
    recent_pod_matches = await Match.find(
        Match.pod_id == pod_id
    ).sort(-Match.created_at).limit(last_n_matches).to_list()

    if not recent_pod_matches:
        return 0.0

    # Get match IDs
    match_ids = [str(m.id) for m in recent_pod_matches]

    # Get this player's history entries for these matches
    history_entries = await EloHistoryEntry.find(
        EloHistoryEntry.player_id == player_id,
        EloHistoryEntry.pod_id == pod_id,
        {"match_id": {"$in": match_ids}}
    ).to_list()

    # Sum up Elo changes
    total_change = sum(entry.elo_change for entry in history_entries)
    return total_change


async def get_rising_star(pod_id: str, min_games: int = 5) -> Optional[Dict]:
    """
    Find the player with the highest Elo gain over the last 30 pod matches.

    Args:
        pod_id: The pod to analyze
        min_games: Minimum games in the window to qualify

    Returns:
        Dict with player info and Elo gain, or None if no rising star
    """
    # Get all players with ratings in this pod
    ratings = await PlayerEloRating.find(
        PlayerEloRating.pod_id == pod_id,
        PlayerEloRating.games_rated >= min_games
    ).to_list()

    if not ratings:
        return None

    best_gain = 0.0
    rising_star_rating = None

    for rating in ratings:
        gain = await get_player_elo_gain(rating.player_id, pod_id, 30)
        if gain > best_gain:
            best_gain = gain
            rising_star_rating = rating

    if not rising_star_rating or best_gain <= 0:
        return None

    return {
        "player_id": rising_star_rating.player_id,
        "elo_gain": round(best_gain),
        "current_elo": round(rising_star_rating.current_elo),
        "games_rated": rising_star_rating.games_rated,
    }


async def delete_match_elo(match_id: str, pod_id: str) -> None:
    """
    Remove Elo history for a deleted match and trigger recalculation.

    Args:
        match_id: The match that was deleted
        pod_id: The pod the match belonged to
    """
    # Delete history entries for this match
    await EloHistoryEntry.find(EloHistoryEntry.match_id == match_id).delete()

    # Recalculate all ratings for the pod
    await recalculate_pod_elo(pod_id)
