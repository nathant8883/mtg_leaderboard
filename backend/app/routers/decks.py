import logging
from fastapi import APIRouter, HTTPException, status, Depends
from beanie import PydanticObjectId
from pydantic import BaseModel
from typing import Optional

logger = logging.getLogger(__name__)

from app.models.player import Deck, Player
from app.models.match import Match
from app.models.pod import Pod
from app.services.scryfall import scryfall_service
from app.middleware.auth import get_current_player, get_optional_player

router = APIRouter()


class CreateDeckRequest(BaseModel):
    """Request model for creating a deck"""
    name: str
    commander: str
    commander_image_url: str | None = None
    colors: list[str] = []
    disabled: bool = False
    player_id: str | None = None  # Optional - only used by superusers to create decks for other players


class CreateQuickDeckRequest(BaseModel):
    """Request model for creating a quick deck on behalf of another player"""
    target_player_id: str  # The player who will own this deck
    name: str
    commander: str


@router.get("/")
async def get_all_decks(current_player: Optional[Player] = Depends(get_optional_player)):
    """Get all enabled decks from current pod (or all enabled decks if no pod context)"""
    # If no current player or no current pod, return all enabled decks (backward compatibility)
    if not current_player or not current_player.current_pod_id:
        decks = await Deck.find(Deck.disabled != True).to_list()
    else:
        # Two-step filtering: get pod members, then get their decks
        try:
            pod = await Pod.get(PydanticObjectId(current_player.current_pod_id))
            if pod:
                # Get decks owned by pod members (and not disabled)
                decks = await Deck.find(
                    {
                        "$and": [
                            {"player_id": {"$in": pod.member_ids}},
                            {"$or": [{"disabled": False}, {"disabled": {"$exists": False}}]}
                        ]
                    }
                ).to_list()
            else:
                # Fallback to all enabled decks if pod not found
                decks = await Deck.find(Deck.disabled != True).to_list()
        except Exception:
            # Fallback to all enabled decks on error
            decks = await Deck.find(Deck.disabled != True).to_list()

    # Convert _id to id for frontend compatibility
    return [
        {
            "id": str(deck.id),
            "name": deck.name,
            "player_id": deck.player_id,
            "commander": deck.commander,
            "commander_image_url": deck.commander_image_url,
            "colors": deck.colors,
            "disabled": deck.disabled,
            "is_quick_deck": deck.is_quick_deck,
            "created_by_player_id": deck.created_by_player_id,
            "created_at": deck.created_at
        }
        for deck in decks
    ]


@router.get("/pending")
async def get_pending_decks(current_player: Player = Depends(get_current_player)):
    """Get all quick decks pending review for the current player"""
    decks = await Deck.find(
        {
            "player_id": str(current_player.id),
            "is_quick_deck": True
        }
    ).to_list()

    # Resolve creator names
    result = []
    for deck in decks:
        creator_name = "Unknown"
        if deck.created_by_player_id:
            try:
                creator = await Player.get(PydanticObjectId(deck.created_by_player_id))
                if creator:
                    creator_name = creator.name
            except Exception:
                pass

        result.append({
            "id": str(deck.id),
            "name": deck.name,
            "player_id": deck.player_id,
            "commander": deck.commander,
            "commander_image_url": deck.commander_image_url,
            "colors": deck.colors,
            "disabled": deck.disabled,
            "is_quick_deck": deck.is_quick_deck,
            "created_by_player_id": deck.created_by_player_id,
            "created_by_player_name": creator_name,
            "created_at": deck.created_at
        })

    return result


@router.get("/match-counts")
async def get_deck_match_counts(current_player: Optional[Player] = Depends(get_optional_player)):
    """Get the number of matches each deck has been played in."""
    pipeline = [
        {"$unwind": "$players"},
        {"$group": {"_id": "$players.deck_id", "count": {"$sum": 1}}},
    ]
    results = await Match.aggregate(pipeline).to_list()
    return {item["_id"]: item["count"] for item in results if item["_id"]}


@router.get("/{deck_id}")
async def get_deck(deck_id: PydanticObjectId):
    """Get a specific deck by ID"""
    deck = await Deck.get(deck_id)
    if not deck:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Deck not found")
    return {
        "id": str(deck.id),
        "name": deck.name,
        "player_id": deck.player_id,
        "commander": deck.commander,
        "commander_image_url": deck.commander_image_url,
        "colors": deck.colors,
        "disabled": deck.disabled,
        "is_quick_deck": deck.is_quick_deck,
        "created_by_player_id": deck.created_by_player_id,
        "created_at": deck.created_at
    }


@router.post("/", status_code=status.HTTP_201_CREATED)
async def create_deck(
    deck_request: CreateDeckRequest,
    current_player: Player = Depends(get_current_player)
):
    """
    Create a new deck with Scryfall integration.

    Requires authentication. Deck will be created for the authenticated user,
    unless a player_id is provided and the current user is a superuser.
    Validates that the commander is a legendary creature and fetches
    commander image and color identity from Scryfall if not provided.
    """
    # Determine which player the deck should be created for
    target_player_id = str(current_player.id)  # Default to authenticated user

    # If player_id is provided and user is superuser, use that instead
    if deck_request.player_id:
        if not current_player.is_superuser:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only superusers can create decks for other players"
            )
        # Verify the target player exists
        target_player = await Player.get(PydanticObjectId(deck_request.player_id))
        if not target_player:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Player with ID '{deck_request.player_id}' not found"
            )
        target_player_id = deck_request.player_id

    # Verify commander exists and is a legendary creature via Scryfall
    commander_details = await scryfall_service.get_commander_details(deck_request.commander)
    if not commander_details:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Commander '{deck_request.commander}' not found or is not a legendary creature"
        )

    # Auto-populate commander image and colors from Scryfall if not provided
    # Use art_crop for cropped artwork display
    commander_image_url = deck_request.commander_image_url
    if not commander_image_url:
        commander_image_url = commander_details.get("image_art_crop") or commander_details.get("image_normal")

    colors = deck_request.colors
    if not colors:
        colors = commander_details.get("color_identity", [])

    # Create deck for the target player
    deck = Deck(
        name=deck_request.name,
        player_id=target_player_id,
        commander=deck_request.commander,
        commander_image_url=commander_image_url,
        colors=colors,
        disabled=deck_request.disabled
    )

    await deck.insert()
    return {
        "id": str(deck.id),
        "name": deck.name,
        "player_id": deck.player_id,
        "commander": deck.commander,
        "commander_image_url": deck.commander_image_url,
        "colors": deck.colors,
        "disabled": deck.disabled,
        "is_quick_deck": deck.is_quick_deck,
        "created_by_player_id": deck.created_by_player_id,
        "created_at": deck.created_at
    }


@router.post("/quick", status_code=status.HTTP_201_CREATED)
async def create_quick_deck(
    deck_request: CreateQuickDeckRequest,
    current_player: Player = Depends(get_current_player)
):
    """
    Create a quick deck on behalf of another player.

    Any authenticated player can create a deck for another player in their pod.
    The deck is marked as a quick deck and must be reviewed by the owner.
    """
    # Verify the target player exists
    target_player = await Player.get(PydanticObjectId(deck_request.target_player_id))
    if not target_player:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Player with ID '{deck_request.target_player_id}' not found"
        )

    # Verify commander exists and is a legendary creature via Scryfall
    commander_details = await scryfall_service.get_commander_details(deck_request.commander)
    if not commander_details:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Commander '{deck_request.commander}' not found or is not a legendary creature"
        )

    # Get commander image and colors from Scryfall
    commander_image_url = commander_details.get("image_art_crop") or commander_details.get("image_normal")
    colors = commander_details.get("color_identity", [])

    # Create the quick deck
    deck = Deck(
        name=deck_request.name,
        player_id=deck_request.target_player_id,
        commander=deck_request.commander,
        commander_image_url=commander_image_url,
        colors=colors,
        disabled=False,  # Quick decks are immediately usable
        is_quick_deck=True,
        created_by_player_id=str(current_player.id)
    )

    await deck.insert()
    return {
        "id": str(deck.id),
        "name": deck.name,
        "player_id": deck.player_id,
        "commander": deck.commander,
        "commander_image_url": deck.commander_image_url,
        "colors": deck.colors,
        "disabled": deck.disabled,
        "is_quick_deck": deck.is_quick_deck,
        "created_by_player_id": deck.created_by_player_id,
        "created_at": deck.created_at
    }


@router.post("/{deck_id}/accept")
async def accept_quick_deck(
    deck_id: PydanticObjectId,
    current_player: Player = Depends(get_current_player)
):
    """Accept a quick deck, marking it as fully owned by the player."""
    deck = await Deck.get(deck_id)
    if not deck:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Deck not found")

    # Verify ownership
    if deck.player_id != str(current_player.id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only accept your own decks"
        )

    # Verify it's a quick deck
    if not deck.is_quick_deck:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This deck is not a quick deck"
        )

    # Accept the deck by clearing the quick deck flags
    await deck.set({
        Deck.is_quick_deck: False,
        Deck.created_by_player_id: None
    })

    return {
        "id": str(deck.id),
        "name": deck.name,
        "player_id": deck.player_id,
        "commander": deck.commander,
        "commander_image_url": deck.commander_image_url,
        "colors": deck.colors,
        "disabled": deck.disabled,
        "is_quick_deck": deck.is_quick_deck,
        "created_by_player_id": deck.created_by_player_id,
        "created_at": deck.created_at
    }


@router.put("/{deck_id}")
async def update_deck(
    deck_id: PydanticObjectId,
    deck_request: CreateDeckRequest,
    current_player: Player = Depends(get_current_player)
):
    """Update a deck with Scryfall validation. Requires deck ownership."""
    deck = await Deck.get(deck_id)
    if not deck:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Deck not found")

    # Verify ownership (or superuser)
    if deck.player_id != str(current_player.id) and not current_player.is_superuser:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only update your own decks"
        )

    # If commander changed, validate and fetch new data from Scryfall
    if deck_request.commander != deck.commander:
        commander_details = await scryfall_service.get_commander_details(deck_request.commander)
        if not commander_details:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Commander '{deck_request.commander}' not found or is not a legendary creature"
            )

        # Update image and colors from Scryfall - use art_crop for cropped artwork
        commander_image_url = commander_details.get("image_art_crop") or commander_details.get("image_normal")
        colors = commander_details.get("color_identity", [])
    else:
        commander_image_url = deck_request.commander_image_url or deck.commander_image_url
        colors = deck_request.colors or deck.colors

    await deck.set({
        Deck.name: deck_request.name,
        Deck.commander: deck_request.commander,
        Deck.commander_image_url: commander_image_url,
        Deck.colors: colors,
        Deck.disabled: deck_request.disabled,
    })
    return {
        "id": str(deck.id),
        "name": deck.name,
        "player_id": deck.player_id,
        "commander": deck.commander,
        "commander_image_url": deck.commander_image_url,
        "colors": deck.colors,
        "disabled": deck.disabled,
        "is_quick_deck": deck.is_quick_deck,
        "created_by_player_id": deck.created_by_player_id,
        "created_at": deck.created_at
    }


@router.delete("/{deck_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_deck(
    deck_id: PydanticObjectId,
    current_player: Player = Depends(get_current_player)
):
    """Delete a deck. Requires deck ownership. Decks with match history cannot be deleted."""
    deck = await Deck.get(deck_id)
    if not deck:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Deck not found")

    # Verify ownership (or superuser)
    if deck.player_id != str(current_player.id) and not current_player.is_superuser:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only delete your own decks"
        )

    # Prevent deletion of decks with match history
    match_count = await Match.find({"players.deck_id": str(deck_id)}).count()
    if match_count > 0:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Cannot delete deck with {match_count} match(es) in history. Disable it instead."
        )

    # Clean up the owning player's deck_ids array
    owner = await Player.get(PydanticObjectId(deck.player_id))
    if owner:
        if owner.deck_ids and str(deck_id) in owner.deck_ids:
            owner.deck_ids.remove(str(deck_id))
            await owner.set({Player.deck_ids: owner.deck_ids})
    else:
        logger.warning(f"Deck {deck_id} owner {deck.player_id} not found during cleanup")

    await deck.delete()
