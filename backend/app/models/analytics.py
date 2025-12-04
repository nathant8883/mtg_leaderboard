"""Analytics models for Elo ratings and statistics tracking."""

from datetime import datetime
from typing import Optional
from beanie import Document
from pydantic import Field


class PlayerEloRating(Document):
    """
    Stores current Elo rating for a player within a specific pod.
    Elo ratings are pod-scoped to allow different skill levels across playgroups.
    """
    player_id: str
    pod_id: str
    current_elo: float = 1000.0
    peak_elo: float = 1000.0
    lowest_elo: float = 1000.0
    games_rated: int = 0
    last_elo_change: float = 0.0
    last_updated: datetime = Field(default_factory=datetime.utcnow)
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "player_elo_ratings"
        indexes = [
            [("player_id", 1), ("pod_id", 1)],
            [("pod_id", 1), ("current_elo", -1)],
        ]


class EloHistoryEntry(Document):
    """
    Tracks Elo changes over time for historical analysis and Rising Star calculation.
    Each entry represents one player's Elo change from a single match.
    """
    player_id: str
    pod_id: str
    match_id: str
    elo_before: float
    elo_after: float
    elo_change: float
    timestamp: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "elo_history"
        indexes = [
            [("player_id", 1), ("pod_id", 1), ("timestamp", -1)],
            [("pod_id", 1), ("timestamp", -1)],
            [("match_id", 1)],
        ]
