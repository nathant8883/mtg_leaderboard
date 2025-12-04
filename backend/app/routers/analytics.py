"""
Analytics router for advanced statistics.

Provides endpoints for:
- Elo leaderboards
- Pod balance/parity metrics
- Rising star detection
- Kingmaker relationships
"""

from fastapi import APIRouter, Depends
from typing import Dict, Any, Optional, List
from collections import Counter

from app.models.player import Player
from app.models.match import Match
from app.models.analytics import PlayerEloRating
from app.middleware.auth import get_optional_player
from app.services.elo_service import get_rising_star
from beanie import PydanticObjectId

router = APIRouter()


@router.get("/elo/leaderboard")
async def get_elo_leaderboard(
    current_player: Optional[Player] = Depends(get_optional_player)
) -> List[Dict[str, Any]]:
    """
    Get Elo leaderboard for current pod.

    Returns players ranked by Elo rating with their peak and recent changes.
    """
    if not current_player or not current_player.current_pod_id:
        return []

    ratings = await PlayerEloRating.find(
        PlayerEloRating.pod_id == current_player.current_pod_id
    ).sort(-PlayerEloRating.current_elo).to_list()

    result = []
    for rank, rating in enumerate(ratings, 1):
        player = await Player.get(PydanticObjectId(rating.player_id))
        if player:
            result.append({
                "rank": rank,
                "player_id": rating.player_id,
                "player_name": player.name,
                "picture": player.picture,
                "custom_avatar": player.custom_avatar,
                "elo": round(rating.current_elo),
                "peak_elo": round(rating.peak_elo),
                "games_rated": rating.games_rated,
                "last_change": round(rating.last_elo_change, 1),
            })

    return result


@router.get("/pod-balance")
async def get_pod_balance(
    current_player: Optional[Player] = Depends(get_optional_player)
) -> Dict[str, Any]:
    """
    Calculate pod balance score using Gini coefficient.

    Analyzes the last 30 matches to determine how evenly wins are distributed.
    Returns a score from 0-100 where 100 is perfectly balanced.
    """
    if not current_player or not current_player.current_pod_id:
        return {
            "score": 0,
            "status": "No pod",
            "details": {}
        }

    # Get last 30 matches for the pod
    matches = await Match.find(
        Match.pod_id == current_player.current_pod_id
    ).sort(-Match.created_at).limit(30).to_list()

    if len(matches) < 5:
        return {
            "score": 0,
            "status": "Insufficient data",
            "details": {
                "games_analyzed": len(matches),
                "min_required": 5
            }
        }

    # Count wins per player
    win_counts = Counter(match.winner_player_id for match in matches)
    total_wins = sum(win_counts.values())

    if total_wins == 0:
        return {
            "score": 100,
            "status": "Healthy",
            "details": {}
        }

    # Calculate Gini coefficient
    wins = sorted(win_counts.values())
    n = len(wins)

    if n <= 1:
        gini = 0
    else:
        cumulative = sum((i + 1) * w for i, w in enumerate(wins))
        gini = (2 * cumulative) / (n * sum(wins)) - (n + 1) / n

    # Convert to 0-100 score (inverse of Gini)
    balance_score = round((1 - gini) * 100)

    # Determine status
    if balance_score >= 70:
        status = "Healthy"
    elif balance_score >= 50:
        status = "Uneven"
    else:
        status = "Dominated"

    # Find the dominant player if unbalanced
    dominant_player = None
    if status in ["Uneven", "Dominated"] and win_counts:
        top_winner_id = win_counts.most_common(1)[0][0]
        top_winner = await Player.get(PydanticObjectId(top_winner_id))
        if top_winner:
            dominant_player = {
                "player_id": top_winner_id,
                "player_name": top_winner.name,
                "wins": win_counts[top_winner_id],
                "win_rate": round(win_counts[top_winner_id] / total_wins * 100, 1)
            }

    return {
        "score": balance_score,
        "status": status,
        "details": {
            "gini_coefficient": round(gini, 3),
            "games_analyzed": len(matches),
            "unique_winners": len(win_counts),
            "dominant_player": dominant_player
        }
    }


@router.get("/rising-star")
async def get_rising_star_endpoint(
    current_player: Optional[Player] = Depends(get_optional_player)
) -> Dict[str, Any]:
    """
    Find the player with the highest Elo gain over the last 30 pod matches.

    Only players with 5+ games qualify.
    """
    if not current_player or not current_player.current_pod_id:
        return {
            "player": None,
            "elo_gain": 0,
            "reason": "No pod context"
        }

    rising_star = await get_rising_star(current_player.current_pod_id)

    if not rising_star:
        return {
            "player": None,
            "elo_gain": 0,
            "reason": "No positive gains in window"
        }

    # Enrich with player details
    player = await Player.get(PydanticObjectId(rising_star["player_id"]))

    return {
        "player": {
            "player_id": rising_star["player_id"],
            "player_name": player.name if player else "Unknown",
            "picture": player.picture if player else None,
            "custom_avatar": player.custom_avatar if player else None,
        },
        "elo_gain": rising_star["elo_gain"],
        "current_elo": rising_star["current_elo"],
        "games_in_window": rising_star["games_rated"]
    }


@router.get("/players/{player_id}/kingmaker")
async def get_player_kingmaker(
    player_id: str,
    current_player: Optional[Player] = Depends(get_optional_player)
) -> Dict[str, Any]:
    """
    Calculate kingmaker relationships for a specific player.

    Shows which players win more often when this player is in the game.
    A player is considered a "kingmaker for" another if that player's win rate
    is significantly higher when playing together.
    """
    if not current_player or not current_player.current_pod_id:
        return {
            "kingmaker_for": [],
            "analyzed_games": 0
        }

    # Get all matches for pod
    matches = await Match.find(
        Match.pod_id == current_player.current_pod_id
    ).to_list()

    if len(matches) < 10:
        return {
            "kingmaker_for": [],
            "analyzed_games": len(matches),
            "reason": "Insufficient match history"
        }

    # Track win rates for each other player with/without target player
    # Structure: {other_player_id: {"with": [wins, games], "without": [wins, games]}}
    player_pairs: Dict[str, Dict[str, List[int]]] = {}

    for match in matches:
        player_ids_in_match = [p.player_id for p in match.players]
        target_in_match = player_id in player_ids_in_match

        for mp in match.players:
            other_id = mp.player_id
            if other_id == player_id:
                continue

            if other_id not in player_pairs:
                player_pairs[other_id] = {
                    "with": [0, 0],
                    "without": [0, 0]
                }

            if target_in_match:
                player_pairs[other_id]["with"][1] += 1
                if match.winner_player_id == other_id:
                    player_pairs[other_id]["with"][0] += 1
            else:
                player_pairs[other_id]["without"][1] += 1
                if match.winner_player_id == other_id:
                    player_pairs[other_id]["without"][0] += 1

    # Calculate kingmaker effects
    MIN_GAMES_TOGETHER = 10
    MIN_GAMES_APART = 5
    LIFT_THRESHOLD = 0.30  # 30% lift to be considered meaningful

    kingmaker_for = []

    for other_id, stats in player_pairs.items():
        with_wins, with_games = stats["with"]
        without_wins, without_games = stats["without"]

        # Need enough games in both scenarios
        if with_games < MIN_GAMES_TOGETHER or without_games < MIN_GAMES_APART:
            continue

        with_rate = with_wins / with_games
        without_rate = without_wins / without_games

        # Calculate lift (how much better they do with target present)
        if without_rate > 0:
            lift = (with_rate - without_rate) / without_rate
        elif with_rate > 0:
            lift = 1.0  # Infinite lift if they never win without
        else:
            lift = 0

        if lift >= LIFT_THRESHOLD:
            other_player = await Player.get(PydanticObjectId(other_id))
            kingmaker_for.append({
                "player_id": other_id,
                "player_name": other_player.name if other_player else "Unknown",
                "picture": other_player.picture if other_player else None,
                "custom_avatar": other_player.custom_avatar if other_player else None,
                "win_rate_with": round(with_rate * 100, 1),
                "win_rate_without": round(without_rate * 100, 1),
                "lift_percentage": round(lift * 100, 1),
                "games_together": with_games
            })

    # Sort by lift percentage descending
    kingmaker_for.sort(key=lambda x: x["lift_percentage"], reverse=True)

    return {
        "kingmaker_for": kingmaker_for[:5],  # Top 5
        "analyzed_games": len(matches)
    }


@router.get("/elo/leader")
async def get_elo_leader(
    current_player: Optional[Player] = Depends(get_optional_player)
) -> Optional[Dict[str, Any]]:
    """
    Get the current Elo leader for the pod.

    Used for the dashboard stat card.
    """
    if not current_player or not current_player.current_pod_id:
        return None

    # Get top rated player
    top_rating = await PlayerEloRating.find(
        PlayerEloRating.pod_id == current_player.current_pod_id
    ).sort(-PlayerEloRating.current_elo).first_or_none()

    if not top_rating:
        return None

    player = await Player.get(PydanticObjectId(top_rating.player_id))
    if not player:
        return None

    return {
        "player_id": top_rating.player_id,
        "player_name": player.name,
        "picture": player.picture,
        "custom_avatar": player.custom_avatar,
        "elo": round(top_rating.current_elo),
        "games_rated": top_rating.games_rated
    }
