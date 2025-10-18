from fastapi import APIRouter, HTTPException, status
from beanie import PydanticObjectId
from pydantic import BaseModel
from datetime import date

from app.models.match import Match, MatchPlayer
from app.models.player import Player, Deck

router = APIRouter()


class CreateMatchRequest(BaseModel):
    """Request body for creating a match"""
    player_deck_pairs: list[dict[str, str]]  # [{"player_id": "...", "deck_id": "..."}, ...]
    winner_player_id: str
    winner_deck_id: str
    match_date: date
    duration_seconds: int | None = None  # Game duration in seconds
    elimination_orders: dict[str, int] | None = None  # Maps player_id to placement (1=winner, 2=2nd, 3=3rd, 4=4th)


def serialize_match(match: Match) -> dict:
    """Helper function to serialize a match with id instead of _id"""
    return {
        "id": str(match.id),
        "players": [
            {
                "player_id": p.player_id,
                "player_name": p.player_name,
                "deck_id": p.deck_id,
                "deck_name": p.deck_name,
                "deck_colors": p.deck_colors,
                "elimination_order": p.elimination_order,
                "is_winner": p.is_winner
            }
            for p in match.players
        ],
        "winner_player_id": match.winner_player_id,
        "winner_deck_id": match.winner_deck_id,
        "match_date": match.match_date.isoformat(),
        "duration_seconds": match.duration_seconds,
        "created_at": match.created_at.isoformat()
    }


@router.get("/")
async def get_all_matches(limit: int = 50, skip: int = 0):
    """Get all matches with pagination"""
    matches = await Match.find_all().skip(skip).limit(limit).sort(-Match.match_date).to_list()
    return [serialize_match(match) for match in matches]


@router.get("/recent")
async def get_recent_matches(limit: int = 10):
    """Get recent matches"""
    matches = await Match.find_all().limit(limit).sort(-Match.match_date).to_list()
    return [serialize_match(match) for match in matches]


@router.get("/{match_id}")
async def get_match(match_id: str):
    """Get a specific match by ID"""
    try:
        # Convert string to PydanticObjectId
        obj_id = PydanticObjectId(match_id)

        # Workaround: Beanie's find_one with _id filter seems to have issues
        # Use find_all and filter in Python instead
        all_matches = await Match.find_all().to_list()
        match = next((m for m in all_matches if m.id == obj_id), None)

        if not match:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Match not found")
        return serialize_match(match)
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Invalid match ID: {str(e)}")


@router.post("/", status_code=status.HTTP_201_CREATED)
async def create_match(request: CreateMatchRequest):
    """
    Create a new match with player and deck data.

    Fetches player names and deck names from the database to store
    as snapshots in the match record.
    """
    # Validate player count
    if len(request.player_deck_pairs) < 3:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Match must have at least 3 players"
        )
    if len(request.player_deck_pairs) > 6:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Match cannot have more than 6 players"
        )

    # Build MatchPlayer objects with snapshot data
    match_players = []
    player_ids = []

    for pair in request.player_deck_pairs:
        player_id = pair["player_id"]
        deck_id = pair["deck_id"]
        player_ids.append(player_id)

        # Fetch player and deck data
        player = await Player.get(PydanticObjectId(player_id))
        if not player:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Player {player_id} not found"
            )

        deck = await Deck.get(PydanticObjectId(deck_id))
        if not deck:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Deck {deck_id} not found"
            )

        # Create MatchPlayer with snapshot data
        is_winner = (player_id == request.winner_player_id and deck_id == request.winner_deck_id)
        elimination_order = request.elimination_orders.get(player_id) if request.elimination_orders else None
        match_players.append(MatchPlayer(
            player_id=player_id,
            player_name=player.name,
            deck_id=deck_id,
            deck_name=deck.name,
            deck_colors=deck.colors,  # Snapshot deck colors for historical accuracy
            elimination_order=elimination_order,  # Player placement (1=winner, 2=2nd, etc.)
            is_winner=is_winner
        ))

    # Validate winner is in the match
    if request.winner_player_id not in player_ids:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Winner must be one of the players in the match"
        )

    # Create and save match
    match = Match(
        players=match_players,
        winner_player_id=request.winner_player_id,
        winner_deck_id=request.winner_deck_id,
        match_date=request.match_date,
        duration_seconds=request.duration_seconds
    )

    await match.insert()

    # Return serialized match
    return {
        "id": str(match.id),
        "players": [
            {
                "player_id": p.player_id,
                "player_name": p.player_name,
                "deck_id": p.deck_id,
                "deck_name": p.deck_name,
                "deck_colors": p.deck_colors,
                "elimination_order": p.elimination_order,
                "is_winner": p.is_winner
            }
            for p in match.players
        ],
        "winner_player_id": match.winner_player_id,
        "winner_deck_id": match.winner_deck_id,
        "match_date": match.match_date.isoformat(),
        "duration_seconds": match.duration_seconds,
        "created_at": match.created_at.isoformat()
    }


@router.delete("/{match_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_match(match_id: PydanticObjectId):
    """Delete a match"""
    match = await Match.get(match_id)
    if not match:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Match not found")

    await match.delete()
