import { useState, useEffect } from 'react';
import { leaderboardApi, type PlayerLeaderboardEntry } from '../services/api';
import PlayerAvatar from './PlayerAvatar';

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

  const getRankBadgeStyles = (rank: number) => {
    const baseStyles = "inline-flex items-center justify-center w-9 h-9 rounded-[20px] font-bold text-base border";
    if (rank === 1) return `${baseStyles} bg-gradient-gold text-[#1A1B1E] shadow-gold border-[rgba(255,215,0,0.3)]`;
    if (rank === 2) return `${baseStyles} bg-gradient-silver text-[#1A1B1E] shadow-silver border-[rgba(192,192,192,0.3)]`;
    if (rank === 3) return `${baseStyles} bg-gradient-bronze text-white shadow-bronze border-[rgba(205,127,50,0.3)]`;
    return `${baseStyles} bg-card-border text-text-muted border-[rgba(255,255,255,0.15)]`;
  };

  const getWinRateTier = (winRate: number): { class: string; letter: string; icon: string; color: string } => {
    if (winRate >= 0.35) return { class: 's-tier', letter: 'S', icon: '🏆', color: 'text-tier-s' };
    if (winRate >= 0.28) return { class: 'a-tier', letter: 'A', icon: '⭐', color: 'text-tier-a' };
    if (winRate >= 0.22) return { class: 'b-tier', letter: 'B', icon: '💎', color: 'text-tier-b' };
    return { class: 'd-tier', letter: 'D', icon: '📉', color: 'text-tier-d' };
  };

  if (loading) {
    return (
      <div className="bg-gradient-card rounded-[12px] p-4 shadow-card">
        <h2 className="text-text-primary text-2xl font-semibold">Top Players</h2>
        <div className="text-center py-[60px] px-5">
          <div className="w-10 h-10 border-4 border-[#2C2E33] border-t-purple-start rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-text-muted text-sm">Loading top players...</p>
        </div>
      </div>
    );
  }

  if (players.length === 0) {
    return (
      <div className="bg-gradient-card rounded-[12px] p-4 shadow-card">
        <h2 className="text-text-primary text-2xl font-semibold">Top Players</h2>
        <div className="text-center py-[60px] px-5">
          <div className="text-6xl mb-4">🏆</div>
          <h3 className="text-white text-xl mb-2">No player data yet</h3>
          <p className="text-text-muted text-sm">Record some matches to see the top players!</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gradient-card rounded-[12px] p-4 shadow-[0_2px_4px_rgba(0,0,0,0.2)]">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-white text-2xl font-semibold m-0">Top Players</h2>
        <button
          className="bg-transparent border-none text-[#667eea] text-sm font-semibold cursor-pointer px-2 py-1 rounded-md flex items-center gap-1.5 transition-all hover:bg-[rgba(102,126,234,0.1)] hover:text-[#764ba2] after:content-['›'] after:text-lg after:transition-transform hover:after:translate-x-0.5"
          onClick={onViewLeaderboard}
        >
          View All
        </button>
      </div>

      {/* Desktop Table View */}
      <div className="overflow-x-auto mt-6 hidden md:block">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className="text-text-muted text-xs font-semibold p-3 text-left uppercase border-b border-[#2C2E33]">Rank</th>
              <th className="text-text-muted text-xs font-semibold p-3 text-left uppercase border-b border-[#2C2E33]">Player</th>
              <th className="text-text-muted text-xs font-semibold p-3 text-center uppercase border-b border-[#2C2E33]">Record</th>
              <th className="text-text-muted text-xs font-semibold p-3 text-center uppercase border-b border-[#2C2E33]">Win Rate</th>
            </tr>
          </thead>
          <tbody>
            {players.map((player, index) => {
              const rank = index + 1;
              const tier = getWinRateTier(player.win_rate / 100);
              return (
                <tr key={player.player_id} className="transition-all hover:bg-hover-bg">
                  <td className="py-4 px-3 border-b border-[#2C2E33]">
                    <div className={getRankBadgeStyles(rank)}>
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
                        className="text-white font-medium text-[15px] cursor-pointer transition-all hover:text-purple-start"
                        onClick={() => onPlayerClick(player.player_id)}
                      >
                        {player.player_name}
                      </span>
                    </div>
                  </td>
                  <td className="py-4 px-3 border-b border-[#2C2E33] text-center">
                    <span className="text-text-secondary font-medium text-[15px]">{player.wins}-{player.losses}</span>
                  </td>
                  <td className="py-4 px-3 border-b border-[#2C2E33] text-center">
                    <div className={`inline-flex items-center gap-3 px-3 py-2 rounded-[8px] bg-gradient-compact border border-[#2C2E33] transition-all ${tier.class} hover:border-[var(--tier-color)] hover:shadow-card-hover`}>
                      <div className="w-9 h-9 rounded-[8px] bg-[linear-gradient(135deg,var(--tier-color),var(--tier-color-light))] flex items-center justify-center text-lg flex-shrink-0">
                        {tier.icon}
                      </div>
                      <div className="text-left">
                        <div className="text-[10px] text-text-muted uppercase font-semibold mb-0.5 tracking-wider">{tier.letter} Tier</div>
                        <div className={`text-lg font-bold ${tier.color}`}>{player.win_rate.toFixed(1)}%</div>
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
      <div className="flex flex-col gap-3 md:hidden">
        {players.map((player, index) => {
          const rank = index + 1;
          const tier = getWinRateTier(player.win_rate / 100);
          const tierBgClass = tier.class === 's-tier' ? 'bg-[rgba(255,215,0,0.15)] text-tier-s border-[rgba(255,215,0,0.15)]' :
                             tier.class === 'a-tier' ? 'bg-[rgba(51,217,178,0.15)] text-tier-a border-[rgba(51,217,178,0.15)]' :
                             tier.class === 'b-tier' ? 'bg-[rgba(79,172,254,0.15)] text-tier-b border-[rgba(79,172,254,0.15)]' :
                             'bg-[rgba(255,107,107,0.15)] text-tier-d border-[rgba(255,107,107,0.15)]';

          return (
            <div
              key={player.player_id}
              className="flex items-center gap-3 bg-[linear-gradient(135deg,#25262B_0%,#27282D_100%)] border border-[#2C2E33] rounded-[12px] p-4 cursor-pointer transition-all active:scale-[0.98] active:bg-[linear-gradient(135deg,#2C2E33_0%,#2E2F34_100%)]"
              onClick={() => onPlayerClick(player.player_id)}
            >
              <div className={`flex-shrink-0 ${getRankBadgeStyles(rank)}`}>
                {rank}
              </div>
              <PlayerAvatar
                playerName={player.player_name}
                customAvatar={player.custom_avatar}
                picture={player.picture}
                size="medium"
              />
              <div className="flex-1 min-w-0">
                <div className="text-base font-semibold text-white mb-1">{player.player_name}</div>
                <div className="text-xs text-text-muted mb-1 opacity-70">{player.wins}-{player.losses}</div>
                <div className={`text-[11px] font-semibold uppercase tracking-wide py-1 px-2.5 rounded-[20px] inline-block border ${tierBgClass}`}>
                  {tier.icon} {tier.letter} TIER
                </div>
              </div>
              <div className={`text-2xl font-bold flex-shrink-0 ml-auto ${tier.color}`}>
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
