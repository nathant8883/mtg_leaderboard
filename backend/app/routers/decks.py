from fastapi import APIRouter, HTTPException, status
from beanie import PydanticObjectId

from app.models.player import Deck

router = APIRouter()


@router.get("/", response_model=list[Deck])
async def get_all_decks():
    """Get all decks"""
    decks = await Deck.find_all().to_list()
    return decks


@router.get("/{deck_id}", response_model=Deck)
async def get_deck(deck_id: PydanticObjectId):
    """Get a specific deck by ID"""
    deck = await Deck.get(deck_id)
    if not deck:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Deck not found")
    return deck


@router.post("/", response_model=Deck, status_code=status.HTTP_201_CREATED)
async def create_deck(deck: Deck):
    """Create a new deck"""
    await deck.insert()
    return deck


@router.put("/{deck_id}", response_model=Deck)
async def update_deck(deck_id: PydanticObjectId, updated_deck: Deck):
    """Update a deck"""
    deck = await Deck.get(deck_id)
    if not deck:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Deck not found")

    await deck.set({
        Deck.name: updated_deck.name,
        Deck.commander: updated_deck.commander,
        Deck.colors: updated_deck.colors,
    })
    return deck


@router.delete("/{deck_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_deck(deck_id: PydanticObjectId):
    """Delete a deck"""
    deck = await Deck.get(deck_id)
    if not deck:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Deck not found")

    await deck.delete()
