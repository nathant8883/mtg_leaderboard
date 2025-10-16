from fastapi import APIRouter, HTTPException, status, Depends
from beanie import PydanticObjectId
from pydantic import BaseModel

from app.models.player import Deck, Player
from app.services.scryfall import scryfall_service
from app.middleware.auth import get_current_player

router = APIRouter()


class CreateDeckRequest(BaseModel):
    """Request model for creating a deck (no player_id needed, uses authenticated user)"""
    name: str
    commander: str
    commander_image_url: str | None = None
    colors: list[str] = []


@router.get("/")
async def get_all_decks():
    """Get all decks"""
    decks = await Deck.find_all().to_list()
    # Convert _id to id for frontend compatibility
    return [
        {
            "id": str(deck.id),
            "name": deck.name,
            "player_id": deck.player_id,
            "commander": deck.commander,
            "commander_image_url": deck.commander_image_url,
            "colors": deck.colors,
            "created_at": deck.created_at
        }
        for deck in decks
    ]


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
        "created_at": deck.created_at
    }


@router.post("/", status_code=status.HTTP_201_CREATED)
async def create_deck(
    deck_request: CreateDeckRequest,
    current_player: Player = Depends(get_current_player)
):
    """
    Create a new deck with Scryfall integration.

    Requires authentication. Deck will be created for the authenticated user.
    Validates that the commander is a legendary creature and fetches
    commander image and color identity from Scryfall if not provided.
    """
    # Verify commander exists and is a legendary creature via Scryfall
    commander_details = await scryfall_service.get_commander_details(deck_request.commander)
    if not commander_details:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Commander '{deck_request.commander}' not found or is not a legendary creature"
        )

    # Auto-populate commander image and colors from Scryfall if not provided
    commander_image_url = deck_request.commander_image_url
    if not commander_image_url:
        commander_image_url = commander_details.get("image_art_crop") or commander_details.get("image_normal")

    colors = deck_request.colors
    if not colors:
        colors = commander_details.get("color_identity", [])

    # Create deck for the authenticated user
    deck = Deck(
        name=deck_request.name,
        player_id=str(current_player.id),
        commander=deck_request.commander,
        commander_image_url=commander_image_url,
        colors=colors
    )

    await deck.insert()
    return {
        "id": str(deck.id),
        "name": deck.name,
        "player_id": deck.player_id,
        "commander": deck.commander,
        "commander_image_url": deck.commander_image_url,
        "colors": deck.colors,
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

        # Update image and colors from Scryfall
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
    })
    return {
        "id": str(deck.id),
        "name": deck.name,
        "player_id": deck.player_id,
        "commander": deck.commander,
        "commander_image_url": deck.commander_image_url,
        "colors": deck.colors,
        "created_at": deck.created_at
    }


@router.delete("/{deck_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_deck(
    deck_id: PydanticObjectId,
    current_player: Player = Depends(get_current_player)
):
    """Delete a deck. Requires deck ownership."""
    deck = await Deck.get(deck_id)
    if not deck:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Deck not found")

    # Verify ownership (or superuser)
    if deck.player_id != str(current_player.id) and not current_player.is_superuser:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only delete your own decks"
        )

    await deck.delete()
