import { Crown } from 'lucide-react';
import type { PlayerEliminationStats } from '../../services/api';

const ARCHETYPE_CONFIG: Record<string, { color: string; bg: string; icon: string }> = {
  'Assassin':      { color: '#FF4444', bg: 'rgba(255, 68, 68, 0.12)',   icon: '🗡️' },
  'Kingmaker':     { color: '#FFD700', bg: 'rgba(255, 215, 0, 0.12)',   icon: '👑' },
  'Warlord':       { color: '#C0392B', bg: 'rgba(192, 57, 43, 0.12)',   icon: '⚔️' },
  'Berserker':     { color: '#FF6B35', bg: 'rgba(255, 107, 53, 0.12)',  icon: '🔥' },
  'Target':        { color: '#FF69B4', bg: 'rgba(255, 105, 180, 0.12)', icon: '🎯' },
  'Survivor':      { color: '#33D9B2', bg: 'rgba(51, 217, 178, 0.12)',  icon: '🛡️' },
  'Table Flipper': { color: '#9B59B6', bg: 'rgba(155, 89, 182, 0.12)',  icon: '🪑' },
};

const DEFAULT_ARCHETYPE = { color: '#888', bg: 'rgba(136,136,136,0.1)', icon: '' };

interface KillLeaderboardProps {
  players: PlayerEliminationStats[];
}

export function KillLeaderboard({ players }: KillLeaderboardProps) {
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
      {rankedPlayers.map((player, index) => {
        const isTop3 = index < 3;
        const cfg = ARCHETYPE_CONFIG[player.archetype] || DEFAULT_ARCHETYPE;

        return (
          <div
            key={player.player_id}
            className="relative flex items-center gap-3 rounded-[10px] overflow-hidden"
            style={{
              background: isTop3
                ? `linear-gradient(135deg, ${cfg.bg} 0%, #141517 60%)`
                : '#141517',
              padding: isTop3 ? '14px 14px 14px 0' : '10px 12px 10px 0',
            }}
          >
            {/* Left accent bar */}
            <div
              className="self-stretch rounded-l-[10px] flex-shrink-0"
              style={{
                width: isTop3 ? 4 : 3,
                backgroundColor: cfg.color,
                opacity: isTop3 ? 1 : 0.5,
              }}
            />

            {/* Rank */}
            <div
              className="flex-shrink-0 flex items-center justify-center font-bold"
              style={{
                width: isTop3 ? 28 : 24,
                height: isTop3 ? 28 : 24,
                fontSize: isTop3 ? 14 : 12,
                color: index === 0 ? '#FFD700' : index === 1 ? '#C0C0C0' : index === 2 ? '#CD7F32' : '#555',
              }}
            >
              {index === 0 ? <Crown size={16} /> : index + 1}
            </div>

            {/* Avatar */}
            <div
              className="flex-shrink-0 rounded-full overflow-hidden"
              style={{
                width: isTop3 ? 44 : 36,
                height: isTop3 ? 44 : 36,
                boxShadow: '0 0 0 1px rgba(255,255,255,0.08)',
              }}
            >
              {player.avatar ? (
                <img
                  src={player.avatar}
                  alt={player.player_name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div
                  className="w-full h-full flex items-center justify-center font-bold"
                  style={{
                    backgroundColor: cfg.bg,
                    color: cfg.color,
                    fontSize: isTop3 ? 16 : 13,
                  }}
                >
                  {player.player_name.charAt(0).toUpperCase()}
                </div>
              )}
            </div>

            {/* Name + Badge + Stats */}
            <div className="flex-1 min-w-0">
              <div
                className="text-white font-semibold truncate"
                style={{
                  fontSize: isTop3 ? 16 : 14,
                  lineHeight: 1.2,
                }}
              >
                {player.player_name}
              </div>

              {player.archetype && (
                <span
                  className="inline-flex items-center gap-1 mt-0.5 text-[11px] font-bold uppercase tracking-wider px-2 py-[2px] rounded-[4px] leading-none"
                  style={{
                    color: cfg.color,
                    backgroundColor: cfg.bg,
                  }}
                >
                  <span className="text-[11px] leading-none" style={{ verticalAlign: 'middle' }}>{cfg.icon}</span>
                  {player.archetype}
                </span>
              )}

            </div>

            {/* Kill count + secondary stats */}
            <div className="flex-shrink-0 text-right pr-1">
              <div
                className="font-bold leading-none"
                style={{
                  fontSize: isTop3 ? 28 : 22,
                  color: cfg.color,
                }}
              >
                {player.total_kills}
              </div>
              <div className="text-[10px] text-[#555] uppercase tracking-wide">kills</div>
              <div className="flex items-center justify-end gap-2 mt-0.5 text-[10px] text-[#555]">
                <span>{player.kill_rate.toFixed(1)}/game</span>
                <span>{player.kills_in_losses} in L</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
