from datetime import datetime
from typing import Optional, Any
from beanie import Document, PydanticObjectId
from pydantic import Field, ConfigDict, field_serializer


class Deck(Document):
    """Deck document with commander information"""
    name: str
    player_id: str  # Reference to owning player
    commander: str  # Full commander card name (e.g., "Atraxa, Praetors' Voice")
    commander_image_url: Optional[str] = None  # Cached Scryfall image URL
    colors: list[str] = Field(default_factory=list)  # MTG color identity (W/U/B/R/G)
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "decks"
        use_state_management = True
        use_revision = False

    def model_dump(self, **kwargs) -> dict[str, Any]:
        """Override to ensure id is used instead of _id"""
        data = super().model_dump(**kwargs)
        if '_id' in data:
            data['id'] = str(data.pop('_id'))
        return data


class Player(Document):
    """Player document"""
    name: str
    avatar: Optional[str] = None  # Single letter or emoji
    deck_ids: list[str] = Field(default_factory=list)  # References to Deck documents
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "players"
        use_state_management = True
        # This tells Beanie to use 'id' in JSON output
        use_revision = False

    model_config = ConfigDict(
        populate_by_name=True,
        # This makes pydantic accept both 'id' and '_id'
        # and serialize as 'id' by default
        json_schema_extra={
            "example": {
                "id": "507f1f77bcf86cd799439011",
                "name": "John Doe",
                "avatar": "J",
                "deck_ids": [],
                "created_at": "2024-01-01T00:00:00"
            }
        }
    )

    def model_dump(self, **kwargs) -> dict[str, Any]:
        """Override to ensure id is used instead of _id"""
        data = super().model_dump(**kwargs)
        if '_id' in data:
            data['id'] = str(data.pop('_id'))
        return data
