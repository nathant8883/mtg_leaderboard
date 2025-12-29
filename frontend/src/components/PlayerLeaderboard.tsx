import type { PlayerLeaderboardEntry } from '../services/api';
import PlayerAvatar from './PlayerAvatar';
import TierBadge from './TierBadge';
import { getEloTier } from '../utils/tierConfig';

const MIN_GAMES_FOR_RANKING = 4;

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

  // Get all ranked player Elos for percentile calculation
  const rankedElos = players
    .filter(p => p.ranked && p.elo)
    .map(p => p.elo!)
    .sort((a, b) => b - a);

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
            <th className="text-[#909296] text-xs font-semibold py-3 px-3 text-center uppercase border-b border-[#2C2E33]">Elo</th>
            <th className="text-[#909296] text-xs font-semibold py-3 px-3 text-center uppercase border-b border-[#2C2E33]">Record</th>
            <th className="text-[#909296] text-xs font-semibold py-3 px-3 text-center uppercase border-b border-[#2C2E33]">Tier</th>
          </tr>
        </thead>
        <tbody>
          {(() => {
            let rankedCount = 0;
            return players.map((player) => {
              const isRanked = player.ranked;
              if (isRanked) rankedCount++;
              const rank = isRanked ? rankedCount : null;
              const gamesNeeded = MIN_GAMES_FOR_RANKING - player.games_played;

              return (
                <tr key={player.player_id} className={`transition-all duration-200 hover:bg-[#25262B] ${!isRanked ? 'opacity-60' : ''}`}>
                  <td className="py-4 px-3 border-b border-[#2C2E33]">
                    {isRanked && rank ? (
                      <div className={getRankBadgeClass(rank)}>
                        {rank}
                      </div>
                    ) : (
                      <div className="rank-badge bg-[#2C2E33] text-[#909296]">
                        —
                      </div>
                    )}
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
                    {player.elo ? (
                      <div className="flex items-center justify-center gap-2">
                        <span className="text-[#667eea] font-bold text-xl">{player.elo}</span>
                        {player.elo_change !== undefined && player.elo_change !== 0 && (
                          <span className={`text-xs font-medium ${player.elo_change > 0 ? 'text-[#33D9B2]' : 'text-[#FF6B6B]'}`}>
                            {player.elo_change > 0 ? '+' : ''}{player.elo_change.toFixed(0)}
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-[#909296]">-</span>
                    )}
                  </td>
                  <td className="py-4 px-3 border-b border-[#2C2E33] text-center">
                    <span className="text-[#C1C2C5] font-medium text-[15px]">
                      {player.wins}-{player.losses} <span className="text-[#909296]">({player.win_rate.toFixed(0)}%)</span>
                    </span>
                  </td>
                  <td className="py-4 px-3 border-b border-[#2C2E33] text-center">
                    {isRanked ? (
                      <TierBadge tier={getEloTier(player.elo, rankedElos)} size="md" />
                    ) : (
                      <div className="text-center">
                        <div className="text-[10px] text-[#909296] uppercase font-semibold tracking-[0.5px]">+{gamesNeeded} game{gamesNeeded !== 1 ? 's' : ''}</div>
                      </div>
                    )}
                  </td>
                </tr>
              );
            });
          })()}
        </tbody>
      </table>
    </div>
  );
}

export default PlayerLeaderboard;
