"""
Pod Dynamics router for deep analytics.

Provides endpoints for:
- Elo history (time series for charts)
- Player trends (pod size performance, placements, first player advantage)
- Head-to-head matchups
- Deck/meta statistics
- Auto-generated insights
"""

from fastapi import APIRouter, Depends, Query
from typing import Dict, Any, Optional, List
from collections import Counter, defaultdict
from statistics import stdev
from datetime import datetime

from app.models.player import Player
from app.models.match import Match
from app.models.analytics import PlayerEloRating, EloHistoryEntry
from app.middleware.auth import get_optional_player
from beanie import PydanticObjectId

router = APIRouter()


@router.get("/elo-history")
async def get_elo_history(
    player_id: Optional[str] = Query(None, description="Player ID (defaults to current player)"),
    current_player: Optional[Player] = Depends(get_optional_player)
) -> Dict[str, Any]:
    """
    Get Elo history for a player within their current pod.

    Returns time series data suitable for charting Elo progression.
    """
    if not current_player or not current_player.current_pod_id:
        return {
            "history": [],
            "current_elo": None,
            "peak_elo": None,
            "lowest_elo": None,
            "games_rated": 0
        }

    # Use provided player_id or default to current player
    target_player_id = player_id or str(current_player.id)

    # Get current rating
    rating = await PlayerEloRating.find_one(
        PlayerEloRating.player_id == target_player_id,
        PlayerEloRating.pod_id == current_player.current_pod_id
    )

    # Get history entries
    history = await EloHistoryEntry.find(
        EloHistoryEntry.player_id == target_player_id,
        EloHistoryEntry.pod_id == current_player.current_pod_id
    ).sort(EloHistoryEntry.timestamp).to_list()

    # Format for chart
    history_data = []
    for entry in history:
        history_data.append({
            "match_id": entry.match_id,
            "elo": round(entry.elo_after),
            "change": round(entry.elo_change, 1),
            "date": entry.timestamp.isoformat()
        })

    return {
        "history": history_data,
        "current_elo": round(rating.current_elo) if rating else 1000,
        "peak_elo": round(rating.peak_elo) if rating else 1000,
        "lowest_elo": round(rating.lowest_elo) if rating else 1000,
        "games_rated": rating.games_rated if rating else 0
    }


@router.get("/player-trends")
async def get_player_trends(
    player_id: Optional[str] = Query(None, description="Player ID (defaults to current player)"),
    current_player: Optional[Player] = Depends(get_optional_player)
) -> Dict[str, Any]:
    """
    Get comprehensive trend data for a player.

    Returns:
    - Performance by pod size (3p, 4p, 5p, 6p)
    - Placement distribution
    - First player advantage
    - Rolling win rate
    - Consistency score
    """
    if not current_player or not current_player.current_pod_id:
        return {
            "pod_size_performance": {},
            "placement_distribution": {},
            "first_player_stats": {},
            "win_rate_trend": [],
            "consistency": {},
            "total_games": 0
        }

    target_player_id = player_id or str(current_player.id)

    # Get all matches in pod where this player participated
    all_matches = await Match.find(
        Match.pod_id == current_player.current_pod_id
    ).sort(-Match.match_date).to_list()

    # Filter to matches where target player participated
    player_matches = []
    for match in all_matches:
        player_ids = [p.player_id for p in match.players]
        if target_player_id in player_ids:
            player_matches.append(match)

    if not player_matches:
        return {
            "pod_size_performance": {},
            "placement_distribution": {},
            "first_player_stats": {},
            "win_rate_trend": [],
            "consistency": {},
            "total_games": 0
        }

    # 1. Performance by pod size
    pod_size_stats: Dict[int, Dict[str, int]] = defaultdict(lambda: {"wins": 0, "games": 0})

    # 2. Placement distribution (only count games with actual elimination_order data)
    placements: List[int] = []
    placement_counts: Dict[int, int] = Counter()
    games_with_placement_data = 0

    # 3. First player advantage
    first_player_wins = 0
    first_player_games = 0
    not_first_wins = 0
    not_first_games = 0

    # 4. Win rate trend (rolling)
    win_history: List[Dict[str, Any]] = []

    for match in player_matches:
        pod_size = len(match.players)
        is_winner = match.winner_player_id == target_player_id

        # Find player's data in this match
        player_match_data = None
        player_position = None
        for idx, p in enumerate(match.players):
            if p.player_id == target_player_id:
                player_match_data = p
                player_position = idx
                break

        # Pod size performance
        pod_size_stats[pod_size]["games"] += 1
        if is_winner:
            pod_size_stats[pod_size]["wins"] += 1

        # Placement distribution - only count when actual elimination_order is recorded
        if player_match_data and player_match_data.elimination_order is not None:
            placements.append(player_match_data.elimination_order)
            placement_counts[player_match_data.elimination_order] += 1
            games_with_placement_data += 1

        # First player advantage
        if match.first_player_position is not None and player_position is not None:
            if match.first_player_position == player_position:
                first_player_games += 1
                if is_winner:
                    first_player_wins += 1
            else:
                not_first_games += 1
                if is_winner:
                    not_first_wins += 1

        # Win history for trend
        win_history.append({
            "date": match.match_date.isoformat(),
            "won": is_winner,
            "pod_size": pod_size
        })

    # Calculate pod size win rates
    pod_size_performance = {}
    for size in [3, 4, 5, 6]:
        stats = pod_size_stats.get(size, {"wins": 0, "games": 0})
        if stats["games"] > 0:
            pod_size_performance[str(size)] = {
                "games": stats["games"],
                "wins": stats["wins"],
                "win_rate": round(stats["wins"] / stats["games"] * 100, 1)
            }

    # Calculate placement distribution
    total_with_placement = sum(placement_counts.values())
    placement_distribution = {}
    for place in [1, 2, 3, 4, 5, 6]:
        count = placement_counts.get(place, 0)
        placement_distribution[str(place)] = {
            "count": count,
            "percentage": round(count / total_with_placement * 100, 1) if total_with_placement > 0 else 0
        }

    # Calculate first player stats
    first_player_stats = {
        "as_first": {
            "games": first_player_games,
            "wins": first_player_wins,
            "win_rate": round(first_player_wins / first_player_games * 100, 1) if first_player_games > 0 else 0
        },
        "not_first": {
            "games": not_first_games,
            "wins": not_first_wins,
            "win_rate": round(not_first_wins / not_first_games * 100, 1) if not_first_games > 0 else 0
        }
    }

    # Calculate rolling win rate (last N games)
    win_rate_trend = []
    window_size = 10
    wins_in_window = 0

    # Reverse to process oldest first
    win_history_sorted = sorted(win_history, key=lambda x: x["date"])

    for i, game in enumerate(win_history_sorted):
        if game["won"]:
            wins_in_window += 1

        # Remove oldest if window full
        if i >= window_size:
            if win_history_sorted[i - window_size]["won"]:
                wins_in_window -= 1

        games_in_window = min(i + 1, window_size)
        win_rate_trend.append({
            "game_number": i + 1,
            "date": game["date"],
            "win_rate": round(wins_in_window / games_in_window * 100, 1)
        })

    # Calculate consistency score
    consistency = {}
    if len(placements) >= 5:
        avg_placement = sum(placements) / len(placements)
        placement_stdev = stdev(placements) if len(placements) > 1 else 0

        # Lower stdev = more consistent
        # Scale: 0-0.5 = Very Consistent, 0.5-1.0 = Consistent, 1.0-1.5 = Average, 1.5+ = Volatile
        if placement_stdev < 0.5:
            consistency_label = "Very Consistent"
        elif placement_stdev < 1.0:
            consistency_label = "Consistent"
        elif placement_stdev < 1.5:
            consistency_label = "Average"
        else:
            consistency_label = "Volatile"

        consistency = {
            "average_placement": round(avg_placement, 2),
            "standard_deviation": round(placement_stdev, 2),
            "label": consistency_label,
            "games_analyzed": len(placements)
        }

    return {
        "pod_size_performance": pod_size_performance,
        "placement_distribution": placement_distribution,
        "first_player_stats": first_player_stats,
        "win_rate_trend": win_rate_trend,
        "consistency": consistency,
        "total_games": len(player_matches),
        "games_with_placement_data": games_with_placement_data
    }


@router.get("/overview")
async def get_pod_dynamics_overview(
    current_player: Optional[Player] = Depends(get_optional_player)
) -> Dict[str, Any]:
    """
    Get overview stats for the Pod Dynamics page header.

    Returns summary cards data: pod balance, unique winners, avg game duration.
    """
    if not current_player or not current_player.current_pod_id:
        return {
            "total_games": 0,
            "unique_winners": 0,
            "avg_duration_minutes": None,
            "pod_balance_score": None
        }

    matches = await Match.find(
        Match.pod_id == current_player.current_pod_id
    ).to_list()

    if not matches:
        return {
            "total_games": 0,
            "unique_winners": 0,
            "avg_duration_minutes": None,
            "pod_balance_score": None
        }

    # Unique winners
    unique_winners = len(set(m.winner_player_id for m in matches))

    # Average duration
    durations = [m.duration_seconds for m in matches if m.duration_seconds]
    avg_duration = sum(durations) / len(durations) if durations else None

    # Pod balance (simplified Gini)
    win_counts = Counter(m.winner_player_id for m in matches)
    total_wins = sum(win_counts.values())

    if total_wins > 0 and len(win_counts) > 1:
        wins = sorted(win_counts.values())
        n = len(wins)
        cumulative = sum((i + 1) * w for i, w in enumerate(wins))
        gini = (2 * cumulative) / (n * sum(wins)) - (n + 1) / n
        balance_score = round((1 - gini) * 100)
    else:
        balance_score = 100 if total_wins == 0 else 0

    return {
        "total_games": len(matches),
        "unique_winners": unique_winners,
        "avg_duration_minutes": round(avg_duration / 60, 1) if avg_duration else None,
        "pod_balance_score": balance_score
    }


@router.get("/matchups")
async def get_head_to_head_matchups(
    current_player: Optional[Player] = Depends(get_optional_player)
) -> Dict[str, Any]:
    """
    Get head-to-head win rates between all players in the pod.

    Returns a matrix of player matchups with win/loss records.
    """
    if not current_player or not current_player.current_pod_id:
        return {"players": [], "matchups": {}}

    matches = await Match.find(
        Match.pod_id == current_player.current_pod_id
    ).to_list()

    if not matches:
        return {"players": [], "matchups": {}}

    # Collect all unique players and their names
    player_info: Dict[str, str] = {}
    for match in matches:
        for p in match.players:
            if p.player_id not in player_info:
                player_info[p.player_id] = p.player_name

    # Build head-to-head matrix
    # matchups[player_a][player_b] = {wins: X, losses: Y, games: Z}
    matchups: Dict[str, Dict[str, Dict[str, int]]] = defaultdict(
        lambda: defaultdict(lambda: {"wins": 0, "losses": 0, "games": 0})
    )

    for match in matches:
        winner_id = match.winner_player_id
        player_ids = [p.player_id for p in match.players]

        # For each pair of players in the match
        for i, p1_id in enumerate(player_ids):
            for p2_id in player_ids[i+1:]:
                # Both played this game together
                matchups[p1_id][p2_id]["games"] += 1
                matchups[p2_id][p1_id]["games"] += 1

                # Record win/loss
                if winner_id == p1_id:
                    matchups[p1_id][p2_id]["wins"] += 1
                    matchups[p2_id][p1_id]["losses"] += 1
                elif winner_id == p2_id:
                    matchups[p2_id][p1_id]["wins"] += 1
                    matchups[p1_id][p2_id]["losses"] += 1

    # Convert to serializable format with win rates
    matchups_data = {}
    for p1_id, opponents in matchups.items():
        matchups_data[p1_id] = {}
        for p2_id, stats in opponents.items():
            games = stats["games"]
            wins = stats["wins"]
            matchups_data[p1_id][p2_id] = {
                "wins": wins,
                "losses": stats["losses"],
                "games": games,
                "win_rate": round(wins / games * 100, 1) if games > 0 else 0
            }

    # Create player list with names
    players = [
        {"id": pid, "name": name}
        for pid, name in player_info.items()
    ]

    return {
        "players": players,
        "matchups": matchups_data
    }


@router.get("/games-together")
async def get_games_together_stats(
    player_id: Optional[str] = Query(None, description="Player ID (defaults to current player)"),
    current_player: Optional[Player] = Depends(get_optional_player)
) -> Dict[str, Any]:
    """
    Get statistics about how often players have played together.

    Returns play frequency, best partners (win rate when together),
    and nemesis data.
    """
    if not current_player or not current_player.current_pod_id:
        return {
            "total_games": 0,
            "partners": [],
            "most_played_with": None,
            "best_partner": None,
            "nemesis": None
        }

    target_player_id = player_id or str(current_player.id)

    matches = await Match.find(
        Match.pod_id == current_player.current_pod_id
    ).to_list()

    # Filter to matches where target player participated
    player_matches = [
        m for m in matches
        if target_player_id in [p.player_id for p in m.players]
    ]

    if not player_matches:
        return {
            "total_games": 0,
            "partners": [],
            "most_played_with": None,
            "best_partner": None,
            "nemesis": None
        }

    # Fetch all players to get avatars (use custom_avatar if set, otherwise picture)
    all_players = await Player.find(
        Player.current_pod_id == current_player.current_pod_id
    ).to_list()
    player_avatars = {str(p.id): (p.custom_avatar or p.picture) for p in all_players}

    # Track stats with each partner
    partner_stats: Dict[str, Dict[str, Any]] = defaultdict(
        lambda: {"name": "", "games": 0, "wins_together": 0, "their_wins": 0}
    )

    for match in player_matches:
        is_my_win = match.winner_player_id == target_player_id

        for p in match.players:
            if p.player_id != target_player_id:
                partner_stats[p.player_id]["name"] = p.player_name
                partner_stats[p.player_id]["games"] += 1
                if is_my_win:
                    partner_stats[p.player_id]["wins_together"] += 1
                if match.winner_player_id == p.player_id:
                    partner_stats[p.player_id]["their_wins"] += 1

    # Calculate derived stats
    partners = []
    for partner_id, stats in partner_stats.items():
        games = stats["games"]
        my_win_rate = round(stats["wins_together"] / games * 100, 1) if games > 0 else 0
        their_win_rate = round(stats["their_wins"] / games * 100, 1) if games > 0 else 0

        partners.append({
            "player_id": partner_id,
            "player_name": stats["name"],
            "avatar": player_avatars.get(partner_id),
            "games_together": games,
            "my_wins": stats["wins_together"],
            "their_wins": stats["their_wins"],
            "my_win_rate": my_win_rate,
            "their_win_rate": their_win_rate
        })

    # Sort by games together
    partners.sort(key=lambda x: x["games_together"], reverse=True)

    # Find most played with (most games)
    most_played = partners[0] if partners else None

    # Find best partner (highest win rate with min 4 games)
    qualified_partners = [p for p in partners if p["games_together"] >= 4]
    best_partner = max(qualified_partners, key=lambda x: x["my_win_rate"]) if qualified_partners else None

    # Find nemesis (player who has beaten you the most, min 4 games)
    nemesis = max(qualified_partners, key=lambda x: x["their_wins"]) if qualified_partners else None

    return {
        "total_games": len(player_matches),
        "partners": partners,
        "most_played_with": most_played,
        "best_partner": best_partner,
        "nemesis": nemesis
    }


@router.get("/deck-stats")
async def get_deck_stats(
    current_player: Optional[Player] = Depends(get_optional_player)
) -> Dict[str, Any]:
    """
    Get deck/commander performance statistics for the pod.

    Returns commander tier list and individual deck performance.
    """
    if not current_player or not current_player.current_pod_id:
        return {
            "commanders": [],
            "player_decks": [],
            "total_games": 0
        }

    matches = await Match.find(
        Match.pod_id == current_player.current_pod_id
    ).to_list()

    if not matches:
        return {
            "commanders": [],
            "player_decks": [],
            "total_games": 0
        }

    # Track commander stats
    commander_stats: Dict[str, Dict[str, Any]] = defaultdict(
        lambda: {"games": 0, "wins": 0, "players": set(), "colors": []}
    )

    # Track deck stats for current player
    player_deck_stats: Dict[str, Dict[str, Any]] = defaultdict(
        lambda: {"name": "", "commander": "", "colors": [], "games": 0, "wins": 0}
    )

    target_player_id = str(current_player.id)

    for match in matches:
        winner_deck_id = match.winner_deck_id

        for p in match.players:
            # Commander stats (aggregate by commander name)
            commander_name = p.deck_name  # deck_name often includes commander
            if commander_name:
                commander_stats[commander_name]["games"] += 1
                commander_stats[commander_name]["players"].add(p.player_name)
                if p.deck_colors:
                    commander_stats[commander_name]["colors"] = p.deck_colors

                if p.deck_id == winner_deck_id:
                    commander_stats[commander_name]["wins"] += 1

            # Track current player's deck stats
            if p.player_id == target_player_id and p.deck_id:
                player_deck_stats[p.deck_id]["name"] = p.deck_name
                player_deck_stats[p.deck_id]["colors"] = p.deck_colors or []
                player_deck_stats[p.deck_id]["games"] += 1
                if p.deck_id == winner_deck_id:
                    player_deck_stats[p.deck_id]["wins"] += 1

    # Calculate win rates and create tier list
    commanders = []
    for commander, stats in commander_stats.items():
        games = stats["games"]
        wins = stats["wins"]
        win_rate = round(wins / games * 100, 1) if games > 0 else 0

        # Determine tier based on win rate and games played
        if games >= 5:
            if win_rate >= 35:
                tier = "S"
            elif win_rate >= 28:
                tier = "A"
            elif win_rate >= 20:
                tier = "B"
            elif win_rate >= 12:
                tier = "C"
            else:
                tier = "D"
        else:
            tier = "?"  # Not enough games

        commanders.append({
            "name": commander,
            "games": games,
            "wins": wins,
            "win_rate": win_rate,
            "tier": tier,
            "players": list(stats["players"]),
            "colors": stats["colors"]
        })

    # Sort by tier (S→A→B→C→D→?), then win rate, then games
    # Unranked decks ("?") are placed at the bottom
    TIER_ORDER = {'S': 0, 'A': 1, 'B': 2, 'C': 3, 'D': 4, '?': 5}
    commanders.sort(key=lambda x: (
        TIER_ORDER.get(x["tier"], 5),  # Tier order (? goes last)
        -x["win_rate"],                 # Win rate descending
        -x["games"]                     # Games descending
    ))

    # Player's deck stats
    player_decks = []
    for deck_id, stats in player_deck_stats.items():
        games = stats["games"]
        wins = stats["wins"]
        player_decks.append({
            "deck_id": deck_id,
            "name": stats["name"],
            "colors": stats["colors"],
            "games": games,
            "wins": wins,
            "win_rate": round(wins / games * 100, 1) if games > 0 else 0
        })

    player_decks.sort(key=lambda x: x["games"], reverse=True)

    return {
        "commanders": commanders,
        "player_decks": player_decks,
        "total_games": len(matches)
    }


@router.get("/color-stats")
async def get_color_stats(
    current_player: Optional[Player] = Depends(get_optional_player)
) -> Dict[str, Any]:
    """
    Get color performance statistics for the pod.

    Returns win rates by color, color count, and meta composition.
    """
    if not current_player or not current_player.current_pod_id:
        return {
            "by_color": {},
            "by_color_count": {},
            "meta_composition": {},
            "total_games": 0
        }

    matches = await Match.find(
        Match.pod_id == current_player.current_pod_id
    ).to_list()

    if not matches:
        return {
            "by_color": {},
            "by_color_count": {},
            "meta_composition": {},
            "total_games": 0
        }

    # Track stats by individual color
    color_stats: Dict[str, Dict[str, int]] = defaultdict(lambda: {"games": 0, "wins": 0})

    # Track stats by color count
    color_count_stats: Dict[int, Dict[str, int]] = defaultdict(lambda: {"games": 0, "wins": 0})

    # Track meta composition (color identity frequency)
    color_identity_counts: Dict[str, int] = Counter()

    for match in matches:
        winner_deck_id = match.winner_deck_id

        for p in match.players:
            colors = p.deck_colors or []
            is_winner = p.deck_id == winner_deck_id

            # By individual color
            for color in colors:
                color_stats[color]["games"] += 1
                if is_winner:
                    color_stats[color]["wins"] += 1

            # By color count
            color_count = len(colors)
            color_count_stats[color_count]["games"] += 1
            if is_winner:
                color_count_stats[color_count]["wins"] += 1

            # Meta composition (sorted color identity string)
            identity = "".join(sorted(colors)) if colors else "C"  # C for colorless
            color_identity_counts[identity] += 1

    # Calculate win rates by color
    by_color = {}
    for color in ["W", "U", "B", "R", "G"]:
        stats = color_stats.get(color, {"games": 0, "wins": 0})
        games = stats["games"]
        wins = stats["wins"]
        by_color[color] = {
            "games": games,
            "wins": wins,
            "win_rate": round(wins / games * 100, 1) if games > 0 else 0
        }

    # Calculate win rates by color count
    by_color_count = {}
    for count in range(0, 6):  # 0 (colorless) to 5 (5-color)
        stats = color_count_stats.get(count, {"games": 0, "wins": 0})
        games = stats["games"]
        wins = stats["wins"]
        if games > 0:
            label = {0: "Colorless", 1: "Mono", 2: "2-Color", 3: "3-Color", 4: "4-Color", 5: "5-Color"}[count]
            by_color_count[label] = {
                "games": games,
                "wins": wins,
                "win_rate": round(wins / games * 100, 1)
            }

    # Meta composition (top color identities)
    total_decks_played = sum(color_identity_counts.values())
    meta_composition = {}
    for identity, count in color_identity_counts.most_common(10):
        meta_composition[identity] = {
            "count": count,
            "percentage": round(count / total_decks_played * 100, 1) if total_decks_played > 0 else 0
        }

    return {
        "by_color": by_color,
        "by_color_count": by_color_count,
        "meta_composition": meta_composition,
        "total_games": len(matches)
    }


@router.get("/insights")
async def get_auto_insights(
    current_player: Optional[Player] = Depends(get_optional_player)
) -> Dict[str, Any]:
    """
    Generate auto-generated insights for the pod.

    Returns interesting observations about play patterns, streaks,
    and notable statistics.
    """
    if not current_player or not current_player.current_pod_id:
        return {"insights": [], "pod_health": {}}

    matches = await Match.find(
        Match.pod_id == current_player.current_pod_id
    ).sort(-Match.match_date).to_list()

    if not matches:
        return {"insights": [], "pod_health": {}}

    insights: List[Dict[str, Any]] = []

    # Get all players and their stats
    player_stats: Dict[str, Dict[str, Any]] = defaultdict(
        lambda: {"name": "", "games": 0, "wins": 0, "recent_wins": 0, "recent_games": 0}
    )

    # Recent = last 10 games
    recent_matches = matches[:10]
    recent_match_ids = {str(m.id) for m in recent_matches}

    for match in matches:
        is_recent = str(match.id) in recent_match_ids
        for p in match.players:
            player_stats[p.player_id]["name"] = p.player_name
            player_stats[p.player_id]["games"] += 1
            if is_recent:
                player_stats[p.player_id]["recent_games"] += 1

            if match.winner_player_id == p.player_id:
                player_stats[p.player_id]["wins"] += 1
                if is_recent:
                    player_stats[p.player_id]["recent_wins"] += 1

    # 1. Win streaks
    # Track consecutive wins for each player
    player_streaks: Dict[str, int] = defaultdict(int)
    for match in matches:  # Already sorted by most recent first
        winner_id = match.winner_player_id
        if winner_id:
            # Check if this extends their streak
            current_streak = player_streaks.get(winner_id, 0)
            if current_streak >= 0:
                player_streaks[winner_id] = current_streak + 1
            # Mark all other players as having their streak broken
            for p in match.players:
                if p.player_id != winner_id:
                    if player_streaks.get(p.player_id, 0) > 0:
                        player_streaks[p.player_id] = -player_streaks[p.player_id]

    # Find players on hot streaks (3+ wins)
    for pid, streak in player_streaks.items():
        if streak >= 3:
            name = player_stats[pid]["name"]
            insights.append({
                "type": "streak",
                "icon": "flame",
                "title": "Hot Streak!",
                "description": f"{name} has won {streak} games in a row",
                "priority": streak
            })

    # 2. Cold streaks (check most recent games for each player)
    # Player with 0 wins in last 5+ games
    for pid, stats in player_stats.items():
        if stats["recent_games"] >= 5 and stats["recent_wins"] == 0:
            insights.append({
                "type": "cold_streak",
                "icon": "snowflake",
                "title": "Cold Streak",
                "description": f"{stats['name']} hasn't won in their last {stats['recent_games']} games",
                "priority": 2
            })

    # 3. Rising star (big improvement in recent games vs overall)
    for pid, stats in player_stats.items():
        if stats["games"] >= 10 and stats["recent_games"] >= 5:
            overall_wr = stats["wins"] / stats["games"] * 100
            recent_wr = stats["recent_wins"] / stats["recent_games"] * 100
            if recent_wr - overall_wr >= 20:
                insights.append({
                    "type": "rising",
                    "icon": "trending-up",
                    "title": "On the Rise",
                    "description": f"{stats['name']} is playing hot! {recent_wr:.0f}% recent vs {overall_wr:.0f}% overall",
                    "priority": 3
                })

    # 4. Underdog wins (lowest ELO player won)
    # Check if any low-games player is winning
    for pid, stats in player_stats.items():
        if stats["games"] <= 5 and stats["wins"] >= 2:
            insights.append({
                "type": "underdog",
                "icon": "star",
                "title": "New Threat",
                "description": f"{stats['name']} has won {stats['wins']} of their first {stats['games']} games!",
                "priority": 2
            })

    # 5. Dominant player check
    total_games = len(matches)
    for pid, stats in player_stats.items():
        if stats["games"] >= 10:
            win_rate = stats["wins"] / stats["games"] * 100
            if win_rate >= 40:
                insights.append({
                    "type": "dominant",
                    "icon": "crown",
                    "title": "Pod Boss",
                    "description": f"{stats['name']} has a dominant {win_rate:.0f}% win rate over {stats['games']} games",
                    "priority": 4
                })

    # 6. Check for close competition
    win_rates = [(pid, stats["wins"] / stats["games"] * 100)
                 for pid, stats in player_stats.items()
                 if stats["games"] >= 5]
    if len(win_rates) >= 3:
        win_rates.sort(key=lambda x: x[1], reverse=True)
        top_rate = win_rates[0][1]
        second_rate = win_rates[1][1]
        if abs(top_rate - second_rate) <= 5:
            name1 = player_stats[win_rates[0][0]]["name"]
            name2 = player_stats[win_rates[1][0]]["name"]
            insights.append({
                "type": "rivalry",
                "icon": "swords",
                "title": "Tight Race",
                "description": f"{name1} and {name2} are neck-and-neck for first place!",
                "priority": 3
            })

    # 7. Game length insight
    durations = [m.duration_seconds for m in matches if m.duration_seconds]
    if len(durations) >= 5:
        recent_durations = [m.duration_seconds for m in recent_matches if m.duration_seconds]
        if recent_durations:
            avg_overall = sum(durations) / len(durations)
            avg_recent = sum(recent_durations) / len(recent_durations)
            if avg_recent > avg_overall * 1.2:
                insights.append({
                    "type": "duration",
                    "icon": "clock",
                    "title": "Longer Games",
                    "description": f"Recent games are running {((avg_recent - avg_overall) / avg_overall * 100):.0f}% longer than average",
                    "priority": 1
                })
            elif avg_recent < avg_overall * 0.8:
                insights.append({
                    "type": "duration",
                    "icon": "zap",
                    "title": "Quick Games",
                    "description": f"Recent games are finishing {((avg_overall - avg_recent) / avg_overall * 100):.0f}% faster than average",
                    "priority": 1
                })

    # Sort insights by priority (highest first)
    insights.sort(key=lambda x: x["priority"], reverse=True)

    # Calculate pod health metrics
    unique_winners = len(set(m.winner_player_id for m in matches))
    recent_winners = len(set(m.winner_player_id for m in recent_matches))

    # Variety score: unique winners in last 10 games as percentage of players
    total_recent_players = len(set(
        p.player_id for m in recent_matches for p in m.players
    ))
    variety_score = round(recent_winners / total_recent_players * 100) if total_recent_players > 0 else 0

    # Calculate underdog wins (player with fewer games winning)
    underdog_wins = 0
    for match in recent_matches:
        if match.winner_player_id:
            winner_games = player_stats[match.winner_player_id]["games"]
            avg_games = sum(player_stats[p.player_id]["games"] for p in match.players) / len(match.players)
            if winner_games < avg_games * 0.8:
                underdog_wins += 1

    pod_health = {
        "variety_score": variety_score,
        "unique_winners_recent": recent_winners,
        "unique_winners_total": unique_winners,
        "total_players": len(player_stats),
        "underdog_wins_recent": underdog_wins,
        "games_analyzed": len(recent_matches)
    }

    return {
        "insights": insights[:8],  # Limit to top 8 insights
        "pod_health": pod_health
    }


@router.get("/calendar")
async def get_play_frequency_calendar(
    current_player: Optional[Player] = Depends(get_optional_player)
) -> Dict[str, Any]:
    """
    Get play frequency data for a GitHub-style calendar heatmap.

    Returns game counts by date for the last 12 months.
    """
    if not current_player or not current_player.current_pod_id:
        return {"calendar": [], "stats": {}}

    matches = await Match.find(
        Match.pod_id == current_player.current_pod_id
    ).to_list()

    if not matches:
        return {"calendar": [], "stats": {}}

    # Group games by date
    games_by_date: Dict[str, int] = Counter()
    games_by_weekday: Dict[int, int] = Counter()
    games_by_month: Dict[str, int] = Counter()

    for match in matches:
        date_str = match.match_date.strftime("%Y-%m-%d")
        games_by_date[date_str] += 1
        games_by_weekday[match.match_date.weekday()] += 1
        games_by_month[match.match_date.strftime("%Y-%m")] += 1

    # Build calendar data (last 365 days)
    from datetime import timedelta
    today = datetime.now()
    calendar_data = []

    for i in range(365):
        date = today - timedelta(days=364-i)
        date_str = date.strftime("%Y-%m-%d")
        count = games_by_date.get(date_str, 0)
        calendar_data.append({
            "date": date_str,
            "count": count,
            "weekday": date.weekday(),
            "month": date.month
        })

    # Calculate stats
    weekday_names = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
    best_weekday = max(games_by_weekday.items(), key=lambda x: x[1]) if games_by_weekday else (0, 0)

    # Find longest gap between games
    sorted_dates = sorted(games_by_date.keys())
    longest_gap = 0
    if len(sorted_dates) >= 2:
        for i in range(1, len(sorted_dates)):
            d1 = datetime.strptime(sorted_dates[i-1], "%Y-%m-%d")
            d2 = datetime.strptime(sorted_dates[i], "%Y-%m-%d")
            gap = (d2 - d1).days
            if gap > longest_gap:
                longest_gap = gap

    # Current streak (days since last game)
    if sorted_dates:
        last_game = datetime.strptime(sorted_dates[-1], "%Y-%m-%d")
        days_since_last = (today - last_game).days
    else:
        days_since_last = None

    # Find busiest month
    busiest_month = max(games_by_month.items(), key=lambda x: x[1]) if games_by_month else (None, 0)

    stats = {
        "total_days_played": len(games_by_date),
        "total_games": len(matches),
        "best_weekday": weekday_names[best_weekday[0]] if games_by_weekday else None,
        "best_weekday_count": best_weekday[1],
        "longest_gap_days": longest_gap,
        "days_since_last_game": days_since_last,
        "busiest_month": busiest_month[0],
        "busiest_month_count": busiest_month[1],
        "avg_games_per_play_day": round(len(matches) / len(games_by_date), 1) if games_by_date else 0
    }

    return {
        "calendar": calendar_data,
        "stats": stats
    }
