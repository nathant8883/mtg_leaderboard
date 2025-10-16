"""Authentication router with Google OAuth"""
from fastapi import APIRouter, HTTPException, status, Depends
from fastapi.responses import RedirectResponse
from authlib.integrations.starlette_client import OAuth
from starlette.requests import Request

from app.config import settings
from app.models.player import Player
from app.utils.jwt import create_access_token
from app.middleware.auth import get_current_player

router = APIRouter()

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
            player = Player(
                name=name or email.split('@')[0],
                email=email,
                google_id=google_id,
                picture=picture,
                avatar=name[0].upper() if name else email[0].upper()
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
        "deck_ids": current_player.deck_ids,
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
