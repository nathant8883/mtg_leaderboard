import { Snowflake } from 'lucide-react';
import type { PlayerEliminationStats } from '../../services/api';

interface ScoopShameProps {
  players: PlayerEliminationStats[];
}

// Fun labels for scoop rates
function getScoopLabel(scoopRate: number): string {
  if (scoopRate >= 50) return 'Tactical Retreat Expert';
  if (scoopRate >= 30) return 'Strategic Surrender';
  if (scoopRate >= 15) return 'Occasional Quitter';
  return 'Fights to the End';
}

function getScoopColor(scoopRate: number): string {
  if (scoopRate >= 50) return 'text-[#667eea]';
  if (scoopRate >= 30) return 'text-[#764ba2]';
  if (scoopRate >= 15) return 'text-[#909296]';
  return 'text-[#33D9B2]';
}

export function ScoopShame({ players }: ScoopShameProps) {
  // Filter to players with scoops and sort by scoop rate
  const scoopPlayers = players
    .filter(p => p.times_scooped > 0 || p.total_deaths > 0)
    .sort((a, b) => b.scoop_rate - a.scoop_rate)
    .slice(0, 8);

  if (scoopPlayers.length === 0) {
    return (
      <div className="text-center text-[#909296] text-sm py-4">
        Everyone fights to the death! No scoops recorded.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {scoopPlayers.map((player, index) => (
        <div
          key={player.player_id}
          className="flex items-center justify-between p-3 rounded-lg bg-[#141517] hover:bg-[#1A1B1E] transition-colors"
        >
          <div className="flex items-center gap-3">
            {/* Snowflake for high scoopers */}
            {player.scoop_rate >= 30 && (
              <Snowflake size={16} className="text-[#667eea] animate-pulse" />
            )}

            {/* Avatar */}
            {player.avatar ? (
              <img
                src={player.avatar}
                alt={player.player_name}
                className="w-9 h-9 rounded-full object-cover"
              />
            ) : (
              <div className="w-9 h-9 rounded-full bg-[#667eea]/20 flex items-center justify-center text-[#667eea] text-sm font-bold">
                {player.player_name.charAt(0).toUpperCase()}
              </div>
            )}

            {/* Name and Label */}
            <div>
              <div className="text-white font-medium text-sm">
                {player.player_name}
              </div>
              <div className={`text-xs ${getScoopColor(player.scoop_rate)}`}>
                {getScoopLabel(player.scoop_rate)}
              </div>
            </div>
          </div>

          {/* Scoop Stats */}
          <div className="text-right">
            <div className={`font-bold text-lg ${getScoopColor(player.scoop_rate)}`}>
              {player.scoop_rate.toFixed(0)}%
            </div>
            <div className="text-xs text-[#909296]">
              {player.times_scooped} / {player.total_deaths} losses
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
