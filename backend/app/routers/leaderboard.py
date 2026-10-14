from fastapi import APIRouter, Depends
from beanie import PydanticObjectId
from typing import Dict, Any, Optional
from collections import Counter
from dataclasses import dataclass, field
import logging

from app.models.match import Match
from app.models.player import Player, Deck
from app.models.pod import Pod
from app.models.analytics import PlayerEloRating
from app.middleware.auth import get_optional_player
from app.utils.color_identity import get_color_identity_name
from app.services.elo_service import get_rising_star
from app.services.pod_data import (
    fetch_pod_matches,
    get_pod,
    get_pod_decks,
    get_pod_members,
    season_scope_dep,
)
from app.services.season_awards import badges_by_deck, badges_by_player, ensure_pod_seasons_finalized
from app.services.season_stats import (
    EloState,
    compute_deck_standings,
    compute_player_standings,
    elo_lookup_from_states,
    gini_balance,
    replay_elo,
    rising_star_from_history,
)
from app.services.seasons import SeasonScope, season_to_dict, season_today

router = APIRouter()
logger = logging.getLogger(__name__)


@dataclass
class PodStatsData:
    """Everything the leaderboard endpoints need for one pod + season scope."""
    scope: SeasonScope
    pod: Optional[Pod] = None
    players: list[Player] = field(default_factory=list)  # Non-guest pod members
    decks: list[Deck] = field(default_factory=list)  # Pod members' decks (incl. disabled)
    matches: list[Match] = field(default_factory=list)
    season_elo: dict[str, EloState] = field(default_factory=dict)  # Season mode only

    @property
    def pod_id(self) -> Optional[str]:
        return str(self.pod.id) if self.pod else None

    @property
    def enabled_decks(self) -> list[Deck]:
        return [d for d in self.decks if not d.disabled]

    def owner_lookup(self) -> dict[str, dict]:
        return {
            str(p.id): {"name": p.name, "picture": p.picture, "custom_avatar": p.custom_avatar}
            for p in self.players
        }


async def load_pod_stats_data(current_player: Optional[Player], scope: SeasonScope) -> PodStatsData:
    data = PodStatsData(scope=scope)
    if not current_player or not current_player.current_pod_id:
        return data

    pod = await get_pod(current_player.current_pod_id)
    if not pod:
        logger.warning(f"Pod {current_player.current_pod_id} not found for player {current_player.id}")
        return data

    data.pod = pod
    data.players = await get_pod_members(pod)
    data.decks = await get_pod_decks(pod, include_disabled=True)
    data.matches = await fetch_pod_matches(str(pod.id), scope)
    if not scope.is_all:
        data.season_elo = replay_elo(data.matches)
    return data


async def build_player_leaderboard(data: PodStatsData) -> list[Dict[str, Any]]:
    if not data.pod:
        return []

    if data.scope.is_all:
        ratings = await PlayerEloRating.find(PlayerEloRating.pod_id == data.pod_id).to_list()
        elo_lookup = {r.player_id: (r.current_elo, r.last_elo_change) for r in ratings}
    else:
        elo_lookup = elo_lookup_from_states(data.season_elo)

    leaderboard = compute_player_standings(data.players, data.matches, elo_lookup)

    badges = await badges_by_player(data.pod_id, [e["player_id"] for e in leaderboard])
    for entry in leaderboard:
        entry["season_badges"] = badges.get(entry["player_id"], [])
    return leaderboard


async def build_deck_leaderboard(data: PodStatsData) -> list[Dict[str, Any]]:
    if not data.pod:
        return []

    # Finished seasons include since-retired decks, matching the season awards
    season = data.scope.season
    decks = data.decks if season and season.end_exclusive <= season_today() else data.enabled_decks
    leaderboard = compute_deck_standings(decks, data.matches, data.owner_lookup())

    badges = await badges_by_deck([e["deck_id"] for e in leaderboard])
    for entry in leaderboard:
        entry["season_badges"] = badges.get(entry["deck_id"], [])
    return leaderboard


@router.get("/players")
async def get_player_leaderboard(
    current_player: Optional[Player] = Depends(get_optional_player),
    scope: SeasonScope = Depends(season_scope_dep),
) -> list[Dict[str, Any]]:
    """Get leaderboard by player from current pod. Returns empty list if no pod context."""
    data = await load_pod_stats_data(current_player, scope)
    return await build_player_leaderboard(data)


@router.get("/decks")
async def get_deck_leaderboard(
    current_player: Optional[Player] = Depends(get_optional_player),
    scope: SeasonScope = Depends(season_scope_dep),
) -> list[Dict[str, Any]]:
    """Get leaderboard by deck from current pod. Returns empty list if no pod context."""
    data = await load_pod_stats_data(current_player, scope)
    return await build_deck_leaderboard(data)


async def _player_card(player_id: str) -> Optional[Player]:
    try:
        return await Player.get(PydanticObjectId(player_id))
    except Exception:
        return None


@router.get("/stats")
async def get_dashboard_stats(
    current_player: Optional[Player] = Depends(get_optional_player),
    scope: SeasonScope = Depends(season_scope_dep),
) -> Dict[str, Any]:
    """Get dashboard statistics from current pod. Returns zeroed stats if no pod context."""
    if current_player and current_player.current_pod_id:
        await ensure_pod_seasons_finalized(current_player.current_pod_id)

    data = await load_pod_stats_data(current_player, scope)
    players = data.players
    matches = data.matches
    enabled_decks = data.enabled_decks

    if not scope.is_all:
        # Season view: only count people and decks that actually played this season
        active_player_ids = {mp.player_id for m in matches for mp in m.players}
        active_deck_ids = {mp.deck_id for m in matches for mp in m.players}
        players = [p for p in players if str(p.id) in active_player_ids]
        enabled_decks = [d for d in enabled_decks if str(d.id) in active_deck_ids]

    total_games = len(matches)
    total_players = len(players)  # Excludes guests
    total_decks = len(enabled_decks)  # Only count enabled decks

    # Calculate average pod size
    avg_pod_size = 0
    if total_games > 0:
        total_players_in_games = sum(len(match.players) for match in matches)
        avg_pod_size = round(total_players_in_games / total_games, 1)

    # Get current leader
    player_leaderboard = await build_player_leaderboard(data)
    current_leader = player_leaderboard[0] if player_leaderboard else None

    # Get last game date
    last_game_date = None
    if matches:
        last_game_date = max(match.match_date for match in matches)

    # Most games played (player)
    most_games_player = None
    if players and matches:
        player_game_counts = []
        for player in players:
            player_id = str(player.id)
            games_played = sum(1 for match in matches if any(p.player_id == player_id for p in match.players))
            if games_played > 0:
                player_game_counts.append({
                    "player_name": player.name,
                    "player_picture": player.picture,
                    "player_custom_avatar": player.custom_avatar,
                    "games_played": games_played
                })
        if player_game_counts:
            most_games_player = max(player_game_counts, key=lambda x: x["games_played"])

    # Most played deck (deck + player) - only consider enabled decks
    most_played_deck = None
    if enabled_decks and matches:
        player_lookup_stats = data.owner_lookup()
        deck_game_counts = []
        for deck in enabled_decks:
            deck_id = str(deck.id)
            games_played = sum(1 for match in matches if any(p.deck_id == deck_id for p in match.players))
            if games_played > 0:
                owner_info = player_lookup_stats.get(deck.player_id, {"name": "Unknown", "picture": None, "custom_avatar": None})
                deck_game_counts.append({
                    "deck_name": deck.name,
                    "commander_image_url": deck.commander_image_url,
                    "player_name": owner_info["name"],
                    "player_picture": owner_info["picture"],
                    "player_custom_avatar": owner_info["custom_avatar"],
                    "games_played": games_played
                })
        if deck_game_counts:
            most_played_deck = max(deck_game_counts, key=lambda x: x["games_played"])

    # Most popular single color (only from enabled decks)
    most_popular_color = None
    if enabled_decks:
        # Count individual colors across enabled decks only
        color_counts = {}
        for deck in enabled_decks:
            if deck.colors:
                for color in deck.colors:
                    color_counts[color] = color_counts.get(color, 0) + 1

        if color_counts:
            most_common_color = max(color_counts.items(), key=lambda x: x[1])
            most_popular_color = {
                "color": most_common_color[0],
                "percentage": round((most_common_color[1] / len(enabled_decks)) * 100, 1)
            }

    # Most popular color identity (only from enabled decks)
    most_popular_identity = None
    if enabled_decks:
        # Count color identity combinations from enabled decks only
        identity_combos = []
        for deck in enabled_decks:
            if deck.colors:
                # Sort colors to create consistent combo representation
                sorted_colors = tuple(sorted(deck.colors))
                identity_combos.append(sorted_colors)

        if identity_combos:
            identity_counts = Counter(identity_combos)
            most_common_identity = identity_counts.most_common(1)[0]
            identity_colors = list(most_common_identity[0])
            identity_name = get_color_identity_name(identity_colors)

            most_popular_identity = {
                "colors": identity_colors,
                "name": identity_name,
                "count": most_common_identity[1],
                "percentage": round((most_common_identity[1] / len(enabled_decks)) * 100, 1)
            }

    # Analytics: Elo Leader
    elo_leader = None
    if data.pod and scope.is_all:
        top_rating = await PlayerEloRating.find(
            PlayerEloRating.pod_id == data.pod_id
        ).sort(-PlayerEloRating.current_elo).first_or_none()

        if top_rating:
            leader_player = await _player_card(top_rating.player_id)
            if leader_player:
                elo_leader = {
                    "player_id": top_rating.player_id,
                    "player_name": leader_player.name,
                    "picture": leader_player.picture,
                    "custom_avatar": leader_player.custom_avatar,
                    "elo": round(top_rating.current_elo),
                    "games_rated": top_rating.games_rated
                }
    elif data.pod:
        member_lookup = {str(p.id): p for p in data.players}
        rated = [
            (pid, state) for pid, state in data.season_elo.items()
            if pid in member_lookup and state.games_rated > 0
        ]
        if rated:
            pid, state = max(rated, key=lambda x: (x[1].elo, x[0]))
            leader_player = member_lookup[pid]
            elo_leader = {
                "player_id": pid,
                "player_name": leader_player.name,
                "picture": leader_player.picture,
                "custom_avatar": leader_player.custom_avatar,
                "elo": round(state.elo),
                "games_rated": state.games_rated
            }

    # Analytics: Rising Star
    rising_star_result = None
    if data.pod and scope.is_all:
        rising_star_result = await get_rising_star(data.pod_id)
    elif data.pod:
        recent_ids = {
            str(m.id) for m in sorted(matches, key=lambda m: m.created_at, reverse=True)[:30]
        }
        rising_star_result = rising_star_from_history(
            data.season_elo, recent_ids, eligible_player_ids={str(p.id) for p in data.players}
        )

    rising_star_data = None
    if rising_star_result:
        rs_player = await _player_card(rising_star_result["player_id"])
        rising_star_data = {
            "player": {
                "player_id": rising_star_result["player_id"],
                "player_name": rs_player.name if rs_player else "Unknown",
                "picture": rs_player.picture if rs_player else None,
                "custom_avatar": rs_player.custom_avatar if rs_player else None,
            },
            "elo_gain": rising_star_result["elo_gain"],
            "current_elo": rising_star_result["current_elo"]
        }

    # Analytics: Pod Balance (last 30 matches in scope)
    pod_balance = gini_balance(matches) if data.pod else None

    return {
        "total_games": total_games,
        "total_players": total_players,
        "total_decks": total_decks,
        "avg_pod_size": avg_pod_size,
        "current_leader": current_leader,
        "last_game_date": last_game_date,
        "most_games_player": most_games_player,
        "most_played_deck": most_played_deck,
        "most_popular_color": most_popular_color,
        "most_popular_identity": most_popular_identity,
        # Analytics
        "elo_leader": elo_leader,
        "rising_star": rising_star_data,
        "pod_balance": pod_balance,
        # Season the stats are scoped to (None = all time)
        "season": season_to_dict(scope.season, season_today()) if scope.season else None,
    }
