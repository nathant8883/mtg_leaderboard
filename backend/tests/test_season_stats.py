from dataclasses import dataclass, field
from datetime import date, datetime, timedelta
from itertools import count
from typing import Optional

import pytest

from app.services.season_stats import (
    build_season_awards,
    compute_deck_standings,
    compute_player_standings,
    elo_lookup_from_states,
    gini_balance,
    replay_elo,
    rising_star_from_history,
)

_ids = count(1)
_base = datetime(2026, 10, 1, 12, 0)


@dataclass
class MP:
    player_id: str
    deck_id: str


@dataclass
class M:
    players: list[MP]
    winner_player_id: str
    winner_deck_id: str
    match_date: date = date(2026, 10, 5)
    created_at: datetime = field(default_factory=lambda: _base + timedelta(minutes=next(_ids)))
    id: str = field(default_factory=lambda: f"m{next(_ids)}")


@dataclass
class P:
    id: str
    name: str = ""
    avatar: Optional[str] = None
    picture: Optional[str] = None
    custom_avatar: Optional[str] = None
    deck_ids: list[str] = field(default_factory=list)


@dataclass
class D:
    id: str
    player_id: str
    name: str = ""
    commander: str = "Cmdr"
    commander_image_url: Optional[str] = None
    colors: list[str] = field(default_factory=list)


def game(winner: str, *others: str, d: date = date(2026, 10, 5), **kw) -> M:
    """Match where each player plays deck 'd_<player>'."""
    pids = [winner, *others]
    return M(
        players=[MP(p, f"d_{p}") for p in pids],
        winner_player_id=winner,
        winner_deck_id=f"d_{winner}",
        match_date=d,
        **kw,
    )


# ---------------------------------------------------------------------------
# replay_elo
# ---------------------------------------------------------------------------

def test_everyone_starts_at_1000_and_changes_sum_to_zero():
    states = replay_elo([game("a", "b", "c", "e")])
    assert states["a"].elo > 1000
    assert all(states[p].elo < 1000 for p in "bce")
    assert sum(s.elo - 1000 for s in states.values()) == pytest.approx(0, abs=0.5)
    assert all(s.games_rated == 1 for s in states.values())


def test_two_player_games_do_not_change_elo():
    states = replay_elo([game("a", "b")])
    assert states["a"].elo == 1000 and states["a"].games_rated == 0
    assert states["a"].history == []


def test_replay_orders_by_match_date_then_created_at():
    late_created_but_early_date = game("b", "a", "c", d=date(2026, 10, 1))
    early_created_but_later_date = game("a", "b", "c", d=date(2026, 10, 2))
    # Pass in created_at order the "wrong" way round
    states = replay_elo([early_created_but_later_date, late_created_but_early_date])
    assert [pt.match_date for pt in states["a"].history] == [date(2026, 10, 1), date(2026, 10, 2)]


def test_peak_lowest_and_history():
    states = replay_elo([game("a", "b", "c"), game("b", "a", "c"), game("b", "a", "c")])
    a = states["a"]
    assert a.peak > 1000 and a.lowest <= 1000 and a.peak >= a.elo
    assert len(a.history) == 3
    assert a.history[0].elo_before == 1000
    assert a.history[-1].elo_after == pytest.approx(a.elo)
    assert a.last_change == a.history[-1].elo_change


def test_guests_affect_others():
    with_guest = replay_elo([game("a", "guest", "b")])
    assert "guest" in with_guest and with_guest["guest"].elo < 1000
    assert with_guest["a"].elo > 1000


# ---------------------------------------------------------------------------
# standings
# ---------------------------------------------------------------------------

def test_player_standings_min_games_and_order():
    players = [P("a", "A"), P("b", "B"), P("c", "C"), P("x", "Never played")]
    matches = [game("a", "b", "c") for _ in range(4)] + [game("b", "a", "c")]
    elo = elo_lookup_from_states(replay_elo(matches))
    rows = compute_player_standings(players, matches, elo, min_games=4)

    assert [r["player_id"] for r in rows][0] == "a"
    assert "x" not in {r["player_id"] for r in rows}
    a = rows[0]
    assert (a["games_played"], a["wins"], a["losses"], a["win_rate"]) == (5, 4, 1, 80.0)
    assert all(r["ranked"] for r in rows)


def test_unranked_sorted_after_ranked():
    players = [P("a"), P("b"), P("c"), P("n")]
    matches = [game("a", "b", "c") for _ in range(4)] + [game("n", "a", "b")]
    rows = compute_player_standings(players, matches, elo_lookup_from_states(replay_elo(matches)), min_games=4)
    assert rows[-1]["player_id"] == "n" and not rows[-1]["ranked"]


def test_ties_are_deterministic():
    players = [P("b"), P("a")]
    matches = [game("a", "b"), game("b", "a")]  # 1v1: no Elo, identical records
    rows1 = compute_player_standings(players, matches, {}, min_games=1)
    rows2 = compute_player_standings(list(reversed(players)), matches, {}, min_games=1)
    assert [r["player_id"] for r in rows1] == [r["player_id"] for r in rows2]


def test_borrowed_deck_credited_to_deck_and_owner():
    # "b" borrows owner "o"'s deck and wins with it
    m = M(players=[MP("b", "d_o"), MP("a", "d_a"), MP("c", "d_c")],
          winner_player_id="b", winner_deck_id="d_o")
    decks = [D("d_o", player_id="o", name="Owner deck"), D("d_a", player_id="a")]
    owners = {"o": {"name": "Owner", "picture": None, "custom_avatar": None}}
    rows = compute_deck_standings(decks, [m], owners, min_games=1)
    top = rows[0]
    assert top["deck_id"] == "d_o" and top["player_id"] == "o" and top["player_name"] == "Owner"
    assert top["wins"] == 1


def test_decks_not_passed_in_are_excluded():
    # Callers pass only enabled decks; a disabled deck's games simply don't appear
    m = game("a", "b", "c")
    rows = compute_deck_standings([D("d_b", "b")], [m], {}, min_games=1)
    assert [r["deck_id"] for r in rows] == ["d_b"]


# ---------------------------------------------------------------------------
# awards
# ---------------------------------------------------------------------------

def _season(n_players: int, games_each: int = 4):
    pids = [f"p{i}" for i in range(n_players)]
    matches = []
    for g in range(games_each):
        for i, winner in enumerate(pids):
            others = [p for p in pids if p != winner][:3]
            if len(others) >= 2 and (i + g) % 2 == 0 or (i == 0):
                matches.append(game(winner, *others))
    players = [P(p, p.upper()) for p in pids]
    decks = [D(f"d_{p}", p) for p in pids]
    states = replay_elo(matches)
    ps = compute_player_standings(players, matches, elo_lookup_from_states(states))
    owners = {p: {"name": p.upper(), "picture": None, "custom_avatar": None} for p in pids}
    ds = compute_deck_standings(decks, matches, owners)
    return ps, ds, states


def test_awards_with_no_eligible_players():
    ps, ds, states = _season(3, games_each=1)
    assert not any(p["ranked"] for p in ps)
    assert build_season_awards(ps, ds, states) == []


def test_awards_top_three_and_peak():
    ps, ds, states = _season(5)
    awards = build_season_awards(ps, ds, states)
    player = [a for a in awards if a["award_type"] == "player_placement"]
    deck = [a for a in awards if a["award_type"] == "deck_placement"]
    peak = [a for a in awards if a["award_type"] == "peak_elo"]

    assert [a["placement"] for a in player] == [1, 2, 3]
    assert [a["player_id"] for a in player] == [p["player_id"] for p in ps if p["ranked"]][:3]
    assert [a["placement"] for a in deck] == [1, 2, 3]
    assert all(a["deck_id"] for a in deck)
    assert len(peak) == 1
    best = max(states[p["player_id"]].peak for p in ps if p["ranked"])
    assert peak[0]["stats"]["peak_elo"] == round(best)


def test_awards_fewer_than_three_eligible():
    players = [P("a"), P("b"), P("c")]
    matches = [game("a", "b", "c") for _ in range(4)]
    # Only a, b, c play; all ranked. Remove c from the eligible player list.
    states = replay_elo(matches)
    ps = compute_player_standings(players[:2], matches, elo_lookup_from_states(states))
    awards = build_season_awards(ps, [], states)
    assert [a["placement"] for a in awards if a["award_type"] == "player_placement"] == [1, 2]


# ---------------------------------------------------------------------------
# dashboard helpers
# ---------------------------------------------------------------------------

def test_gini_balance():
    assert gini_balance([game("a", "b", "c")] * 4) is None
    dominated = gini_balance([game("a", "b", "c") for _ in range(10)])
    assert dominated["unique_winners"] == 1
    even = gini_balance([game(w, "x", "y") for w in "abcdeabcde"])
    assert even["status"] == "Healthy" and even["score"] == 100


def test_rising_star():
    matches = [game("a", "b", "c") for _ in range(6)]
    states = replay_elo(matches)
    ids = {str(m.id) for m in matches}
    star = rising_star_from_history(states, ids, min_games=5)
    assert star["player_id"] == "a" and star["elo_gain"] > 0
    assert rising_star_from_history(states, ids, min_games=5, eligible_player_ids={"b"}) is None
