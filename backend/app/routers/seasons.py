"""Season endpoints: season list, awards (badges), hall of fame and standings."""

from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, HTTPException, Query

from app.middleware.auth import get_current_player, get_optional_player
from app.models.player import Player
from app.models.pod import Pod
from app.models.season import SeasonAward, SeasonFinalization
from app.routers.leaderboard import build_deck_leaderboard, build_player_leaderboard, load_pod_stats_data
from app.services.pod_data import get_pod
from app.services.season_awards import ensure_pod_seasons_finalized, finalize_season
from app.services.seasons import (
    SeasonScope,
    get_season,
    list_seasons,
    season_number_for_date,
    season_to_dict,
    season_today,
)

router = APIRouter()


def _award_out(award: SeasonAward, pod_names: Optional[dict[str, str]] = None) -> Dict[str, Any]:
    data = award.model_dump(mode="json")
    if pod_names is not None:
        data["pod_name"] = pod_names.get(award.pod_id)
    return data


def _check_season(season_number: int) -> None:
    current_n = season_number_for_date(season_today()) or 0
    if season_number < 1 or season_number > current_n:
        raise HTTPException(status_code=404, detail=f"Season {season_number} not found")


@router.get("/")
async def list_all_seasons(
    current_player: Optional[Player] = Depends(get_optional_player),
) -> Dict[str, Any]:
    """Seasons that have started, newest first, plus the current one."""
    today = season_today()
    pod_id = current_player.current_pod_id if current_player else None

    finalized: set[int] = set()
    if pod_id:
        await ensure_pod_seasons_finalized(pod_id)
        markers = await SeasonFinalization.find(SeasonFinalization.pod_id == pod_id).to_list()
        finalized = {m.season for m in markers if not m.stale}

    seasons = [
        season_to_dict(s, today, finalized=s.number in finalized)
        for s in list_seasons(today)
    ]
    current = next((s for s in seasons if s["is_current"]), None)
    return {"current": current, "seasons": seasons, "today": today.isoformat()}


@router.get("/awards/")
async def get_awards(
    player_id: Optional[str] = Query(None),
    deck_id: Optional[str] = Query(None),
    pod_id: Optional[str] = Query(None),
) -> list[Dict[str, Any]]:
    """
    Season awards filtered by recipient, deck and/or pod. With only player_id,
    returns that player's awards from every pod (shown on their profile).
    """
    if not (player_id or deck_id or pod_id):
        raise HTTPException(status_code=400, detail="Provide player_id, deck_id or pod_id")

    query: dict = {}
    if player_id:
        query["player_id"] = player_id
    if deck_id:
        query["deck_id"] = deck_id
    if pod_id:
        query["pod_id"] = pod_id

    awards = await SeasonAward.find(query).sort(-SeasonAward.season, +SeasonAward.placement).to_list()

    pod_names: dict[str, str] = {}
    for pid in {a.pod_id for a in awards}:
        pod = await get_pod(pid)
        if pod:
            pod_names[pid] = pod.name
    return [_award_out(a, pod_names) for a in awards]


@router.get("/hall-of-fame/")
async def get_hall_of_fame(
    current_player: Optional[Player] = Depends(get_optional_player),
) -> list[Dict[str, Any]]:
    """Every completed season for the current pod with its awards, newest first."""
    if not current_player or not current_player.current_pod_id:
        return []
    pod_id = current_player.current_pod_id
    await ensure_pod_seasons_finalized(pod_id)

    today = season_today()
    awards = await SeasonAward.find(SeasonAward.pod_id == pod_id).to_list()
    by_season: dict[int, list[SeasonAward]] = {}
    for a in awards:
        by_season.setdefault(a.season, []).append(a)

    result = []
    for season in list_seasons(today):
        if season.end_exclusive > today:
            continue  # Current season has no awards yet
        season_awards = sorted(by_season.get(season.number, []), key=lambda a: (a.award_type, a.placement))
        result.append({
            "season": season_to_dict(season, today),
            "awards": [_award_out(a) for a in season_awards],
        })
    return result


@router.get("/{season_number}/standings/")
async def get_season_standings(
    season_number: int,
    limit: int = Query(3, ge=1, le=50),
    current_player: Optional[Player] = Depends(get_optional_player),
) -> Dict[str, Any]:
    """Live top players and decks for a season in the current pod."""
    _check_season(season_number)
    season = get_season(season_number)
    data = await load_pod_stats_data(current_player, SeasonScope(kind="season", season=season))
    players = [p for p in await build_player_leaderboard(data) if p["ranked"]]
    decks = [d for d in await build_deck_leaderboard(data) if d["ranked"]]
    return {
        "season": season_to_dict(season, season_today()),
        "total_games": len(data.matches),
        "players": players[:limit],
        "decks": decks[:limit],
    }


@router.post("/{season_number}/finalize/")
async def refinalize_season(
    season_number: int,
    pod_id: Optional[str] = Query(None, description="Defaults to the caller's current pod; 'all' for every pod"),
    current_player: Player = Depends(get_current_player),
) -> Dict[str, Any]:
    """Recompute a completed season's awards (superuser only)."""
    if not current_player.is_superuser:
        raise HTTPException(status_code=403, detail="Superuser access required")
    _check_season(season_number)

    if pod_id == "all":
        pod_ids = [str(p.id) for p in await Pod.find_all().to_list()]
    else:
        target = pod_id or current_player.current_pod_id
        if not target:
            raise HTTPException(status_code=400, detail="No pod specified")
        pod_ids = [target]

    results = {}
    for pid in pod_ids:
        try:
            awards = await finalize_season(pid, season_number, force=True)
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))
        results[pid] = len(awards)
    return {"season": season_number, "awards_by_pod": results}
