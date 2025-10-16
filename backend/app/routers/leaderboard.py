from fastapi import APIRouter
from typing import Dict, Any

from app.models.match import Match
from app.models.player import Player, Deck

router = APIRouter()


@router.get("/players")
async def get_player_leaderboard() -> list[Dict[str, Any]]:
    """Get leaderboard by player"""
    players = await Player.find_all().to_list()
    matches = await Match.find_all().to_list()

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

        leaderboard.append({
            "player_id": player_id,
            "player_name": player.name,
            "avatar": player.avatar,
            "games_played": games_played,
            "wins": wins,
            "losses": losses,
            "win_rate": round(win_rate, 1),
            "deck_count": deck_count,
        })

    # Sort by win rate descending
    leaderboard.sort(key=lambda x: (x["win_rate"], x["wins"]), reverse=True)

    return leaderboard


@router.get("/decks")
async def get_deck_leaderboard() -> list[Dict[str, Any]]:
    """Get leaderboard by deck"""
    decks = await Deck.find_all().to_list()
    matches = await Match.find_all().to_list()
    players = await Player.find_all().to_list()

    # Create player lookup
    player_lookup = {str(p.id): p.name for p in players}

    leaderboard = []

    for deck in decks:
        deck_id = str(deck.id)

        # Find player who owns this deck - check using player_id field on deck
        owner_name = player_lookup.get(deck.player_id, "Unknown")

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
                "player_name": owner_name,
                "games_played": games_played,
                "wins": wins,
                "losses": losses,
                "win_rate": round(win_rate, 1),
            })

    # Sort by win rate descending
    leaderboard.sort(key=lambda x: (x["win_rate"], x["wins"]), reverse=True)

    return leaderboard


@router.get("/stats")
async def get_dashboard_stats() -> Dict[str, Any]:
    """Get overall statistics for the dashboard"""
    players = await Player.find_all().to_list()
    matches = await Match.find_all().to_list()
    decks = await Deck.find_all().to_list()

    total_games = len(matches)
    total_players = len(players)
    total_decks = len(decks)

    # Calculate average pod size
    avg_pod_size = 0
    if total_games > 0:
        total_players_in_games = sum(len(match.players) for match in matches)
        avg_pod_size = round(total_players_in_games / total_games, 1)

    # Get current leader
    player_leaderboard = await get_player_leaderboard()
    current_leader = player_leaderboard[0] if player_leaderboard else None

    # Get last game date
    last_game_date = None
    if matches:
        last_game_date = max(match.match_date for match in matches)

    return {
        "total_games": total_games,
        "total_players": total_players,
        "total_decks": total_decks,
        "avg_pod_size": avg_pod_size,
        "current_leader": current_leader,
        "last_game_date": last_game_date,
    }
