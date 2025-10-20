"""Authentication router with Google OAuth"""
from fastapi import APIRouter, HTTPException, status, Depends
from fastapi.responses import RedirectResponse
from authlib.integrations.starlette_client import OAuth
from starlette.requests import Request
from pydantic import BaseModel, Field, field_validator
import base64
import re

from app.config import settings
from app.models.player import Player
from app.utils.jwt import create_access_token
from app.middleware.auth import get_current_player

router = APIRouter()

# Hardcoded superuser emails
SUPERUSER_EMAILS = ["nathant8883@yahoo.com"]


class PlayerProfileUpdate(BaseModel):
    """Schema for updating player profile (name and custom avatar)"""
    name: str = Field(..., min_length=3, max_length=50)
    custom_avatar: str | None = None

    @field_validator('name')
    @classmethod
    def validate_name(cls, v: str) -> str:
        """Validate name is not empty after stripping whitespace"""
        if not v or not v.strip():
            raise ValueError("Name cannot be empty")
        return v.strip()

    @field_validator('custom_avatar')
    @classmethod
    def validate_custom_avatar(cls, v: str | None) -> str | None:
        """Validate custom_avatar is valid base64 or None"""
        if v is None or v == "":
            return None

        # Check if it's a data URI (data:image/png;base64,...)
        data_uri_pattern = r'^data:image/(jpeg|jpg|png|gif|webp);base64,(.+)$'
        match = re.match(data_uri_pattern, v)

        if match:
            # Extract the base64 part
            base64_data = match.group(2)
        else:
            # Assume it's raw base64
            base64_data = v

        try:
            # Try to decode to verify it's valid base64
            decoded = base64.b64decode(base64_data, validate=True)

            # Check decoded size (max ~2MB)
            if len(decoded) > 2 * 1024 * 1024:
                raise ValueError("Image size too large (max 2MB)")

            return v  # Return original value (with data URI if present)
        except Exception:
            raise ValueError("Invalid base64 image data")


# Initialize OAuth client
oauth = OAuth()
oauth.register(
    name='google',
    client_id=settings.google_client_id,
    client_secret=settings.google_client_secret,
    server_metadata_url='https://accounts.google.com/.well-known/openid-configuration',
    client_kwargs={'scope': 'openid email profile'}
)


@router.get("/google/login")
async def google_login(request: Request):
    """Initiate Google OAuth flow"""
    redirect_uri = settings.google_redirect_uri
    return await oauth.google.authorize_redirect(request, redirect_uri)


@router.get("/google/callback")
async def google_callback(request: Request):
    """Handle Google OAuth callback"""
    try:
        # Get the OAuth token from Google
        token = await oauth.google.authorize_access_token(request)

        # Get user info from Google
        user_info = token.get('userinfo')
        if not user_info:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to get user info from Google"
            )

        google_id = user_info.get('sub')
        email = user_info.get('email')
        name = user_info.get('name')
        picture = user_info.get('picture')

        if not google_id or not email:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Missing required user information"
            )

        # Find existing player by google_id
        player = await Player.find_one(Player.google_id == google_id)

        if not player:
            # Find by email as fallback (in case player exists but not linked)
            player = await Player.find_one(Player.email == email)

        if not player:
            # Create new player
            is_superuser = email in SUPERUSER_EMAILS
            player = Player(
                name=name or email.split('@')[0],
                email=email,
                google_id=google_id,
                picture=picture,
                avatar=name[0].upper() if name else email[0].upper(),
                is_superuser=is_superuser
            )
            await player.insert()
        else:
            # Update existing player with Google info if not already set
            update_data = {}
            if not player.google_id:
                update_data[Player.google_id] = google_id
            if not player.email:
                update_data[Player.email] = email
            if not player.picture:
                update_data[Player.picture] = picture

            # Always ensure superuser status is correct for hardcoded emails
            if email in SUPERUSER_EMAILS and not player.is_superuser:
                update_data[Player.is_superuser] = True

            if update_data:
                await player.set(update_data)

        # Create JWT token
        access_token = create_access_token(str(player.id))

        # Redirect to frontend login page with token
        redirect_url = f"{settings.frontend_url}/login?token={access_token}"
        return RedirectResponse(url=redirect_url)

    except Exception as e:
        import traceback
        print(f"OAuth error: {e}")
        print(f"Full traceback: {traceback.format_exc()}")
        # Redirect to frontend with error
        return RedirectResponse(url=f"{settings.frontend_url}/login?error=auth_failed")


@router.get("/me")
async def get_me(current_player: Player = Depends(get_current_player)):
    """Get current authenticated player"""
    return {
        "id": str(current_player.id),
        "name": current_player.name,
        "email": current_player.email,
        "avatar": current_player.avatar,
        "picture": current_player.picture,
        "custom_avatar": current_player.custom_avatar,
        "deck_ids": current_player.deck_ids,
        "is_superuser": current_player.is_superuser,
        "created_at": current_player.created_at
    }


@router.put("/profile")
async def update_profile(
    profile_update: PlayerProfileUpdate,
    current_player: Player = Depends(get_current_player)
):
    """Update current player's profile (name and/or custom avatar)"""
    update_data = {}

    # Update name if provided
    if profile_update.name:
        update_data[Player.name] = profile_update.name

    # Update or remove custom_avatar
    if profile_update.custom_avatar is not None:
        if profile_update.custom_avatar == "":
            # Empty string means remove custom avatar
            update_data[Player.custom_avatar] = None
        else:
            update_data[Player.custom_avatar] = profile_update.custom_avatar

    # Apply updates if any
    if update_data:
        await current_player.set(update_data)

    # Return updated player data
    return {
        "id": str(current_player.id),
        "name": current_player.name,
        "email": current_player.email,
        "avatar": current_player.avatar,
        "picture": current_player.picture,
        "custom_avatar": current_player.custom_avatar,
        "deck_ids": current_player.deck_ids,
        "is_superuser": current_player.is_superuser,
        "created_at": current_player.created_at
    }


@router.post("/logout")
async def logout():
    """Logout endpoint (JWT is stateless, so this is mostly for symmetry)"""
    return {"message": "Logged out successfully"}


@router.post("/dev/login")
async def dev_login():
    """Development-only login endpoint that creates/returns a test user

    WARNING: This endpoint should only be enabled in development!
    """
    if settings.environment != "development":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This endpoint is only available in development mode"
        )

    # Find or create a test user
    test_email = "dev@test.local"
    player = await Player.find_one(Player.email == test_email)

    if not player:
        # Create test player
        player = Player(
            name="Dev User",
            email=test_email,
            avatar="D",
            picture="https://api.dicebear.com/7.x/avataaars/svg?seed=Dev"
        )
        await player.insert()

    # Create JWT token
    access_token = create_access_token(str(player.id))

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "player": {
            "id": str(player.id),
            "name": player.name,
            "email": player.email,
            "avatar": player.avatar,
            "picture": player.picture
        }
    }
