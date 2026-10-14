"""
Pure stats functions shared by the live leaderboards and season award finalization.

Nothing in here touches the database, so the leaderboards people see and the
awards handed out at season end always come from the same code path.
"""

from collections import Counter
from dataclasses import dataclass, field
from datetime import date, datetime
from typing import Any, Iterable, Optional, Protocol, Sequence

from app.services.elo_calculator import DEFAULT_ELO, calculate_multiplayer_elo_changes

# Minimum games required for a player/deck to be ranked (and eligible for season awards)
MIN_GAMES_FOR_RANKING = 4

# How many placements are awarded per category each season
AWARD_PLACEMENTS = 3


class MatchPlayerLike(Protocol):
    player_id: str
    deck_id: str


class MatchLike(Protocol):
    id: Any
    match_date: date
    created_at: datetime
    winner_player_id: str
    winner_deck_id: str
    players: Sequence[MatchPlayerLike]


class PlayerLike(Protocol):
    id: Any
    name: str
    avatar: Optional[str]
    picture: Optional[str]
    custom_avatar: Optional[str]
    deck_ids: list[str]


class DeckLike(Protocol):
    id: Any
    name: str
    player_id: str
    commander: str
    commander_image_url: Optional[str]
    colors: list[str]


# ---------------------------------------------------------------------------
# Season Elo
# ---------------------------------------------------------------------------

@dataclass
class EloPoint:
    match_id: str
    match_date: date
    elo_before: float
    elo_after: float
    elo_change: float


@dataclass
class EloState:
    elo: float = DEFAULT_ELO
    peak: float = DEFAULT_ELO
    lowest: float = DEFAULT_ELO
    games_rated: int = 0
    last_change: float = 0.0
    history: list[EloPoint] = field(default_factory=list)


def _as_date(d: date) -> date:
    return d.date() if isinstance(d, datetime) else d


def replay_elo(matches: Iterable[MatchLike]) -> dict[str, EloState]:
    """
    Replay matches from a 1000 baseline and return each player's resulting Elo.

    Matches are ordered by (match_date, created_at). Note the stored all-time
    Elo replays in created_at order (elo_service.recalculate_pod_elo), so a
    backdated match can produce slightly different numbers between the two.
    Guests are included: they affect the ratings of the people they play.
    """
    ordered = sorted(matches, key=lambda m: (_as_date(m.match_date), m.created_at))
    states: dict[str, EloState] = {}

    for match in ordered:
        player_elos = []
        for mp in match.players:
            state = states.setdefault(mp.player_id, EloState())
            player_elos.append((mp.player_id, state.elo))

        changes = calculate_multiplayer_elo_changes(player_elos, match.winner_player_id)
        for player_id, change in changes.items():
            state = states[player_id]
            before = state.elo
            state.elo += change
            state.last_change = change
            state.games_rated += 1
            state.peak = max(state.peak, state.elo)
            state.lowest = min(state.lowest, state.elo)
            state.history.append(EloPoint(
                match_id=str(match.id),
                match_date=_as_date(match.match_date),
                elo_before=before,
                elo_after=state.elo,
                elo_change=change,
            ))

    return states


def elo_lookup_from_states(states: dict[str, EloState]) -> dict[str, tuple[float, float]]:
    """Map player_id -> (elo, last_change) for compute_player_standings."""
    return {pid: (s.elo, s.last_change) for pid, s in states.items()}


# ---------------------------------------------------------------------------
# Standings
# ---------------------------------------------------------------------------

def player_sort_key(entry: dict) -> tuple:
    # Sorted with reverse=True: ranked first, then Elo, win rate, wins, games.
    # player_id last keeps exact ties in a stable order.
    return (
        entry["ranked"],
        entry["elo"] if entry["elo"] is not None else 0,
        entry["win_rate"],
        entry["wins"],
        entry["games_played"],
        entry["player_id"],
    )


def deck_sort_key(entry: dict) -> tuple:
    return (
        entry["ranked"],
        entry["win_rate"],
        entry["wins"],
        entry["games_played"],
        entry["deck_id"],
    )


def compute_player_standings(
    players: Iterable[PlayerLike],
    matches: Sequence[MatchLike],
    elo_lookup: dict[str, tuple[float, float]],
    min_games: int = MIN_GAMES_FOR_RANKING,
) -> list[dict]:
    """Player leaderboard rows (players with at least one game), sorted best first."""
    games: Counter = Counter()
    wins: Counter = Counter()
    for match in matches:
        for pid in {p.player_id for p in match.players}:
            games[pid] += 1
        wins[match.winner_player_id] += 1

    leaderboard = []
    for player in players:
        player_id = str(player.id)
        games_played = games[player_id]
        if games_played == 0:
            continue
        player_wins = wins[player_id]
        win_rate = player_wins / games_played * 100
        elo = elo_lookup.get(player_id)
        leaderboard.append({
            "player_id": player_id,
            "player_name": player.name,
            "avatar": player.avatar,
            "picture": player.picture,
            "custom_avatar": player.custom_avatar,
            "games_played": games_played,
            "wins": player_wins,
            "losses": games_played - player_wins,
            "win_rate": round(win_rate, 1),
            "deck_count": len(player.deck_ids),
            "ranked": games_played >= min_games,
            "elo": round(elo[0]) if elo else None,
            "elo_change": round(elo[1], 1) if elo else None,
        })

    leaderboard.sort(key=player_sort_key, reverse=True)
    return leaderboard


def compute_deck_standings(
    decks: Iterable[DeckLike],
    matches: Sequence[MatchLike],
    owner_lookup: dict[str, dict],
    min_games: int = MIN_GAMES_FOR_RANKING,
) -> list[dict]:
    """
    Deck leaderboard rows (decks with at least one game), sorted best first.

    Decks are credited by deck_id, so a borrowed deck's games count for the
    deck (and its owner), not the borrower.
    """
    games: Counter = Counter()
    wins: Counter = Counter()
    for match in matches:
        for did in {p.deck_id for p in match.players}:
            games[did] += 1
        wins[match.winner_deck_id] += 1

    unknown_owner = {"name": "Unknown", "picture": None, "custom_avatar": None}
    leaderboard = []
    for deck in decks:
        deck_id = str(deck.id)
        games_played = games[deck_id]
        if games_played == 0:
            continue
        deck_wins = wins[deck_id]
        owner = owner_lookup.get(deck.player_id, unknown_owner)
        leaderboard.append({
            "deck_id": deck_id,
            "deck_name": deck.name,
            "commander": deck.commander,
            "commander_image_url": deck.commander_image_url,
            "colors": deck.colors,
            "player_id": deck.player_id,
            "player_name": owner["name"],
            "player_picture": owner["picture"],
            "player_custom_avatar": owner["custom_avatar"],
            "games_played": games_played,
            "wins": deck_wins,
            "losses": games_played - deck_wins,
            "win_rate": round(deck_wins / games_played * 100, 1),
            "ranked": games_played >= min_games,
        })

    leaderboard.sort(key=deck_sort_key, reverse=True)
    return leaderboard


# ---------------------------------------------------------------------------
# Season awards
# ---------------------------------------------------------------------------

def build_season_awards(
    player_standings: list[dict],
    deck_standings: list[dict],
    elo_states: dict[str, EloState],
) -> list[dict]:
    """
    Award drafts for a finished season: top 3 ranked players, top 3 ranked
    decks, and the highest peak Elo among ranked players.
    """
    awards: list[dict] = []

    ranked_players = [p for p in player_standings if p["ranked"]]
    for placement, entry in enumerate(ranked_players[:AWARD_PLACEMENTS], start=1):
        state = elo_states.get(entry["player_id"])
        awards.append({
            "award_type": "player_placement",
            "placement": placement,
            "player_id": entry["player_id"],
            "player_name": entry["player_name"],
            "player_picture": entry["picture"],
            "player_custom_avatar": entry["custom_avatar"],
            "stats": {
                "games_played": entry["games_played"],
                "wins": entry["wins"],
                "losses": entry["losses"],
                "win_rate": entry["win_rate"],
                "elo": entry["elo"],
                "peak_elo": round(state.peak) if state else None,
            },
        })

    ranked_decks = [d for d in deck_standings if d["ranked"]]
    for placement, entry in enumerate(ranked_decks[:AWARD_PLACEMENTS], start=1):
        awards.append({
            "award_type": "deck_placement",
            "placement": placement,
            "player_id": entry["player_id"],
            "player_name": entry["player_name"],
            "player_picture": entry["player_picture"],
            "player_custom_avatar": entry["player_custom_avatar"],
            "deck_id": entry["deck_id"],
            "deck_name": entry["deck_name"],
            "commander": entry["commander"],
            "commander_image_url": entry["commander_image_url"],
            "colors": entry["colors"],
            "stats": {
                "games_played": entry["games_played"],
                "wins": entry["wins"],
                "losses": entry["losses"],
                "win_rate": entry["win_rate"],
            },
        })

    peak_candidates = [
        (elo_states[p["player_id"]].peak, p)
        for p in ranked_players
        if p["player_id"] in elo_states and elo_states[p["player_id"]].games_rated > 0
    ]
    if peak_candidates:
        # Ties go to the higher-placed player (ranked_players is already in standings order)
        best_peak = max(peak for peak, _ in peak_candidates)
        peak, entry = next((pk, p) for pk, p in peak_candidates if pk == best_peak)
        if peak > DEFAULT_ELO:
            awards.append({
                "award_type": "peak_elo",
                "placement": 1,
                "player_id": entry["player_id"],
                "player_name": entry["player_name"],
                "player_picture": entry["picture"],
                "player_custom_avatar": entry["custom_avatar"],
                "stats": {
                    "games_played": entry["games_played"],
                    "wins": entry["wins"],
                    "peak_elo": round(peak),
                    "elo": entry["elo"],
                },
            })

    return awards


# ---------------------------------------------------------------------------
# Dashboard helpers
# ---------------------------------------------------------------------------

def gini_balance(matches: Sequence[MatchLike], window: int = 30, min_matches: int = 5) -> Optional[dict]:
    """Pod balance over the most recent `window` matches (by created_at)."""
    if len(matches) < min_matches:
        return None

    recent = sorted(matches, key=lambda m: m.created_at, reverse=True)[:window]
    win_counts = Counter(m.winner_player_id for m in recent)
    total_wins = sum(win_counts.values())
    if total_wins == 0:
        return None

    wins = sorted(win_counts.values())
    n = len(wins)
    if n <= 1:
        gini = 0.0
    else:
        cumulative = sum((i + 1) * w for i, w in enumerate(wins))
        gini = (2 * cumulative) / (n * sum(wins)) - (n + 1) / n

    score = round((1 - gini) * 100)
    if score >= 70:
        status = "Healthy"
    elif score >= 50:
        status = "Uneven"
    else:
        status = "Dominated"

    return {
        "score": score,
        "status": status,
        "games_analyzed": len(recent),
        "unique_winners": len(win_counts),
    }


def rising_star_from_history(
    states: dict[str, EloState],
    recent_match_ids: set[str],
    min_games: int = 5,
    eligible_player_ids: Optional[set[str]] = None,
) -> Optional[dict]:
    """Player with the biggest Elo gain across `recent_match_ids` (season-mode Rising Star)."""
    best_gain = 0.0
    best_pid: Optional[str] = None
    for pid, state in states.items():
        if state.games_rated < min_games:
            continue
        if eligible_player_ids is not None and pid not in eligible_player_ids:
            continue
        gain = sum(pt.elo_change for pt in state.history if pt.match_id in recent_match_ids)
        if gain > best_gain:
            best_gain = gain
            best_pid = pid

    if best_pid is None:
        return None
    state = states[best_pid]
    return {
        "player_id": best_pid,
        "elo_gain": round(best_gain),
        "current_elo": round(state.elo),
        "games_rated": state.games_rated,
    }
