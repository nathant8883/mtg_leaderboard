import { useState, useEffect } from 'react';
import { leaderboardApi, type PlayerLeaderboardEntry } from '../services/api';

interface TopPlayersProps {
  onViewLeaderboard: () => void;
  onPlayerClick: (playerId: string) => void;
}

function TopPlayers({ onViewLeaderboard, onPlayerClick }: TopPlayersProps) {
  const [players, setPlayers] = useState<PlayerLeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTopPlayers();
  }, []);

  const loadTopPlayers = async () => {
    try {
      setLoading(true);
      const data = await leaderboardApi.getPlayerLeaderboard();
      setPlayers(data.slice(0, 3)); // Get top 3
    } catch (err) {
      console.error('Error loading top players:', err);
    } finally {
      setLoading(false);
    }
  };

  const getRankBadgeClass = (rank: number): string => {
    if (rank === 1) return 'rank-badge gold';
    if (rank === 2) return 'rank-badge silver';
    if (rank === 3) return 'rank-badge bronze';
    return 'rank-badge';
  };

  const getWinRateTier = (winRate: number): { class: string; letter: string; icon: string } => {
    if (winRate >= 0.35) return { class: 's-tier', letter: 'S', icon: '🏆' };
    if (winRate >= 0.28) return { class: 'a-tier', letter: 'A', icon: '⭐' };
    if (winRate >= 0.22) return { class: 'b-tier', letter: 'B', icon: '💎' };
    return { class: 'd-tier', letter: 'D', icon: '📉' };
  };

  if (loading) {
    return (
      <div className="card">
        <h2 className="card-title">Top Players</h2>
        <div className="loading-state">
          <div className="loading-spinner"></div>
          <p>Loading top players...</p>
        </div>
      </div>
    );
  }

  if (players.length === 0) {
    return (
      <div className="card">
        <h2 className="card-title">Top Players</h2>
        <div className="empty-state">
          <div className="empty-icon">🏆</div>
          <h3>No player data yet</h3>
          <p>Record some matches to see the top players!</p>
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="card-header">
        <h2 className="card-title">Top Players</h2>
        <button className="view-all-link" onClick={onViewLeaderboard}>
          View All
        </button>
      </div>

      {/* Desktop Table View */}
      <div className="leaderboard-table-container">
        <table className="leaderboard-table">
          <thead>
            <tr>
              <th>Rank</th>
              <th>Player</th>
              <th className="center">Record</th>
              <th className="center">Win Rate</th>
            </tr>
          </thead>
          <tbody>
            {players.map((player, index) => {
              const rank = index + 1;
              const tier = getWinRateTier(player.win_rate / 100);
              return (
                <tr key={player.player_id}>
                  <td>
                    <div className={getRankBadgeClass(rank)}>
                      {rank}
                    </div>
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div className="player-avatar-badge">
                        {player.player_name.charAt(0).toUpperCase()}
                      </div>
                      <span
                        className="player-name clickable"
                        onClick={() => onPlayerClick(player.player_id)}
                      >
                        {player.player_name}
                      </span>
                    </div>
                  </td>
                  <td className="center">
                    <span className="stat-value">{player.wins}-{player.losses}</span>
                  </td>
                  <td className="center">
                    <div className={`winrate-compact ${tier.class}`}>
                      <div className="tier-icon-compact">{tier.icon}</div>
                      <div className="winrate-info-compact">
                        <div className="tier-name-compact">{tier.letter} Tier</div>
                        <div className="winrate-value-compact">{player.win_rate.toFixed(1)}%</div>
                      </div>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile Card View */}
      <div className="player-cards-mobile">
        {players.map((player, index) => {
          const rank = index + 1;
          const tier = getWinRateTier(player.win_rate / 100);
          return (
            <div
              key={player.player_id}
              className="player-card-mobile"
              onClick={() => onPlayerClick(player.player_id)}
            >
              <div className={`player-card-rank ${getRankBadgeClass(rank)}`}>
                {rank}
              </div>
              <div className="player-card-avatar">
                {player.player_name.charAt(0).toUpperCase()}
              </div>
              <div className="player-card-info">
                <div className="player-card-name">{player.player_name}</div>
                <div className="player-card-record">{player.wins}-{player.losses}</div>
                <div className={`player-card-tier ${tier.class}`}>
                  {tier.icon} {tier.letter} TIER
                </div>
              </div>
              <div className={`player-card-winrate ${tier.class}`}>
                {player.win_rate.toFixed(0)}%
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default TopPlayers;
