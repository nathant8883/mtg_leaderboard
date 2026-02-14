from datetime import datetime, date
from typing import Optional, Any
from beanie import Document, PydanticObjectId
from pydantic import BaseModel, Field, field_validator, ConfigDict


class MatchPlayer(BaseModel):
    """Represents a player in a match with their deck (embedded subdocument)"""
    player_id: str
    player_name: str
    deck_id: str
    deck_name: str
    deck_colors: list[str] = []  # Deck color identity (W/U/B/R/G), snapshotted at match creation
    elimination_order: Optional[int] = None  # Player placement (1=winner, 2=2nd, 3=3rd, 4=4th). None if only winner is known
    is_winner: bool = False
    eliminated_by_player_id: Optional[str] = None  # player_id of who eliminated this player (null if scooped or winner)
    elimination_type: Optional[str] = None  # "kill" | "scoop" | None (winner has None)
    is_alt_win: bool = False  # True if this match ended via alternative win condition


class Match(Document):
    """Match document - records a game between 2-6 players"""
    players: list[MatchPlayer] = Field(min_length=2, max_length=6)
    winner_player_id: str
    winner_deck_id: str
    pod_id: Optional[str] = None  # Pod where match was played (snapshot)
    match_date: date = Field(default_factory=date.today)
    duration_seconds: Optional[int] = None  # Game duration in seconds
    first_player_position: Optional[int] = None  # Index of player who went first (0-based position in players list)
    event_id: Optional[str] = None  # Links match to a tournament event
    event_round: Optional[int] = None  # Which round of the event (1-based)
    created_at: datetime = Field(default_factory=datetime.utcnow)

    @field_validator('players')
    @classmethod
    def validate_player_count(cls, v):
        if len(v) < 2:
            raise ValueError('Match must have at least 2 players')
        if len(v) > 6:
            raise ValueError('Match cannot have more than 6 players')
        return v

    @field_validator('winner_player_id')
    @classmethod
    def validate_winner_in_match(cls, v, info):
        if 'players' in info.data:
            player_ids = [p.player_id for p in info.data['players']]
            if v not in player_ids:
                raise ValueError('Winner must be one of the players in the match')
        return v

    @field_validator('first_player_position')
    @classmethod
    def validate_first_player_position(cls, v, info):
        if v is not None and 'players' in info.data:
            player_count = len(info.data['players'])
            if v < 0 or v >= player_count:
                raise ValueError(f'first_player_position must be between 0 and {player_count - 1}')
        return v

    class Settings:
        name = "matches"
        use_state_management = True
        use_revision = False

    model_config = ConfigDict(
        populate_by_name=True,
        # Allow _id to be accessed as id
        json_schema_extra={
            "example": {
                "id": "507f1f77bcf86cd799439011",
                "players": [],
                "winner_player_id": "507f1f77bcf86cd799439011",
                "winner_deck_id": "507f1f77bcf86cd799439011",
                "match_date": "2025-10-17",
                "duration_seconds": 3600,
                "first_player_position": 0,
                "created_at": "2025-10-17T12:00:00"
            }
        }
    )

    def model_dump(self, **kwargs) -> dict[str, Any]:
        """Override to ensure id is used instead of _id"""
        data = super().model_dump(**kwargs)
        if '_id' in data:
            data['id'] = str(data.pop('_id'))
        return data
