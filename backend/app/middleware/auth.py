"""Authentication middleware and dependencies"""
from typing import Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from app.models.player import Player
from app.utils.jwt import verify_token

security = HTTPBearer(auto_error=False)


async def get_current_player(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)
) -> Player:
    """
    Get the currently authenticated player from JWT token

    Raises:
        HTTPException: If token is invalid or player not found
    """
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = credentials.credentials
    player_id = verify_token(token)

    if player_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )

    player = await Player.get(player_id)
    if player is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Player not found",
        )

    return player


async def get_optional_player(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)
) -> Optional[Player]:
    """
    Get the currently authenticated player, but don't require authentication

    Returns:
        Player object if authenticated, None if not
    """
    if credentials is None:
        return None

    token = credentials.credentials
    player_id = verify_token(token)

    if player_id is None:
        return None

    player = await Player.get(player_id)
    return player
