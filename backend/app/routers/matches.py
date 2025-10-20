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
    first_player_position: int | None = None  # Index of player who went first (0-based position in players list)
    elimination_orders: dict[str, int] | None = None  # Maps player_id to placement (1=winner, 2=2nd, 3=3rd, 4=4th)


class UpdateMatchRequest(BaseModel):
    """Request body for updating a match"""
    player_deck_pairs: list[dict[str, str]] | None = None
    winner_player_id: str | None = None
    winner_deck_id: str | None = None
    match_date: date | None = None
    duration_seconds: int | None = None
    first_player_position: int | None = None
    elimination_orders: dict[str, int] | None = None


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
        "first_player_position": match.first_player_position,
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
async def get_match(match_id: PydanticObjectId):
    """Get a specific match by ID"""
    match = await Match.get(match_id)
    if not match:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Match not found")
    return serialize_match(match)


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
        duration_seconds=request.duration_seconds,
        first_player_position=request.first_player_position
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
        "first_player_position": match.first_player_position,
        "created_at": match.created_at.isoformat()
    }


@router.put("/{match_id}")
async def update_match(match_id: PydanticObjectId, request: UpdateMatchRequest):
    """
    Update an existing match.

    Re-fetches player and deck data to ensure snapshots are current.
    """
    match = await Match.get(match_id)
    if not match:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Match not found")

    # Update match date if provided
    if request.match_date is not None:
        match.match_date = request.match_date

    # Update duration if provided
    if request.duration_seconds is not None:
        match.duration_seconds = request.duration_seconds

    # Update first player position if provided
    if request.first_player_position is not None:
        match.first_player_position = request.first_player_position

    # Update player/deck pairs if provided
    if request.player_deck_pairs is not None:
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

        # Build new MatchPlayer objects with fresh snapshot data
        match_players = []
        player_ids = []

        # Use updated winner IDs if provided, otherwise use existing
        winner_player_id = request.winner_player_id if request.winner_player_id is not None else match.winner_player_id
        winner_deck_id = request.winner_deck_id if request.winner_deck_id is not None else match.winner_deck_id

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
            is_winner = (player_id == winner_player_id and deck_id == winner_deck_id)
            elimination_order = request.elimination_orders.get(player_id) if request.elimination_orders else None
            match_players.append(MatchPlayer(
                player_id=player_id,
                player_name=player.name,
                deck_id=deck_id,
                deck_name=deck.name,
                deck_colors=deck.colors,
                elimination_order=elimination_order,
                is_winner=is_winner
            ))

        # Validate winner is in the match
        if winner_player_id not in player_ids:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Winner must be one of the players in the match"
            )

        # Update match fields
        match.players = match_players
        match.winner_player_id = winner_player_id
        match.winner_deck_id = winner_deck_id

    elif request.winner_player_id is not None or request.winner_deck_id is not None:
        # Only updating winner without changing players
        winner_player_id = request.winner_player_id if request.winner_player_id is not None else match.winner_player_id
        winner_deck_id = request.winner_deck_id if request.winner_deck_id is not None else match.winner_deck_id

        # Validate winner is in the match
        player_ids = [p.player_id for p in match.players]
        if winner_player_id not in player_ids:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Winner must be one of the players in the match"
            )

        # Update winner info and is_winner flags
        match.winner_player_id = winner_player_id
        match.winner_deck_id = winner_deck_id
        for player in match.players:
            player.is_winner = (player.player_id == winner_player_id and player.deck_id == winner_deck_id)

    # Save the updated match
    await match.save()

    return serialize_match(match)


@router.delete("/{match_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_match(match_id: PydanticObjectId):
    """Delete a match"""
    match = await Match.get(match_id)
    if not match:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Match not found")

    await match.delete()
