"""Per-player end-of-season recap (the popup shown once after a season ends)."""

from collections import Counter
from typing import Optional

from beanie import PydanticObjectId

from app.models.match import Match
from app.models.player import Deck, Player
from app.models.season import SeasonAward
from app.services.pod_data import fetch_pod_matches, get_pod, season_match_filter
from app.services.season_awards import compute_season_standings, ensure_pod_seasons_finalized
from app.services.season_stats import MIN_GAMES_FOR_RANKING
from app.services.seasons import SeasonScope, get_season, list_seasons, season_to_dict, season_today


def recap_key(pod_id: str, season_number: int) -> str:
    return f"{pod_id}:{season_number}"


async def build_season_recap(pod_id: str, season_number: int, player_id: str) -> dict:
    """How a player finished a completed season in a pod: placement, record, Elo, best deck, badges."""
    season = get_season(season_number)
    matches = await fetch_pod_matches(pod_id, SeasonScope(kind="season", season=season))
    player_standings, _, elo_states, _ = await compute_season_standings(pod_id, season_number, matches)

    ranked = [e for e in player_standings if e["ranked"]]
    entry = next((e for e in player_standings if e["player_id"] == player_id), None)
    rank = next((i + 1 for i, e in enumerate(ranked) if e["player_id"] == player_id), None)
    state = elo_states.get(player_id)

    # Best deck the player piloted (incl. borrowed): most wins, then most games
    deck_games: Counter = Counter()
    deck_wins: Counter = Counter()
    deck_names: dict[str, str] = {}
    for m in matches:
        for mp in m.players:
            if mp.player_id != player_id:
                continue
            deck_games[mp.deck_id] += 1
            deck_names[mp.deck_id] = mp.deck_name
            if m.winner_player_id == player_id and m.winner_deck_id == mp.deck_id:
                deck_wins[mp.deck_id] += 1
    top_deck = None
    if deck_games:
        deck_id = max(deck_games, key=lambda d: (deck_wins[d], deck_games[d]))
        deck = await Deck.get(PydanticObjectId(deck_id)) if PydanticObjectId.is_valid(deck_id) else None
        top_deck = {
            "deck_id": deck_id,
            "deck_name": deck.name if deck else deck_names[deck_id],
            "commander": deck.commander if deck else None,
            "commander_image_url": deck.commander_image_url if deck else None,
            "colors": deck.colors if deck else [],
            "games_played": deck_games[deck_id],
            "wins": deck_wins[deck_id],
        }

    awards = await SeasonAward.find(
        SeasonAward.pod_id == pod_id,
        SeasonAward.season == season_number,
        SeasonAward.player_id == player_id,
    ).to_list()
    champion = await SeasonAward.find_one(
        SeasonAward.pod_id == pod_id,
        SeasonAward.season == season_number,
        SeasonAward.award_type == "player_placement",
        SeasonAward.placement == 1,
    )
    pod = await get_pod(pod_id)
    games_played = entry["games_played"] if entry else 0

    return {
        "season": season_to_dict(season, season_today()),
        "pod_id": pod_id,
        "pod_name": pod.name if pod else None,
        "games_played": games_played,
        "wins": entry["wins"] if entry else 0,
        "losses": entry["losses"] if entry else 0,
        "win_rate": entry["win_rate"] if entry else 0,
        "rank": rank,
        "ranked_count": len(ranked),
        "games_needed": max(0, MIN_GAMES_FOR_RANKING - games_played),
        "elo": round(state.elo) if state and state.games_rated else None,
        "peak_elo": round(state.peak) if state and state.games_rated else None,
        "top_deck": top_deck,
        "awards": [a.model_dump(mode="json") for a in sorted(awards, key=lambda a: (a.award_type, a.placement))],
        "champion": {
            "player_id": champion.player_id,
            "player_name": champion.player_name,
            "picture": champion.player_picture,
            "custom_avatar": champion.player_custom_avatar,
            "elo": champion.stats.get("elo"),
        } if champion else None,
        "total_games": len(matches),
    }


async def pending_recap(player: Player) -> Optional[dict]:
    """
    The recap to pop up for this player: the most recent finished season in
    their current pod that they played in, unless they've already seen it.
    Older unseen seasons are skipped so nobody gets a stack of popups.
    """
    pod_id = player.current_pod_id
    if not pod_id or player.is_guest:
        return None
    await ensure_pod_seasons_finalized(pod_id)

    today = season_today()
    player_id = str(player.id)
    for season in list_seasons(today):
        if season.end_exclusive > today:
            continue  # Still in progress
        played = await Match.find({
            **season_match_filter(pod_id, SeasonScope(kind="season", season=season)),
            "players.player_id": player_id,
        }).count()
        if not played:
            continue
        if recap_key(pod_id, season.number) in player.seen_season_recaps:
            return None
        return await build_season_recap(pod_id, season.number, player_id)
    return None
