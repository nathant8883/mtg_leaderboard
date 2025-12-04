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

    // Listen for pod switch events to refresh data
    const handlePodSwitch = () => {
      loadTopPlayers();
    };

    window.addEventListener('podSwitched', handlePodSwitch);
    return () => {
      window.removeEventListener('podSwitched', handlePodSwitch);
    };
  }, []);

  const loadTopPlayers = async () => {
    try {
      setLoading(true);
      const data = await leaderboardApi.getPlayerLeaderboard();
      // Only show ranked players (4+ games) on the dashboard
      setPlayers(data.filter(p => p.ranked).slice(0, 3));
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

  const getRankBadgeStylesSmall = (rank: number) => {
    const baseStyles = 'inline-flex items-center justify-center w-7 h-7 rounded-full font-bold text-sm border shadow-[0_2px_4px_rgba(0,0,0,0.5)]';
    if (rank === 1) return `${baseStyles} bg-gradient-gold text-[#1A1B1E] border-[rgba(255,215,0,0.3)]`;
    if (rank === 2) return `${baseStyles} bg-gradient-silver text-[#1A1B1E] border-[rgba(192,192,192,0.3)]`;
    if (rank === 3) return `${baseStyles} bg-gradient-bronze text-white border-[rgba(205,127,50,0.3)]`;
    return `${baseStyles} bg-[#2C2E33] text-[#909296] border-[rgba(255,255,255,0.15)]`;
  };

  // Get all player Elos for percentile calculation
  const rankedElos = players
    .filter(p => p.elo)
    .map(p => p.elo!)
    .sort((a, b) => b - a);

  const getEloTier = (elo: number | undefined): { class: string; letter: string; icon: string; color: string; eloColor: string } => {
    if (!elo || rankedElos.length === 0) {
      return { class: 'd-tier', letter: 'D', icon: '📉', color: 'text-tier-d', eloColor: 'text-[#FF6B6B]' };
    }

    // Find position in sorted Elos (handle ties by finding first occurrence)
    const position = rankedElos.findIndex(e => e <= elo);
    const percentile = position === -1 ? 1 : position / rankedElos.length;

    // Top 25% = S, 25-50% = A, 50-75% = B, Bottom 25% = D
    if (percentile < 0.25) return { class: 's-tier', letter: 'S', icon: '🏆', color: 'text-tier-s', eloColor: 'text-[#FFD700]' };
    if (percentile < 0.50) return { class: 'a-tier', letter: 'A', icon: '⭐', color: 'text-tier-a', eloColor: 'text-[#33D9B2]' };
    if (percentile < 0.75) return { class: 'b-tier', letter: 'B', icon: '💎', color: 'text-tier-b', eloColor: 'text-[#4FACFE]' };
    return { class: 'd-tier', letter: 'D', icon: '📉', color: 'text-tier-d', eloColor: 'text-[#FF6B6B]' };
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
              <th className="text-text-muted text-xs font-semibold p-3 text-center uppercase border-b border-[#2C2E33]">Elo</th>
              <th className="text-text-muted text-xs font-semibold p-3 text-center uppercase border-b border-[#2C2E33]">Record</th>
              <th className="text-text-muted text-xs font-semibold p-3 text-center uppercase border-b border-[#2C2E33]">Tier</th>
            </tr>
          </thead>
          <tbody>
            {players.map((player, index) => {
              const rank = index + 1;
              const tier = getEloTier(player.elo);
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
                    {player.elo ? (
                      <div className="flex items-center justify-center gap-2">
                        <span className="text-[#667eea] font-bold text-xl">{player.elo}</span>
                        {player.elo_change !== undefined && player.elo_change !== 0 && (
                          <span className={`text-[11px] font-semibold px-1.5 py-0.5 rounded-full ${player.elo_change > 0 ? 'text-[#33D9B2] bg-[rgba(51,217,178,0.15)]' : 'text-[#FF6B6B] bg-[rgba(255,107,107,0.15)]'}`}>
                            {player.elo_change > 0 ? '+' : ''}{player.elo_change.toFixed(0)}
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-text-muted">-</span>
                    )}
                  </td>
                  <td className="py-4 px-3 border-b border-[#2C2E33] text-center">
                    <span className="text-text-secondary font-medium text-[15px]">
                      {player.wins}-{player.losses} <span className="text-text-muted">({player.win_rate.toFixed(0)}%)</span>
                    </span>
                  </td>
                  <td className="py-4 px-3 border-b border-[#2C2E33] text-center">
                    <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[6px] ${tier.class}`}>
                      <span className="text-sm">{tier.icon}</span>
                      <span className="text-sm font-bold text-white">{tier.letter}</span>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile Card View */}
      <div className="flex flex-col gap-4 md:hidden">
        {players.map((player, index) => {
          const rank = index + 1;
          const tier = getEloTier(player.elo);
          const tierBgClass = tier.class === 's-tier' ? 'bg-[rgba(255,215,0,0.15)] border-[rgba(255,215,0,0.3)]' :
                             tier.class === 'a-tier' ? 'bg-[rgba(51,217,178,0.15)] border-[rgba(51,217,178,0.3)]' :
                             tier.class === 'b-tier' ? 'bg-[rgba(79,172,254,0.15)] border-[rgba(79,172,254,0.3)]' :
                             'bg-[rgba(255,107,107,0.15)] border-[rgba(255,107,107,0.3)]';

          return (
            <div
              key={player.player_id}
              className="flex items-stretch gap-3 bg-[linear-gradient(135deg,#25262B_0%,#27282D_100%)] border border-[#2C2E33] rounded-[12px] p-4 cursor-pointer transition-all active:scale-[0.98] active:bg-[linear-gradient(135deg,#2C2E33_0%,#2E2F34_100%)]"
              onClick={() => onPlayerClick(player.player_id)}
            >
              {/* Avatar with rank badge overlay */}
              <div className="relative flex-shrink-0">
                <PlayerAvatar
                  playerName={player.player_name}
                  customAvatar={player.custom_avatar}
                  picture={player.picture}
                  size="large"
                  className="!w-16 !h-16"
                />
                <div className={`absolute -top-2 -left-2 ${getRankBadgeStylesSmall(rank)}`}>
                  {rank}
                </div>
              </div>

              {/* Content area */}
              <div className="flex-1 min-w-0 flex gap-2">
                {/* Left column - name and record */}
                <div className="flex-1 min-w-0 flex flex-col justify-center gap-0.5">
                  <div className="text-base font-semibold text-white whitespace-nowrap">{player.player_name}</div>
                  <div className="text-xs text-text-muted mt-1.5">{player.wins}-{player.losses} ({player.win_rate.toFixed(0)}%)</div>
                </div>

                {/* Right column - Elo and tier */}
                <div className="flex flex-col items-center justify-center flex-shrink-0 pl-2 ml-auto">
                  {player.elo ? (
                    <>
                      <div className="flex items-center gap-1.5">
                        <span className={`font-bold text-2xl ${tier.eloColor}`}>{player.elo}</span>
                        {player.elo_change !== undefined && player.elo_change !== 0 && (
                          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${player.elo_change > 0 ? 'text-[#33D9B2] bg-[rgba(51,217,178,0.15)]' : 'text-[#FF6B6B] bg-[rgba(255,107,107,0.15)]'}`}>
                            {player.elo_change > 0 ? '+' : ''}{player.elo_change.toFixed(0)}
                          </span>
                        )}
                      </div>
                      <div className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full border text-white ${tierBgClass}`}>
                        {tier.icon} {tier.letter} Tier
                      </div>
                    </>
                  ) : (
                    <span className="text-text-muted text-2xl">-</span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default TopPlayers;
