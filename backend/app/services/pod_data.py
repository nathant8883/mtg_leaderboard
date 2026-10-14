"""Shared database fetches for pod-scoped stats endpoints."""

import logging
from typing import Optional

from beanie import PydanticObjectId
from fastapi import HTTPException, Query

from app.models.match import Match
from app.models.player import Deck, Player
from app.models.pod import Pod
from app.services.seasons import SeasonScope, parse_season_param, season_today

logger = logging.getLogger(__name__)

NON_GUEST_FILTER = {"$or": [{"is_guest": False}, {"is_guest": {"$exists": False}}]}
ENABLED_DECK_FILTER = {"$or": [{"disabled": False}, {"disabled": {"$exists": False}}]}


async def season_scope_dep(
    season: Optional[str] = Query(
        "current",
        description='"current" (default), "all", or a season number',
    ),
) -> SeasonScope:
    """FastAPI dependency: parse the `?season=` query param."""
    try:
        return parse_season_param(season, season_today())
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))


async def get_pod(pod_id: Optional[str]) -> Optional[Pod]:
    if not pod_id:
        return None
    try:
        return await Pod.get(PydanticObjectId(pod_id))
    except Exception as e:
        logger.warning(f"Error fetching pod {pod_id}: {e}")
        return None


async def get_pod_members(pod: Pod, include_guests: bool = False) -> list[Player]:
    id_filter = {"_id": {"$in": [PydanticObjectId(mid) for mid in pod.member_ids]}}
    query = id_filter if include_guests else {"$and": [id_filter, NON_GUEST_FILTER]}
    return await Player.find(query).to_list()


async def get_pod_decks(pod: Pod, include_disabled: bool) -> list[Deck]:
    owner_filter = {"player_id": {"$in": pod.member_ids}}
    query = owner_filter if include_disabled else {"$and": [owner_filter, ENABLED_DECK_FILTER]}
    return await Deck.find(query).to_list()


def season_match_filter(pod_id: str, scope: SeasonScope) -> dict:
    """Raw Mongo filter for a pod's matches within a season scope."""
    query: dict = {"pod_id": pod_id}
    bounds = scope.date_bounds()
    if bounds:
        query["match_date"] = {"$gte": bounds[0], "$lt": bounds[1]}
    return query


async def fetch_pod_matches(pod_id: str, scope: SeasonScope) -> list[Match]:
    """All matches for a pod, limited to the season when the scope is a season."""
    return await Match.find(season_match_filter(pod_id, scope)).to_list()
