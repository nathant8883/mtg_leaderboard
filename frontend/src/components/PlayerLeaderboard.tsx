import type { PlayerLeaderboardEntry } from '../services/api';

interface PlayerLeaderboardProps {
  players: PlayerLeaderboardEntry[];
  loading?: boolean;
}

function PlayerLeaderboard({ players, loading = false }: PlayerLeaderboardProps) {
  const getRankBadgeClass = (rank: number): string => {
    if (rank === 1) return 'rank-badge gold';
    if (rank === 2) return 'rank-badge silver';
    if (rank === 3) return 'rank-badge bronze';
    return 'rank-badge';
  };

  const getWinRateTier = (winRate: number): { class: string; letter: string; icon: string } => {
    // S-Tier: 35%+ (too strong)
    if (winRate >= 0.35) return { class: 's-tier', letter: 'S', icon: '🏆' };
    // A-Tier: 28-35% (above baseline)
    if (winRate >= 0.28) return { class: 'a-tier', letter: 'A', icon: '⭐' };
    // B-Tier: 22-28% (balanced, around 25% baseline)
    if (winRate >= 0.22) return { class: 'b-tier', letter: 'B', icon: '💎' };
    // D-Tier: Below 22% (underperforming)
    return { class: 'd-tier', letter: 'D', icon: '📉' };
  };

  if (loading) {
    return (
      <div className="loading-state">
        <div className="loading-spinner"></div>
        <p>Loading player leaderboard...</p>
      </div>
    );
  }

  if (players.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-icon">🏆</div>
        <h3>No player data yet</h3>
        <p>Record some matches to see the leaderboard!</p>
      </div>
    );
  }

  return (
    <div className="leaderboard-table-container">
      <table className="leaderboard-table">
        <thead>
          <tr>
            <th>Rank</th>
            <th>Player</th>
            <th className="center">Games</th>
            <th className="center">Wins</th>
            <th className="center">Losses</th>
            <th className="center">Win Rate</th>
          </tr>
        </thead>
        <tbody>
          {players.map((player, index) => {
            const rank = index + 1;
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
                    <span className="player-name">{player.player_name}</span>
                  </div>
                </td>
                <td className="center">
                  <span className="stat-value">{player.games_played}</span>
                </td>
                <td className="center">
                  <span className="stat-value">{player.wins}</span>
                </td>
                <td className="center">
                  <span className="stat-value">{player.losses}</span>
                </td>
                <td className="center">
                  {(() => {
                    const tier = getWinRateTier(player.win_rate / 100);
                    return (
                      <div className={`winrate-compact ${tier.class}`}>
                        <div className="tier-icon-compact">{tier.icon}</div>
                        <div className="winrate-info-compact">
                          <div className="tier-name-compact">{tier.letter} Tier</div>
                          <div className="winrate-value-compact">{player.win_rate.toFixed(1)}%</div>
                        </div>
                      </div>
                    );
                  })()}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default PlayerLeaderboard;
