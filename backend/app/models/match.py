from datetime import datetime, date
from typing import Optional, Any
from beanie import Document
from pydantic import BaseModel, Field, field_validator


class MatchPlayer(BaseModel):
    """Represents a player in a match with their deck (embedded subdocument)"""
    player_id: str
    player_name: str
    deck_id: str
    deck_name: str
    deck_colors: list[str] = []  # Deck color identity (W/U/B/R/G), snapshotted at match creation
    is_winner: bool = False


class Match(Document):
    """Match document - records a game between 3-6 players"""
    players: list[MatchPlayer] = Field(min_length=3, max_length=6)
    winner_player_id: str
    winner_deck_id: str
    match_date: date = Field(default_factory=date.today)
    duration_seconds: Optional[int] = None  # Game duration in seconds
    notes: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

    @field_validator('players')
    @classmethod
    def validate_player_count(cls, v):
        if len(v) < 3:
            raise ValueError('Match must have at least 3 players')
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

    class Settings:
        name = "matches"
        use_state_management = True
        use_revision = False

    def model_dump(self, **kwargs) -> dict[str, Any]:
        """Override to ensure id is used instead of _id"""
        data = super().model_dump(**kwargs)
        if '_id' in data:
            data['id'] = str(data.pop('_id'))
        return data
