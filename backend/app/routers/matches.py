from fastapi import APIRouter, HTTPException, status
from beanie import PydanticObjectId

from app.models.match import Match

router = APIRouter()


@router.get("/", response_model=list[Match])
async def get_all_matches(limit: int = 50, skip: int = 0):
    """Get all matches with pagination"""
    matches = await Match.find_all().skip(skip).limit(limit).sort(-Match.match_date).to_list()
    return matches


@router.get("/recent", response_model=list[Match])
async def get_recent_matches(limit: int = 10):
    """Get recent matches"""
    matches = await Match.find_all().limit(limit).sort(-Match.match_date).to_list()
    return matches


@router.get("/{match_id}", response_model=Match)
async def get_match(match_id: PydanticObjectId):
    """Get a specific match by ID"""
    match = await Match.get(match_id)
    if not match:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Match not found")
    return match


@router.post("/", response_model=Match, status_code=status.HTTP_201_CREATED)
async def create_match(match: Match):
    """Create a new match"""
    await match.insert()
    return match


@router.delete("/{match_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_match(match_id: PydanticObjectId):
    """Delete a match"""
    match = await Match.get(match_id)
    if not match:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Match not found")

    await match.delete()
