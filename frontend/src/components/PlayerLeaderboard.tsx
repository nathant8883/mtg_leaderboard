import type { PlayerLeaderboardEntry } from '../services/api';
import PlayerAvatar from './PlayerAvatar';

interface PlayerLeaderboardProps {
  players: PlayerLeaderboardEntry[];
  loading?: boolean;
  onPlayerClick: (playerId: string) => void;
}

function PlayerLeaderboard({ players, loading = false, onPlayerClick }: PlayerLeaderboardProps) {
  const getRankBadgeClass = (rank: number): string => {
    const baseClass = 'rank-badge';
    if (rank === 1) return `${baseClass} rank-badge-gold`;
    if (rank === 2) return `${baseClass} rank-badge-silver`;
    if (rank === 3) return `${baseClass} rank-badge-bronze`;
    return baseClass;
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
      <div className="text-center py-[60px] px-5">
        <div className="loading-spinner"></div>
        <p className="text-[#909296] text-sm">Loading player leaderboard...</p>
      </div>
    );
  }

  if (players.length === 0) {
    return (
      <div className="text-center py-[60px] px-5">
        <div className="text-[64px] mb-4">🏆</div>
        <h3 className="text-white text-xl mb-2">No player data yet</h3>
        <p className="text-[#909296] text-sm">Record some matches to see the leaderboard!</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto mt-6">
      <table className="w-full border-collapse">
        <thead>
          <tr>
            <th className="text-[#909296] text-xs font-semibold py-3 px-3 text-left uppercase border-b border-[#2C2E33]">Rank</th>
            <th className="text-[#909296] text-xs font-semibold py-3 px-3 text-left uppercase border-b border-[#2C2E33]">Player</th>
            <th className="text-[#909296] text-xs font-semibold py-3 px-3 text-center uppercase border-b border-[#2C2E33]">Games</th>
            <th className="text-[#909296] text-xs font-semibold py-3 px-3 text-center uppercase border-b border-[#2C2E33]">Wins</th>
            <th className="text-[#909296] text-xs font-semibold py-3 px-3 text-center uppercase border-b border-[#2C2E33]">Losses</th>
            <th className="text-[#909296] text-xs font-semibold py-3 px-3 text-center uppercase border-b border-[#2C2E33]">Win Rate</th>
          </tr>
        </thead>
        <tbody>
          {players.map((player, index) => {
            const rank = index + 1;
            return (
              <tr key={player.player_id} className="transition-all duration-200 hover:bg-[#25262B]">
                <td className="py-4 px-3 border-b border-[#2C2E33]">
                  <div className={getRankBadgeClass(rank)}>
                    {rank}
                  </div>
                </td>
                <td className="py-4 px-3 border-b border-[#2C2E33]">
                  <div className="flex items-center gap-3">
                    <PlayerAvatar
                      playerName={player.player_name}
                      customAvatar={player.custom_avatar}
                      picture={player.picture}
                      size="small"
                    />
                    <span
                      className="text-white font-medium text-[15px] player-name-clickable"
                      onClick={() => onPlayerClick(player.player_id)}
                    >
                      {player.player_name}
                    </span>
                  </div>
                </td>
                <td className="py-4 px-3 border-b border-[#2C2E33] text-center">
                  <span className="text-[#C1C2C5] font-medium text-[15px]">{player.games_played}</span>
                </td>
                <td className="py-4 px-3 border-b border-[#2C2E33] text-center">
                  <span className="text-[#C1C2C5] font-medium text-[15px]">{player.wins}</span>
                </td>
                <td className="py-4 px-3 border-b border-[#2C2E33] text-center">
                  <span className="text-[#C1C2C5] font-medium text-[15px]">{player.losses}</span>
                </td>
                <td className="py-4 px-3 border-b border-[#2C2E33] text-center">
                  {(() => {
                    const tier = getWinRateTier(player.win_rate / 100);
                    return (
                      <div className={`winrate-compact ${tier.class}`}>
                        <div className="tier-icon-compact">{tier.icon}</div>
                        <div className="text-left">
                          <div className="text-[10px] text-[#909296] uppercase font-semibold mb-[2px] tracking-[0.5px]">{tier.letter} Tier</div>
                          <div className="text-lg font-bold text-white">{player.win_rate.toFixed(1)}%</div>
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
