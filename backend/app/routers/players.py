from fastapi import APIRouter, HTTPException, status, Depends
from beanie import PydanticObjectId
from typing import Dict, Any, Optional

from app.models.player import Player, Deck
from app.models.match import Match
from app.models.pod import Pod
from app.middleware.auth import get_current_player, get_optional_player

router = APIRouter()


@router.get("/")
async def get_all_players(current_player: Optional[Player] = Depends(get_optional_player)):
    """Get all players in current pod (or all non-guest players if no pod context)
    Superusers always see all players regardless of pod membership."""

    # Superusers always see all non-guest players
    if current_player and current_player.is_superuser:
        players = await Player.find(
            {"$or": [{"is_guest": False}, {"is_guest": {"$exists": False}}]}
        ).to_list()
    # If no current player or no current pod, return all non-guest players (backward compatibility)
    elif not current_player or not current_player.current_pod_id:
        players = await Player.find(
            {"$or": [{"is_guest": False}, {"is_guest": {"$exists": False}}]}
        ).to_list()
    else:
        # Get pod members
        try:
            pod = await Pod.get(PydanticObjectId(current_player.current_pod_id))
            if pod:
                # Get players who are members of the current pod (and not guests)
                players = await Player.find(
                    {
                        "$and": [
                            {"_id": {"$in": [PydanticObjectId(mid) for mid in pod.member_ids]}},
                            {"$or": [{"is_guest": False}, {"is_guest": {"$exists": False}}]}
                        ]
                    }
                ).to_list()
            else:
                # Fallback to all non-guest players if pod not found
                players = await Player.find(
                    {"$or": [{"is_guest": False}, {"is_guest": {"$exists": False}}]}
                ).to_list()
        except Exception:
            # Fallback to all non-guest players on error
            players = await Player.find(
                {"$or": [{"is_guest": False}, {"is_guest": {"$exists": False}}]}
            ).to_list()

    # Convert _id to id for frontend compatibility
    return [
        {
            "id": str(player.id),
            "name": player.name,
            "avatar": player.avatar,
            "picture": player.picture,
            "custom_avatar": player.custom_avatar,
            "deck_ids": player.deck_ids,
            "created_at": player.created_at
        }
        for player in players
    ]


@router.get("/search")
async def search_players(q: str):
    """Search players by name (case-insensitive, excludes guest players)"""
    if not q or len(q.strip()) == 0:
        return []

    # Search for non-guest players whose name contains the query (case-insensitive)
    players = await Player.find(
        {
            "$and": [
                {"name": {"$regex": q, "$options": "i"}},
                {"$or": [{"is_guest": False}, {"is_guest": {"$exists": False}}]}
            ]
        }
    ).limit(10).to_list()

    # Return minimal fields for autocomplete
    return [
        {
            "id": str(player.id),
            "name": player.name,
            "avatar": player.avatar,
            "picture": player.picture,
            "custom_avatar": player.custom_avatar,
        }
        for player in players
    ]


@router.get("/{player_id}")
async def get_player(player_id: PydanticObjectId):
    """Get a specific player by ID"""
    player = await Player.get(player_id)
    if not player:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Player not found")
    return {
        "id": str(player.id),
        "name": player.name,
        "avatar": player.avatar,
        "deck_ids": player.deck_ids,
        "created_at": player.created_at
    }


@router.get("/{player_id}/detail")
async def get_player_detail(player_id: PydanticObjectId) -> Dict[str, Any]:
    """Get detailed player information including rank, stats, and deck performance"""
    # Get the player
    player = await Player.get(player_id)
    if not player:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Player not found")

    # Guest players don't have detail pages
    if player.is_guest:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Guest players do not have detail pages"
        )

    player_id_str = str(player.id)

    # Get all matches and players for rank calculation
    all_matches = await Match.find_all().to_list()
    all_players = await Player.find_all().to_list()

    # Calculate this player's stats
    games_played = sum(1 for match in all_matches if any(p.player_id == player_id_str for p in match.players))
    wins = sum(1 for match in all_matches if match.winner_player_id == player_id_str)
    losses = games_played - wins
    win_rate = (wins / games_played * 100) if games_played > 0 else 0

    # Calculate rank by comparing with all players
    player_records = []
    for p in all_players:
        p_id = str(p.id)
        p_games = sum(1 for match in all_matches if any(mp.player_id == p_id for mp in match.players))
        p_wins = sum(1 for match in all_matches if match.winner_player_id == p_id)
        p_win_rate = (p_wins / p_games * 100) if p_games > 0 else 0
        player_records.append({
            "player_id": p_id,
            "win_rate": p_win_rate,
            "wins": p_wins
        })

    # Sort by win rate, then wins
    player_records.sort(key=lambda x: (x["win_rate"], x["wins"]), reverse=True)
    rank = next((i + 1 for i, p in enumerate(player_records) if p["player_id"] == player_id_str), None)

    # Get player's decks with stats
    player_decks = await Deck.find(Deck.player_id == player_id_str).to_list()
    deck_stats = []

    for deck in player_decks:
        deck_id = str(deck.id)
        deck_games = sum(1 for match in all_matches if any(p.deck_id == deck_id for p in match.players))
        deck_wins = sum(1 for match in all_matches if match.winner_deck_id == deck_id)
        deck_losses = deck_games - deck_wins
        deck_win_rate = (deck_wins / deck_games * 100) if deck_games > 0 else 0

        deck_stats.append({
            "deck_id": deck_id,
            "deck_name": deck.name,
            "commander": deck.commander,
            "commander_image_url": deck.commander_image_url,
            "colors": deck.colors,
            "disabled": deck.disabled,
            "games_played": deck_games,
            "wins": deck_wins,
            "losses": deck_losses,
            "win_rate": round(deck_win_rate, 1)
        })

    # Sort decks by win rate
    deck_stats.sort(key=lambda x: (x["win_rate"], x["wins"]), reverse=True)

    # Calculate favorite colors (only from enabled decks)
    from collections import Counter

    # Filter out disabled decks for stats calculations
    enabled_decks = [deck for deck in player_decks if not deck.disabled]

    # Count individual colors across enabled decks only
    all_colors = []
    for deck in enabled_decks:
        all_colors.extend(deck.colors)

    color_counts = Counter(all_colors)
    favorite_single_color = color_counts.most_common(1)[0][0] if color_counts else None

    # Count color combinations (sorted tuple of colors) from enabled decks only
    color_combinations = []
    for deck in enabled_decks:
        if deck.colors:
            combo = tuple(sorted(deck.colors))
            color_combinations.append(combo)

    combo_counts = Counter(color_combinations)
    favorite_color_combo = list(combo_counts.most_common(1)[0][0]) if combo_counts else None

    return {
        "player_id": player_id_str,
        "player_name": player.name,
        "avatar": player.avatar,
        "picture": player.picture,
        "custom_avatar": player.custom_avatar,
        "rank": rank,
        "total_games": games_played,
        "wins": wins,
        "losses": losses,
        "win_rate": round(win_rate, 1),
        "active_decks": len(enabled_decks),  # Only count enabled decks
        "member_since": player.created_at,
        "favorite_single_color": favorite_single_color,
        "favorite_color_combo": favorite_color_combo,
        "decks": deck_stats  # Include all decks (enabled and disabled) with disabled flag
    }


@router.post("/", status_code=status.HTTP_201_CREATED)
async def create_player(player: Player):
    """Create a new player"""
    await player.insert()
    return {
        "id": str(player.id),
        "name": player.name,
        "avatar": player.avatar,
        "deck_ids": player.deck_ids,
        "created_at": player.created_at
    }


@router.post("/guest", status_code=status.HTTP_201_CREATED)
async def create_guest_player(name: str):
    """Create a guest player for one-time match tracking"""
    guest = Player(
        name=name,
        avatar="",
        deck_ids=[],
        is_guest=True
    )
    await guest.insert()
    return {
        "id": str(guest.id),
        "name": guest.name,
        "avatar": guest.avatar,
        "is_guest": guest.is_guest,
        "created_at": guest.created_at
    }


@router.put("/{player_id}")
async def update_player(
    player_id: PydanticObjectId,
    updated_player: Player,
    current_player: Player = Depends(get_current_player)
):
    """Update a player (requires authentication, can only update own profile unless superuser)"""
    player = await Player.get(player_id)
    if not player:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Player not found")

    # Authorization check: user must be updating their own profile OR be a superuser
    if str(current_player.id) != str(player_id) and not current_player.is_superuser:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only update your own profile"
        )

    await player.set({
        Player.name: updated_player.name,
        Player.avatar: updated_player.avatar,
        Player.deck_ids: updated_player.deck_ids,
    })
    return {
        "id": str(player.id),
        "name": player.name,
        "avatar": player.avatar,
        "deck_ids": player.deck_ids,
        "created_at": player.created_at
    }


@router.delete("/{player_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_player(player_id: PydanticObjectId):
    """Delete a player"""
    player = await Player.get(player_id)
    if not player:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Player not found")

    await player.delete()
