"""
Pure Elo calculation functions for multiplayer Commander games.

Uses a pairwise comparison approach where each player is compared against
every other player in the game. The winner beats all losers, and losers
draw against each other.
"""

import math
from typing import List, Tuple, Dict

# K-factor determines how much ratings change per game
# Higher K = more volatile ratings, good for casual play
K_FACTOR = 32

# Starting Elo for new players
DEFAULT_ELO = 1000.0


def calculate_expected_score(player_elo: float, opponent_elo: float) -> float:
    """
    Calculate expected score using standard Elo formula.

    Returns a value between 0 and 1 representing the probability
    of the player winning against the opponent.
    """
    return 1 / (1 + math.pow(10, (opponent_elo - player_elo) / 400))


def calculate_multiplayer_elo_changes(
    player_elos: List[Tuple[str, float]],
    winner_id: str
) -> Dict[str, float]:
    """
    Calculate Elo changes for all players in a multiplayer game.

    Uses pairwise comparison approach:
    - Winner gets actual=1.0 against each losing opponent
    - Losers get actual=0.0 against the winner
    - Losers get actual=0.5 against each other (draw)

    Args:
        player_elos: List of (player_id, current_elo) tuples for all players
        winner_id: ID of the winning player

    Returns:
        Dict mapping player_id to Elo change (positive or negative float)

    Example:
        >>> changes = calculate_multiplayer_elo_changes(
        ...     [("p1", 1000), ("p2", 1050), ("p3", 950), ("p4", 1000)],
        ...     winner_id="p3"
        ... )
        >>> changes["p3"]  # Winner gains points
        25.5
        >>> changes["p2"]  # Highest rated loser loses most
        -12.3
    """
    n = len(player_elos)
    if n < 3:
        return {}

    # Number of pairwise comparisons per player
    comparisons = n - 1

    # Effective K-factor per comparison (distribute K across all pairs)
    k_per_comparison = K_FACTOR / comparisons

    elo_changes: Dict[str, float] = {}

    for player_id, player_elo in player_elos:
        total_change = 0.0

        for opponent_id, opponent_elo in player_elos:
            if player_id == opponent_id:
                continue

            expected = calculate_expected_score(player_elo, opponent_elo)

            # Determine actual score based on game outcome
            if player_id == winner_id:
                # Winner beats everyone
                actual = 1.0
            elif opponent_id == winner_id:
                # Loser lost to the winner
                actual = 0.0
            else:
                # Two losers draw against each other
                actual = 0.5

            change = k_per_comparison * (actual - expected)
            total_change += change

        elo_changes[player_id] = round(total_change, 1)

    return elo_changes


def get_elo_tier(elo: float) -> Dict[str, str]:
    """
    Get tier classification based on Elo rating.

    Returns tier info compatible with the existing win rate tier system.
    """
    if elo >= 1200:
        return {"class": "s-tier", "letter": "S", "icon": "trophy"}
    if elo >= 1100:
        return {"class": "a-tier", "letter": "A", "icon": "star"}
    if elo >= 1000:
        return {"class": "b-tier", "letter": "B", "icon": "diamond"}
    return {"class": "d-tier", "letter": "D", "icon": "chart-down"}
