"""JWT token utilities for authentication"""
from datetime import datetime, timedelta
from typing import Optional

from jose import JWTError, jwt

from app.config import settings


def create_access_token(player_id: str) -> str:
    """
    Create a JWT access token for a player

    Args:
        player_id: The player's ID to encode in the token

    Returns:
        JWT token string
    """
    expire = datetime.utcnow() + timedelta(days=settings.jwt_expiration_days)
    to_encode = {
        "sub": player_id,
        "exp": expire,
    }
    encoded_jwt = jwt.encode(to_encode, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)
    return encoded_jwt


def verify_token(token: str) -> Optional[str]:
    """
    Verify a JWT token and extract the player ID

    Args:
        token: JWT token string

    Returns:
        Player ID if token is valid, None otherwise
    """
    try:
        payload = jwt.decode(token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm])
        player_id: str = payload.get("sub")
        if player_id is None:
            return None
        return player_id
    except JWTError:
        return None
