import { Flame, Zap, Skull } from 'lucide-react';
import type { KillStreak } from '../../services/api';

interface KillStreakHighlightsProps {
  streaks: KillStreak[];
}

// Fun labels for kill streaks
function getStreakLabel(kills: number): { label: string; color: string; icon: React.ReactNode } {
  if (kills >= 4) {
    return {
      label: 'RAMPAGE!',
      color: 'text-[#FF6B6B]',
      icon: <Flame size={16} className="text-[#FF6B6B] animate-pulse" />
    };
  }
  if (kills === 3) {
    return {
      label: 'Triple Kill',
      color: 'text-[#FFA500]',
      icon: <Zap size={16} className="text-[#FFA500]" />
    };
  }
  return {
    label: 'Double Kill',
    color: 'text-[#FFD700]',
    icon: <Skull size={16} className="text-[#FFD700]" />
  };
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function KillStreakHighlights({ streaks }: KillStreakHighlightsProps) {
  if (streaks.length === 0) {
    return (
      <div className="text-center text-[#909296] text-sm py-4">
        No multi-kill games recorded yet!
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {streaks.map((streak, _index) => {
        const { label, color, icon } = getStreakLabel(streak.kills_in_game);

        return (
          <div
            key={`${streak.match_id}-${streak.player_id}`}
            className="p-3 rounded-lg bg-[#141517] hover:bg-[#1A1B1E] transition-colors"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-3">
                {/* Avatar */}
                {streak.avatar ? (
                  <img
                    src={streak.avatar}
                    alt={streak.player_name}
                    className="w-10 h-10 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-[#FFA500]/20 flex items-center justify-center text-[#FFA500] font-bold">
                    {streak.player_name.charAt(0).toUpperCase()}
                  </div>
                )}

                <div>
                  <div className="text-white font-medium text-sm">
                    {streak.player_name}
                  </div>
                  <div className={`flex items-center gap-1 text-xs ${color}`}>
                    {icon}
                    <span className="font-bold">{label}</span>
                  </div>
                </div>
              </div>

              {/* Kill Count */}
              <div className="text-right">
                <div className={`font-bold text-2xl ${color}`}>
                  {streak.kills_in_game}
                </div>
                <div className="text-xs text-[#909296]">
                  kills
                </div>
              </div>
            </div>

            {/* Victims */}
            <div className="mt-2 pt-2 border-t border-[#2C2E33]">
              <div className="text-xs text-[#909296] mb-1">Victims:</div>
              <div className="flex flex-wrap gap-1">
                {streak.victims.map((victim, vIndex) => (
                  <span
                    key={vIndex}
                    className="px-2 py-0.5 bg-[#2C2E33] rounded text-xs text-[#909296]"
                  >
                    {victim}
                  </span>
                ))}
              </div>
              <div className="text-[10px] text-[#909296] mt-2">
                {formatDate(streak.match_date)}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
