"""
Season award finalization.

There is no scheduler, so awards are finalized lazily: reads that care about
seasons (season list, dashboard stats) call ensure_pod_seasons_finalized(),
which computes awards for any completed season that hasn't been finalized
yet, or whose marker was flagged stale by a late match edit.
"""

import logging
from datetime import date, datetime
from typing import Iterable, Optional

from beanie import PydanticObjectId
from pymongo.errors import DuplicateKeyError

from app.models.match import Match
from app.models.player import Deck, Player
from app.models.season import SeasonAward, SeasonFinalization
from app.services.pod_data import ENABLED_DECK_FILTER, NON_GUEST_FILTER, fetch_pod_matches
from app.services.season_stats import (
    build_season_awards,
    compute_deck_standings,
    compute_player_standings,
    elo_lookup_from_states,
    replay_elo,
)
from app.services.seasons import (
    SeasonScope,
    get_season,
    list_seasons,
    season_number_for_date,
    season_today,
)

logger = logging.getLogger(__name__)


def owner_info(player: Player) -> dict:
    return {"name": player.name, "picture": player.picture, "custom_avatar": player.custom_avatar}


async def compute_season_standings(pod_id: str, season_number: int, matches: Optional[list[Match]] = None):
    """
    Standings used for awards: everyone (non-guest) who played in the pod that
    season, including players who have since left the pod.
    Returns (player_standings, deck_standings, elo_states, match_count).
    """
    scope = SeasonScope(kind="season", season=get_season(season_number))
    if matches is None:
        matches = await fetch_pod_matches(pod_id, scope)

    elo_states = replay_elo(matches)

    player_ids = {mp.player_id for m in matches for mp in m.players}
    deck_ids = {mp.deck_id for m in matches for mp in m.players}

    decks = await Deck.find({
        "$and": [
            {"_id": {"$in": [PydanticObjectId(d) for d in deck_ids if PydanticObjectId.is_valid(d)]}},
            ENABLED_DECK_FILTER,
        ]
    }).to_list()

    people_ids = player_ids | {d.player_id for d in decks}
    players = await Player.find({
        "$and": [
            {"_id": {"$in": [PydanticObjectId(p) for p in people_ids if PydanticObjectId.is_valid(p)]}},
            NON_GUEST_FILTER,
        ]
    }).to_list()
    owners = {str(p.id): owner_info(p) for p in players}

    player_standings = compute_player_standings(
        [p for p in players if str(p.id) in player_ids],
        matches,
        elo_lookup_from_states(elo_states),
    )
    # Guest-owned decks aren't award eligible
    deck_standings = compute_deck_standings(
        [d for d in decks if d.player_id in owners],
        matches,
        owners,
    )
    return player_standings, deck_standings, elo_states, len(matches)


async def _write_awards(pod_id: str, season_number: int) -> list[SeasonAward]:
    player_standings, deck_standings, elo_states, match_count = await compute_season_standings(
        pod_id, season_number
    )
    drafts = build_season_awards(player_standings, deck_standings, elo_states)
    now = datetime.utcnow()
    awards = [SeasonAward(pod_id=pod_id, season=season_number, awarded_at=now, **d) for d in drafts]

    await SeasonAward.find(SeasonAward.pod_id == pod_id, SeasonAward.season == season_number).delete()
    if awards:
        await SeasonAward.insert_many(awards)

    await SeasonFinalization.get_pymongo_collection().update_one(
        {"pod_id": pod_id, "season": season_number},
        {"$set": {"finalized_at": now, "match_count": match_count}},
        upsert=True,
    )
    logger.info(f"Finalized season {season_number} for pod {pod_id}: {len(awards)} awards")
    return awards


def _is_complete(season_number: int, today: date) -> bool:
    return get_season(season_number).end_exclusive <= today


async def finalize_season(pod_id: str, season_number: int, force: bool = False) -> list[SeasonAward]:
    """
    Compute and store awards for a completed season. With force=False this is
    a no-op returning existing awards if the season is already finalized and
    not stale.
    """
    if not _is_complete(season_number, season_today()):
        raise ValueError(f"Season {season_number} has not ended yet")

    marker = await SeasonFinalization.find_one(
        SeasonFinalization.pod_id == pod_id, SeasonFinalization.season == season_number
    )
    if marker and not marker.stale and not force:
        return await SeasonAward.find(
            SeasonAward.pod_id == pod_id, SeasonAward.season == season_number
        ).to_list()

    if marker:
        await SeasonFinalization.get_pymongo_collection().update_one(
            {"_id": marker.id}, {"$set": {"stale": False}}
        )
    return await _write_awards(pod_id, season_number)


async def ensure_pod_seasons_finalized(pod_id: Optional[str]) -> None:
    """Finalize every completed season for the pod that is missing or stale. Safe to call often."""
    if not pod_id:
        return
    today = season_today()
    completed = [s.number for s in list_seasons(today) if s.end_exclusive <= today]
    if not completed:
        return

    markers = {
        m.season: m
        for m in await SeasonFinalization.find(SeasonFinalization.pod_id == pod_id).to_list()
    }
    collection = SeasonFinalization.get_pymongo_collection()

    for n in completed:
        marker = markers.get(n)
        try:
            if marker is None:
                # Claim the season: the unique (pod_id, season) index means only one
                # concurrent request gets to insert the marker and compute awards.
                try:
                    await collection.insert_one({
                        "pod_id": pod_id,
                        "season": n,
                        "finalized_at": datetime.utcnow(),
                        "match_count": 0,
                        "stale": False,
                    })
                except DuplicateKeyError:
                    continue
            elif marker.stale:
                # Atomically clear the flag; whoever flips it recomputes
                result = await collection.update_one(
                    {"_id": marker.id, "stale": True}, {"$set": {"stale": False}}
                )
                if result.modified_count == 0:
                    continue
            else:
                continue

            await _write_awards(pod_id, n)
        except Exception:
            logger.exception(f"Failed to finalize season {n} for pod {pod_id}")
            # Leave it stale so a later read retries instead of keeping a half-finished marker
            await collection.update_one({"pod_id": pod_id, "season": n}, {"$set": {"stale": True}})


async def mark_season_stale(pod_id: Optional[str], dates: Iterable[Optional[date]]) -> None:
    """Flag finalized seasons containing any of these match dates for recomputation."""
    if not pod_id:
        return
    today = season_today()
    seasons = {
        n for d in dates
        if d is not None and (n := season_number_for_date(d)) and _is_complete(n, today)
    }
    if not seasons:
        return
    await SeasonFinalization.get_pymongo_collection().update_many(
        {"pod_id": pod_id, "season": {"$in": sorted(seasons)}},
        {"$set": {"stale": True}},
    )


async def badges_by_player(pod_id: str, player_ids: list[str]) -> dict[str, list[dict]]:
    """Compact season badge refs per player for the pod (player and peak awards)."""
    awards = await SeasonAward.find({
        "pod_id": pod_id,
        "player_id": {"$in": player_ids},
        "award_type": {"$in": ["player_placement", "peak_elo"]},
    }).to_list()
    result: dict[str, list[dict]] = {}
    for a in sorted(awards, key=lambda a: (-a.season, a.award_type, a.placement)):
        result.setdefault(a.player_id, []).append(
            {"season": a.season, "award_type": a.award_type, "placement": a.placement}
        )
    return result


async def badges_by_deck(deck_ids: list[str]) -> dict[str, list[dict]]:
    """Compact season badge refs per deck."""
    awards = await SeasonAward.find({
        "deck_id": {"$in": deck_ids},
        "award_type": "deck_placement",
    }).to_list()
    result: dict[str, list[dict]] = {}
    for a in sorted(awards, key=lambda a: (-a.season, a.placement)):
        result.setdefault(a.deck_id, []).append(
            {"season": a.season, "award_type": a.award_type, "placement": a.placement}
        )
    return result
