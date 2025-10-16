from fastapi import APIRouter, HTTPException, status
from beanie import PydanticObjectId

from app.models.player import Player

router = APIRouter()


@router.get("/")
async def get_all_players():
    """Get all players"""
    players = await Player.find_all().to_list()
    # Convert _id to id for frontend compatibility
    return [
        {
            "id": str(player.id),
            "name": player.name,
            "avatar": player.avatar,
            "deck_ids": player.deck_ids,
            "created_at": player.created_at
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


@router.put("/{player_id}")
async def update_player(player_id: PydanticObjectId, updated_player: Player):
    """Update a player"""
    player = await Player.get(player_id)
    if not player:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Player not found")

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
