from fastapi import APIRouter, HTTPException, status
from beanie import PydanticObjectId

from app.models.player import Deck
from app.services.scryfall import scryfall_service

router = APIRouter()


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
async def create_deck(deck: Deck):
    """
    Create a new deck with Scryfall integration.

    Validates that the commander is a legendary creature and fetches
    commander image and color identity from Scryfall if not provided.
    """
    # Verify commander exists and is a legendary creature via Scryfall
    commander_details = await scryfall_service.get_commander_details(deck.commander)
    if not commander_details:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Commander '{deck.commander}' not found or is not a legendary creature"
        )

    # Auto-populate commander image and colors from Scryfall if not provided
    if not deck.commander_image_url:
        deck.commander_image_url = commander_details.get("image_art_crop") or commander_details.get("image_normal")

    if not deck.colors:
        deck.colors = commander_details.get("color_identity", [])

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
async def update_deck(deck_id: PydanticObjectId, updated_deck: Deck):
    """Update a deck with Scryfall validation"""
    deck = await Deck.get(deck_id)
    if not deck:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Deck not found")

    # If commander changed, validate and fetch new data from Scryfall
    if updated_deck.commander != deck.commander:
        commander_details = await scryfall_service.get_commander_details(updated_deck.commander)
        if not commander_details:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Commander '{updated_deck.commander}' not found or is not a legendary creature"
            )

        # Update image and colors from Scryfall
        updated_deck.commander_image_url = commander_details.get("image_art_crop") or commander_details.get("image_normal")
        updated_deck.colors = commander_details.get("color_identity", [])

    await deck.set({
        Deck.name: updated_deck.name,
        Deck.player_id: updated_deck.player_id,
        Deck.commander: updated_deck.commander,
        Deck.commander_image_url: updated_deck.commander_image_url,
        Deck.colors: updated_deck.colors,
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
async def delete_deck(deck_id: PydanticObjectId):
    """Delete a deck"""
    deck = await Deck.get(deck_id)
    if not deck:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Deck not found")

    await deck.delete()
