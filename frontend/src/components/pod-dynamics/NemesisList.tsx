import { ArrowRight, Crosshair } from 'lucide-react';
import type { NemesisPair } from '../../services/api';

interface NemesisListProps {
  pairs: NemesisPair[];
}

export function NemesisList({ pairs }: NemesisListProps) {
  if (pairs.length === 0) {
    return (
      <div className="text-center text-[#909296] text-sm py-4">
        No rivalries established yet. Need more eliminations!
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {pairs.map((pair, index) => (
        <div
          key={`${pair.killer_id}-${pair.victim_id}`}
          className="p-3 rounded-lg bg-[#141517] hover:bg-[#1A1B1E] transition-colors"
        >
          <div className="flex items-center justify-between">
            {/* Killer */}
            <div className="flex items-center gap-2 flex-1 min-w-0">
              {pair.killer_avatar ? (
                <img
                  src={pair.killer_avatar}
                  alt={pair.killer_name}
                  className="w-10 h-10 rounded-full object-cover flex-shrink-0 ring-2 ring-[#FF6B6B]/50"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-[#FF6B6B]/20 flex items-center justify-center text-[#FF6B6B] font-bold flex-shrink-0 ring-2 ring-[#FF6B6B]/50">
                  {pair.killer_name.charAt(0).toUpperCase()}
                </div>
              )}
              <div className="min-w-0">
                <div className="text-white font-medium text-sm truncate">
                  {pair.killer_name}
                </div>
                <div className="text-xs text-[#FF6B6B]">
                  Hunter
                </div>
              </div>
            </div>

            {/* Arrow with Kill Count */}
            <div className="flex flex-col items-center px-3">
              <div className="flex items-center gap-1 text-[#C0392B]">
                <Crosshair size={14} />
                <span className="font-bold">{pair.kill_count}</span>
              </div>
              <ArrowRight size={20} className="text-[#909296]" />
              <div className="text-[10px] text-[#909296]">
                {pair.kill_rate.toFixed(0)}% rate
              </div>
            </div>

            {/* Victim */}
            <div className="flex items-center gap-2 flex-1 min-w-0 justify-end">
              <div className="min-w-0 text-right">
                <div className="text-white font-medium text-sm truncate">
                  {pair.victim_name}
                </div>
                <div className="text-xs text-[#909296]">
                  Prey
                </div>
              </div>
              {pair.victim_avatar ? (
                <img
                  src={pair.victim_avatar}
                  alt={pair.victim_name}
                  className="w-10 h-10 rounded-full object-cover flex-shrink-0 opacity-75"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-[#2C2E33] flex items-center justify-center text-[#909296] font-bold flex-shrink-0">
                  {pair.victim_name.charAt(0).toUpperCase()}
                </div>
              )}
            </div>
          </div>

          {/* Games Together */}
          <div className="text-center text-xs text-[#909296] mt-2 pt-2 border-t border-[#2C2E33]">
            {pair.games_together} games together
          </div>
        </div>
      ))}
    </div>
  );
}
