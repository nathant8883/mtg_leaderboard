import { Crown } from 'lucide-react';
import type { PlayerEliminationStats } from '../../services/api';

const ARCHETYPE_CONFIG: Record<string, { color: string; bg: string; }> = {
  'Assassin':      { color: '#FF4444', bg: 'rgba(255, 68, 68, 0.15)' },
  'Kingmaker':     { color: '#FFD700', bg: 'rgba(255, 215, 0, 0.15)' },
  'Berserker':     { color: '#FF6B35', bg: 'rgba(255, 107, 53, 0.15)' },
  'Target':        { color: '#FF69B4', bg: 'rgba(255, 105, 180, 0.15)' },
  'Survivor':      { color: '#33D9B2', bg: 'rgba(51, 217, 178, 0.15)' },
  'Table Flipper': { color: '#9B59B6', bg: 'rgba(155, 89, 182, 0.15)' },
};

interface KillLeaderboardProps {
  players: PlayerEliminationStats[];
}

export function KillLeaderboard({ players }: KillLeaderboardProps) {
  // Filter to players with kills and sort by total kills
  const rankedPlayers = players
    .filter(p => p.total_kills > 0)
    .sort((a, b) => b.total_kills - a.total_kills)
    .slice(0, 10);

  if (rankedPlayers.length === 0) {
    return (
      <div className="text-center text-[#909296] text-sm py-4">
        No kills recorded yet!
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {rankedPlayers.map((player, index) => (
        <div
          key={player.player_id}
          className="flex items-center justify-between p-3 rounded-lg bg-[#141517] hover:bg-[#1A1B1E] transition-colors"
        >
          <div className="flex items-center gap-3">
            {/* Rank Badge */}
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
              index === 0
                ? 'bg-[#FFD700]/20 text-[#FFD700]'
                : index === 1
                ? 'bg-[#C0C0C0]/20 text-[#C0C0C0]'
                : index === 2
                ? 'bg-[#CD7F32]/20 text-[#CD7F32]'
                : 'bg-[#2C2E33] text-[#909296]'
            }`}>
              {index === 0 ? <Crown size={14} /> : index + 1}
            </div>

            {/* Avatar */}
            {player.avatar ? (
              <img
                src={player.avatar}
                alt={player.player_name}
                className="w-9 h-9 rounded-full object-cover"
              />
            ) : (
              <div className="w-9 h-9 rounded-full bg-[#FF6B6B]/20 flex items-center justify-center text-[#FF6B6B] text-sm font-bold">
                {player.player_name.charAt(0).toUpperCase()}
              </div>
            )}

            {/* Name and Stats */}
            <div className="flex flex-col gap-0.5">
              <div className="text-white font-medium text-sm">
                {player.player_name}
              </div>
              {player.archetype && (
                <span
                  className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-[4px] w-fit"
                  style={{
                    color: ARCHETYPE_CONFIG[player.archetype]?.color || '#888',
                    backgroundColor: ARCHETYPE_CONFIG[player.archetype]?.bg || 'rgba(136,136,136,0.15)',
                  }}
                >
                  {player.archetype}
                </span>
              )}
              <div className="text-xs text-[#909296]">
                {player.kill_rate.toFixed(1)} kills/game
              </div>
            </div>
          </div>

          {/* Kill Count */}
          <div className="text-right">
            <div className="text-[#FF6B6B] font-bold text-lg">
              {player.total_kills}
            </div>
            <div className="text-xs text-[#909296]">
              kills
            </div>
            <span className="text-[11px] text-[#888]">
              {player.kills_in_losses} in losses
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
