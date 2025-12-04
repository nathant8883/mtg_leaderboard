from fastapi import APIRouter, Depends
from beanie import PydanticObjectId
from typing import Dict, Any, Optional
from collections import Counter
import logging

from app.models.match import Match
from app.models.player import Player, Deck
from app.models.pod import Pod
from app.models.analytics import PlayerEloRating
from app.middleware.auth import get_optional_player
from app.utils.color_identity import get_color_identity_name
from app.services.elo_service import get_rising_star

router = APIRouter()
logger = logging.getLogger(__name__)

# Minimum games required for a player/deck to be ranked on the leaderboard
MIN_GAMES_FOR_RANKING = 4


@router.get("/players")
async def get_player_leaderboard(
    current_player: Optional[Player] = Depends(get_optional_player)
) -> list[Dict[str, Any]]:
    """Get leaderboard by player from current pod (or all non-guests if no pod context)"""
    # Get players and matches, filtered by pod if available
    if not current_player or not current_player.current_pod_id:
        # No pod context - return all non-guest players (backward compatibility)
        players = await Player.find(
            {"$or": [{"is_guest": False}, {"is_guest": {"$exists": False}}]}
        ).to_list()
        matches = await Match.find_all().to_list()
    else:
        # Pod context - filter to current pod
        try:
            pod = await Pod.get(PydanticObjectId(current_player.current_pod_id))
            if pod:
                # Get players in the current pod (excluding guests)
                players = await Player.find(
                    {
                        "$and": [
                            {"_id": {"$in": [PydanticObjectId(mid) for mid in pod.member_ids]}},
                            {"$or": [{"is_guest": False}, {"is_guest": {"$exists": False}}]}
                        ]
                    }
                ).to_list()
                # Get matches from the current pod
                matches = await Match.find(Match.pod_id == current_player.current_pod_id).to_list()
            else:
                # Fallback if pod not found
                players = await Player.find(
                    {"$or": [{"is_guest": False}, {"is_guest": {"$exists": False}}]}
                ).to_list()
                matches = await Match.find_all().to_list()
        except Exception:
            # Fallback on error
            players = await Player.find(
                {"$or": [{"is_guest": False}, {"is_guest": {"$exists": False}}]}
            ).to_list()
            matches = await Match.find_all().to_list()

    # Build Elo lookup if we have pod context
    elo_lookup: Dict[str, PlayerEloRating] = {}
    if current_player and current_player.current_pod_id:
        elo_ratings = await PlayerEloRating.find(
            PlayerEloRating.pod_id == current_player.current_pod_id
        ).to_list()
        elo_lookup = {r.player_id: r for r in elo_ratings}

    leaderboard = []

    for player in players:
        player_id = str(player.id)

        # Count games where this player participated
        games_played = sum(1 for match in matches if any(p.player_id == player_id for p in match.players))

        # Count wins
        wins = sum(1 for match in matches if match.winner_player_id == player_id)

        # Calculate win rate
        win_rate = (wins / games_played * 100) if games_played > 0 else 0

        # Count unique decks used
        deck_count = len(player.deck_ids)

        losses = games_played - wins

        # Get Elo data if available
        player_elo = elo_lookup.get(player_id)

        # Include all players with at least one game
        if games_played > 0:
            leaderboard.append({
                "player_id": player_id,
                "player_name": player.name,
                "avatar": player.avatar,
                "picture": player.picture,
                "custom_avatar": player.custom_avatar,
                "games_played": games_played,
                "wins": wins,
                "losses": losses,
                "win_rate": round(win_rate, 1),
                "deck_count": deck_count,
                "ranked": games_played >= MIN_GAMES_FOR_RANKING,
                "elo": round(player_elo.current_elo) if player_elo else None,
                "elo_change": round(player_elo.last_elo_change, 1) if player_elo else None,
            })

    # Sort by ranked first (True before False), then by Elo (if available), then by win rate
    leaderboard.sort(key=lambda x: (
        x["ranked"],
        x["elo"] if x["elo"] is not None else 0,
        x["win_rate"],
        x["wins"]
    ), reverse=True)

    return leaderboard


@router.get("/decks")
async def get_deck_leaderboard(
    current_player: Optional[Player] = Depends(get_optional_player)
) -> list[Dict[str, Any]]:
    """Get leaderboard by deck from current pod (or all enabled decks if no pod context)"""
    # Get decks, matches, and players filtered by pod if available
    if not current_player or not current_player.current_pod_id:
        # No pod context - return all enabled decks (backward compatibility)
        decks = await Deck.find(Deck.disabled != True).to_list()
        matches = await Match.find_all().to_list()
        players = await Player.find(
            {"$or": [{"is_guest": False}, {"is_guest": {"$exists": False}}]}
        ).to_list()
    else:
        # Pod context - filter to current pod
        try:
            pod = await Pod.get(PydanticObjectId(current_player.current_pod_id))
            if pod:
                # Get players in the pod
                players = await Player.find(
                    {
                        "$and": [
                            {"_id": {"$in": [PydanticObjectId(mid) for mid in pod.member_ids]}},
                            {"$or": [{"is_guest": False}, {"is_guest": {"$exists": False}}]}
                        ]
                    }
                ).to_list()
                # Get decks owned by pod members (and not disabled)
                decks = await Deck.find(
                    {
                        "$and": [
                            {"player_id": {"$in": pod.member_ids}},
                            {"$or": [{"disabled": False}, {"disabled": {"$exists": False}}]}
                        ]
                    }
                ).to_list()
                # Get matches from the current pod
                matches = await Match.find(Match.pod_id == current_player.current_pod_id).to_list()
            else:
                # Fallback if pod not found
                decks = await Deck.find(Deck.disabled != True).to_list()
                matches = await Match.find_all().to_list()
                players = await Player.find(
                    {"$or": [{"is_guest": False}, {"is_guest": {"$exists": False}}]}
                ).to_list()
        except Exception:
            # Fallback on error
            decks = await Deck.find(Deck.disabled != True).to_list()
            matches = await Match.find_all().to_list()
            players = await Player.find(
                {"$or": [{"is_guest": False}, {"is_guest": {"$exists": False}}]}
            ).to_list()

    # Create player lookup (excludes guests) - include avatar info
    player_lookup = {
        str(p.id): {
            "name": p.name,
            "picture": p.picture,
            "custom_avatar": p.custom_avatar
        } for p in players
    }

    leaderboard = []

    for deck in decks:
        deck_id = str(deck.id)

        # Find player who owns this deck - check using player_id field on deck
        owner_info = player_lookup.get(deck.player_id, {"name": "Unknown", "picture": None, "custom_avatar": None})
        owner_name = owner_info["name"]

        # Count games where this deck was played
        games_played = sum(1 for match in matches if any(p.deck_id == deck_id for p in match.players))

        # Count wins
        wins = sum(1 for match in matches if match.winner_deck_id == deck_id)

        # Calculate win rate
        win_rate = (wins / games_played * 100) if games_played > 0 else 0

        if games_played > 0:  # Only include decks that have been played
            losses = games_played - wins

            leaderboard.append({
                "deck_id": deck_id,
                "deck_name": deck.name,
                "commander": deck.commander,
                "commander_image_url": deck.commander_image_url,
                "colors": deck.colors,
                "player_id": deck.player_id,
                "player_name": owner_name,
                "player_picture": owner_info["picture"],
                "player_custom_avatar": owner_info["custom_avatar"],
                "games_played": games_played,
                "wins": wins,
                "losses": losses,
                "win_rate": round(win_rate, 1),
                "ranked": games_played >= MIN_GAMES_FOR_RANKING,
            })

    # Sort by ranked first (True before False), then by win rate descending
    leaderboard.sort(key=lambda x: (x["ranked"], x["win_rate"], x["wins"]), reverse=True)

    return leaderboard


@router.get("/stats")
async def get_dashboard_stats(
    current_player: Optional[Player] = Depends(get_optional_player)
) -> Dict[str, Any]:
    """Get overall statistics for the dashboard from current pod (or all stats if no pod context)"""
    # Get players, matches, and decks filtered by pod if available
    if not current_player or not current_player.current_pod_id:
        # No pod context - return all stats (backward compatibility)
        players = await Player.find(
            {"$or": [{"is_guest": False}, {"is_guest": {"$exists": False}}]}
        ).to_list()
        matches = await Match.find_all().to_list()
        decks = await Deck.find_all().to_list()
    else:
        # Pod context - filter to current pod
        try:
            pod = await Pod.get(PydanticObjectId(current_player.current_pod_id))
            if pod:
                # Get players in the pod
                players = await Player.find(
                    {
                        "$and": [
                            {"_id": {"$in": [PydanticObjectId(mid) for mid in pod.member_ids]}},
                            {"$or": [{"is_guest": False}, {"is_guest": {"$exists": False}}]}
                        ]
                    }
                ).to_list()
                # Get decks owned by pod members
                decks = await Deck.find({"player_id": {"$in": pod.member_ids}}).to_list()
                # Get matches from the current pod
                matches = await Match.find(Match.pod_id == current_player.current_pod_id).to_list()
            else:
                # Fallback if pod not found
                players = await Player.find(
                    {"$or": [{"is_guest": False}, {"is_guest": {"$exists": False}}]}
                ).to_list()
                matches = await Match.find_all().to_list()
                decks = await Deck.find_all().to_list()
        except Exception:
            # Fallback on error
            players = await Player.find(
                {"$or": [{"is_guest": False}, {"is_guest": {"$exists": False}}]}
            ).to_list()
            matches = await Match.find_all().to_list()
            decks = await Deck.find_all().to_list()

    # Filter out disabled decks for stats
    enabled_decks = [deck for deck in decks if not deck.disabled]

    total_games = len(matches)
    total_players = len(players)  # Excludes guests
    total_decks = len(enabled_decks)  # Only count enabled decks

    # Calculate average pod size
    avg_pod_size = 0
    if total_games > 0:
        total_players_in_games = sum(len(match.players) for match in matches)
        avg_pod_size = round(total_players_in_games / total_games, 1)

    # Get current leader
    player_leaderboard = await get_player_leaderboard(current_player=current_player)
    current_leader = player_leaderboard[0] if player_leaderboard else None

    # Get last game date
    last_game_date = None
    if matches:
        last_game_date = max(match.match_date for match in matches)

    # Most games played (player)
    most_games_player = None
    if players and matches:
        player_game_counts = []
        for player in players:
            player_id = str(player.id)
            games_played = sum(1 for match in matches if any(p.player_id == player_id for p in match.players))
            if games_played > 0:
                player_game_counts.append({
                    "player_name": player.name,
                    "player_picture": player.picture,
                    "player_custom_avatar": player.custom_avatar,
                    "games_played": games_played
                })
        if player_game_counts:
            most_games_player = max(player_game_counts, key=lambda x: x["games_played"])

    # Most played deck (deck + player) - only consider enabled decks
    most_played_deck = None
    if enabled_decks and matches:
        player_lookup_stats = {
            str(p.id): {
                "name": p.name,
                "picture": p.picture,
                "custom_avatar": p.custom_avatar
            } for p in players
        }
        deck_game_counts = []
        for deck in enabled_decks:
            deck_id = str(deck.id)
            games_played = sum(1 for match in matches if any(p.deck_id == deck_id for p in match.players))
            if games_played > 0:
                owner_info = player_lookup_stats.get(deck.player_id, {"name": "Unknown", "picture": None, "custom_avatar": None})
                deck_game_counts.append({
                    "deck_name": deck.name,
                    "commander_image_url": deck.commander_image_url,
                    "player_name": owner_info["name"],
                    "player_picture": owner_info["picture"],
                    "player_custom_avatar": owner_info["custom_avatar"],
                    "games_played": games_played
                })
        if deck_game_counts:
            most_played_deck = max(deck_game_counts, key=lambda x: x["games_played"])

    # Most popular single color (only from enabled decks)
    most_popular_color = None
    if enabled_decks:
        # Count individual colors across enabled decks only
        color_counts = {}
        for deck in enabled_decks:
            if deck.colors:
                for color in deck.colors:
                    color_counts[color] = color_counts.get(color, 0) + 1

        if color_counts:
            most_common_color = max(color_counts.items(), key=lambda x: x[1])
            most_popular_color = {
                "color": most_common_color[0],
                "percentage": round((most_common_color[1] / len(enabled_decks)) * 100, 1)
            }

    # Most popular color identity (only from enabled decks)
    most_popular_identity = None
    if enabled_decks:
        # Count color identity combinations from enabled decks only
        identity_combos = []
        for deck in enabled_decks:
            if deck.colors:
                # Sort colors to create consistent combo representation
                sorted_colors = tuple(sorted(deck.colors))
                identity_combos.append(sorted_colors)

        if identity_combos:
            identity_counts = Counter(identity_combos)
            most_common_identity = identity_counts.most_common(1)[0]
            identity_colors = list(most_common_identity[0])
            identity_name = get_color_identity_name(identity_colors)

            most_popular_identity = {
                "colors": identity_colors,
                "name": identity_name,
                "count": most_common_identity[1],
                "percentage": round((most_common_identity[1] / len(enabled_decks)) * 100, 1)
            }

    # Analytics: Elo Leader
    elo_leader = None
    if current_player and current_player.current_pod_id:
        top_rating = await PlayerEloRating.find(
            PlayerEloRating.pod_id == current_player.current_pod_id
        ).sort(-PlayerEloRating.current_elo).first_or_none()

        if top_rating:
            leader_player = await Player.get(PydanticObjectId(top_rating.player_id))
            if leader_player:
                elo_leader = {
                    "player_id": top_rating.player_id,
                    "player_name": leader_player.name,
                    "picture": leader_player.picture,
                    "custom_avatar": leader_player.custom_avatar,
                    "elo": round(top_rating.current_elo),
                    "games_rated": top_rating.games_rated
                }

    # Analytics: Rising Star
    rising_star_data = None
    if current_player and current_player.current_pod_id:
        rising_star_result = await get_rising_star(current_player.current_pod_id)
        if rising_star_result:
            rs_player = await Player.get(PydanticObjectId(rising_star_result["player_id"]))
            rising_star_data = {
                "player": {
                    "player_id": rising_star_result["player_id"],
                    "player_name": rs_player.name if rs_player else "Unknown",
                    "picture": rs_player.picture if rs_player else None,
                    "custom_avatar": rs_player.custom_avatar if rs_player else None,
                },
                "elo_gain": rising_star_result["elo_gain"],
                "current_elo": rising_star_result["current_elo"]
            }

    # Analytics: Pod Balance
    pod_balance = None
    if current_player and current_player.current_pod_id and len(matches) >= 5:
        # Get last 30 matches for balance calculation
        recent_matches = sorted(matches, key=lambda m: m.created_at, reverse=True)[:30]
        win_counts = Counter(match.winner_player_id for match in recent_matches)
        total_wins = sum(win_counts.values())

        if total_wins > 0:
            wins = sorted(win_counts.values())
            n = len(wins)

            if n <= 1:
                gini = 0
            else:
                cumulative = sum((i + 1) * w for i, w in enumerate(wins))
                gini = (2 * cumulative) / (n * sum(wins)) - (n + 1) / n

            balance_score = round((1 - gini) * 100)

            if balance_score >= 70:
                status = "Healthy"
            elif balance_score >= 50:
                status = "Uneven"
            else:
                status = "Dominated"

            pod_balance = {
                "score": balance_score,
                "status": status,
                "games_analyzed": len(recent_matches),
                "unique_winners": len(win_counts)
            }

    return {
        "total_games": total_games,
        "total_players": total_players,
        "total_decks": total_decks,
        "avg_pod_size": avg_pod_size,
        "current_leader": current_leader,
        "last_game_date": last_game_date,
        "most_games_player": most_games_player,
        "most_played_deck": most_played_deck,
        "most_popular_color": most_popular_color,
        "most_popular_identity": most_popular_identity,
        # Analytics
        "elo_leader": elo_leader,
        "rising_star": rising_star_data,
        "pod_balance": pod_balance,
    }
