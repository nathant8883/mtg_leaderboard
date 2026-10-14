"""Season award models: end-of-season placements, persisted per pod."""

from datetime import datetime
from typing import Any, Literal, Optional

from beanie import Document
from pydantic import Field
from pymongo import IndexModel

AwardType = Literal["player_placement", "deck_placement", "peak_elo"]


class SeasonAward(Document):
    """
    One badge earned at the end of a season in a pod.

    Player/deck names and images are snapshotted so badges survive renames
    and deletions.
    """
    pod_id: str
    season: int
    award_type: AwardType
    placement: int  # 1-3 (peak_elo is always 1)

    player_id: str  # Recipient (deck owner for deck awards)
    player_name: str
    player_picture: Optional[str] = None
    player_custom_avatar: Optional[str] = None

    deck_id: Optional[str] = None
    deck_name: Optional[str] = None
    commander: Optional[str] = None
    commander_image_url: Optional[str] = None
    colors: list[str] = Field(default_factory=list)

    stats: dict[str, Any] = Field(default_factory=dict)
    awarded_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "season_awards"
        indexes = [
            IndexModel(
                [("pod_id", 1), ("season", 1), ("award_type", 1), ("placement", 1)],
                unique=True,
            ),
            [("player_id", 1)],
            [("deck_id", 1)],
        ]

    def model_dump(self, **kwargs) -> dict[str, Any]:
        """Override to ensure id is used instead of _id"""
        data = super().model_dump(**kwargs)
        if '_id' in data:
            data['id'] = str(data.pop('_id'))
        return data


class SeasonFinalization(Document):
    """
    Marks a pod's season as finalized (awards computed).

    Also acts as a lock for concurrent finalization (unique on pod+season) and
    records seasons that ended with no eligible players. `stale` is set when a
    match in the finished season is created, edited or deleted, so the next
    read recomputes its awards.
    """
    pod_id: str
    season: int
    finalized_at: datetime = Field(default_factory=datetime.utcnow)
    match_count: int = 0
    stale: bool = False

    class Settings:
        name = "season_finalizations"
        indexes = [
            IndexModel([("pod_id", 1), ("season", 1)], unique=True),
        ]
