from datetime import datetime
from typing import Optional, Any
from beanie import Document
from pydantic import Field


class Pod(Document):
    """Pod document - a group of players who track matches together"""
    name: str  # Pod name (e.g., "Friday Night Magic")
    description: Optional[str] = None  # Optional pod description
    creator_id: str  # Player ID who created the pod
    admin_ids: list[str] = Field(default_factory=list)  # Player IDs with admin access
    member_ids: list[str] = Field(default_factory=list)  # All player IDs in the pod
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "pods"
        use_state_management = True
        use_revision = False

    def model_dump(self, **kwargs) -> dict[str, Any]:
        """Override to ensure id is used instead of _id"""
        data = super().model_dump(**kwargs)
        if '_id' in data:
            data['id'] = str(data.pop('_id'))
        return data


class PodInvite(Document):
    """Pod invitation document - tracks invitations to join a pod"""
    pod_id: str  # Pod being invited to
    inviter_id: str  # Admin who sent the invite
    invitee_email: str  # Email address of person being invited
    invitee_player_id: Optional[str] = None  # Set when we match email to existing player
    status: str = "pending"  # "pending", "accepted", "declined"
    created_at: datetime = Field(default_factory=datetime.utcnow)
    responded_at: Optional[datetime] = None  # When invite was accepted/declined

    class Settings:
        name = "pod_invites"
        use_state_management = True
        use_revision = False

    def model_dump(self, **kwargs) -> dict[str, Any]:
        """Override to ensure id is used instead of _id"""
        data = super().model_dump(**kwargs)
        if '_id' in data:
            data['id'] = str(data.pop('_id'))
        return data
