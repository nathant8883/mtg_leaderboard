from datetime import datetime
from typing import Optional, Any
from beanie import Document
from pydantic import Field, field_validator
import re
import base64


class Pod(Document):
    """Pod document - a group of players who track matches together"""
    name: str  # Pod name (e.g., "Friday Night Magic")
    description: Optional[str] = None  # Optional pod description
    creator_id: str  # Player ID who created the pod
    admin_ids: list[str] = Field(default_factory=list)  # Player IDs with admin access
    member_ids: list[str] = Field(default_factory=list)  # All player IDs in the pod
    custom_image: Optional[str] = None  # Base64-encoded custom pod image
    created_at: datetime = Field(default_factory=datetime.utcnow)

    @field_validator('custom_image')
    @classmethod
    def validate_custom_image(cls, v: str | None) -> str | None:
        """Validate custom_image is valid base64 or None"""
        if v is None or v == "":
            return None

        # Check if it's a data URI (data:image/png;base64,...)
        data_uri_pattern = r'^data:image/(jpeg|jpg|png|gif|webp);base64,(.+)$'
        match = re.match(data_uri_pattern, v)

        if match:
            base64_data = match.group(2)
        else:
            base64_data = v

        try:
            # Verify it's valid base64
            decoded = base64.b64decode(base64_data, validate=True)

            # Check decoded size (max ~2MB)
            if len(decoded) > 2 * 1024 * 1024:
                raise ValueError("Image size too large (max 2MB)")

            return v  # Return original value (with data URI)
        except Exception:
            raise ValueError("Invalid base64 image data")

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
    invitee_email: Optional[str] = None  # Email address of person being invited (optional if player_id provided)
    invitee_player_id: Optional[str] = None  # Player ID for inviting existing players (optional if email provided)
    status: str = "pending"  # "pending", "accepted", "declined"
    created_at: datetime = Field(default_factory=datetime.utcnow)
    responded_at: Optional[datetime] = None  # When invite was accepted/declined

    @field_validator('invitee_player_id')
    @classmethod
    def validate_invite_target(cls, v: str | None, info) -> str | None:
        """Ensure either invitee_email or invitee_player_id is provided"""
        invitee_email = info.data.get('invitee_email')

        # At least one must be provided
        if not v and not invitee_email:
            raise ValueError("Either invitee_email or invitee_player_id must be provided")

        return v

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
