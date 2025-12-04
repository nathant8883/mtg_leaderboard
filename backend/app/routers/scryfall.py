"""Scryfall API proxy endpoints."""
from fastapi import APIRouter, Query, HTTPException
from app.services.scryfall import scryfall_service

router = APIRouter()


@router.get("/commanders/search")
async def search_commanders(
    q: str = Query(..., min_length=2, description="Search query for commander names"),
    limit: int = Query(20, ge=1, le=50, description="Maximum number of results")
):
    """
    Search for legendary creatures that can be commanders.

    Args:
        q: Search query string (minimum 2 characters)
        limit: Maximum number of results to return (1-50)

    Returns:
        List of commander cards with names, images, and color identity
    """
    try:
        results = await scryfall_service.search_commanders(q, limit)
        return {"results": results}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error searching Scryfall: {str(e)}")


@router.get("/commanders/{name}/printings")
async def get_commander_printings(name: str):
    """
    Get all unique artwork versions/printings for a specific commander.

    Args:
        name: Exact card name

    Returns:
        List of card printings with unique artwork, including set info and images
    """
    try:
        results = await scryfall_service.get_commander_printings(name)
        if not results:
            raise HTTPException(status_code=404, detail="No printings found for commander")
        return {"printings": results}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching commander printings: {str(e)}")


@router.get("/commanders/{name}")
async def get_commander_details(name: str):
    """
    Get full details for a specific commander by exact name.

    Args:
        name: Exact card name

    Returns:
        Card details including images and color identity
    """
    try:
        result = await scryfall_service.get_commander_details(name)
        if not result:
            raise HTTPException(status_code=404, detail="Commander not found or is not a legendary creature")
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching commander details: {str(e)}")
