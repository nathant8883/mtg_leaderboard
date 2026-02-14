from datetime import datetime, date
from typing import Optional, Any
from beanie import Document
from pydantic import BaseModel, Field, field_validator


class EventPlayer(BaseModel):
    """Snapshot of a player registered in the event"""
    player_id: str
    player_name: str
    avatar: Optional[str] = None


class PlayerDeckInfo(BaseModel):
    """Deck information for a player in a pod"""
    deck_name: str = ""
    commander_image_url: str = ""
    colors: list[str] = Field(default_factory=list)


class PodAssignment(BaseModel):
    """A single pod (table) within a tournament round"""
    pod_index: int  # 0-based pod number
    player_ids: list[str] = Field(default_factory=list)
    match_id: Optional[str] = None
    match_status: str = "pending"  # "pending" | "in_progress" | "completed"
    player_decks: dict[str, PlayerDeckInfo] = Field(default_factory=dict)


class RoundResult(BaseModel):
    """Per-player points earned in a single round"""
    player_id: str
    placement_points: int = 0
    kill_points: int = 0
    alt_win_points: int = 0
    scoop_penalty: int = 0
    total: int = 0


class Round(BaseModel):
    """A tournament round containing pods and results"""
    round_number: int  # 1-based
    pods: list[PodAssignment] = Field(default_factory=list)
    results: list[RoundResult] = Field(default_factory=list)
    status: str = "pending"  # "pending" | "in_progress" | "completed"


class StandingsEntry(BaseModel):
    """Running standings for a player across the tournament"""
    player_id: str
    player_name: str
    total_points: int = 0
    wins: int = 0
    kills: int = 0
    round_points: list[int] = Field(default_factory=list)


class Event(Document):
    """Tournament event document"""
    name: str
    event_type: str = "tournament"
    pod_id: str
    creator_id: str
    custom_image: Optional[str] = None  # Base64 logo (same pattern as Pod)

    # Tournament config
    player_count: int  # 4, 8, or 12
    round_count: int
    players: list[EventPlayer] = Field(default_factory=list)

    # Tournament state
    status: str = "setup"  # "setup" | "active" | "completed"
    current_round: int = 0
    rounds: list[Round] = Field(default_factory=list)
    standings: list[StandingsEntry] = Field(default_factory=list)

    # Metadata
    event_date: date = Field(default_factory=date.today)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    completed_at: Optional[datetime] = None

    @field_validator('player_count')
    @classmethod
    def validate_player_count(cls, v):
        if v not in (4, 8, 12):
            raise ValueError('Player count must be 4, 8, or 12')
        return v

    @field_validator('round_count')
    @classmethod
    def validate_round_count(cls, v):
        if v < 1 or v > 10:
            raise ValueError('Round count must be between 1 and 10')
        return v

    class Settings:
        name = "events"
        use_state_management = True
        use_revision = False

    def model_dump(self, **kwargs) -> dict[str, Any]:
        """Override to ensure id is used instead of _id"""
        data = super().model_dump(**kwargs)
        if '_id' in data:
            data['id'] = str(data.pop('_id'))
        return data
