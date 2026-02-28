import { Crosshair } from 'lucide-react';
import type { FirstBloodEntry } from '../../services/api';

interface FirstBloodProps {
  leaders: FirstBloodEntry[];
}

export default function FirstBlood({ leaders }: FirstBloodProps) {
  if (!leaders || leaders.length === 0) {
    return null;
  }

  return (
    <div className="mt-6">
      <div className="flex items-center gap-2 mb-4">
        <Crosshair className="w-5 h-5 text-red-500" />
        <h3 className="text-lg font-bold text-white">First Blood</h3>
        <span className="text-[11px] text-[#888] ml-1">Who strikes first</span>
      </div>

      <div className="space-y-2">
        {leaders.map((player, index) => (
          <div
            key={player.player_id}
            className="flex items-center gap-3 p-3 rounded-[10px] border border-[#2C2E33]"
            style={{ background: 'linear-gradient(135deg, #1A1B1E 0%, #1C1D21 100%)' }}
          >
            {/* Rank */}
            <div className="text-[#555] font-bold text-sm w-6 text-center">
              {index + 1}
            </div>

            {/* Avatar */}
            <img
              src={player.avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${player.player_name}`}
              alt={player.player_name}
              className="w-8 h-8 rounded-full"
            />

            {/* Name + rate */}
            <div className="flex-1 min-w-0">
              <div className="text-white font-medium text-sm truncate">
                {player.player_name}
              </div>
              <div className="text-[11px] text-[#888]">
                {player.first_blood_rate}% of games
              </div>
            </div>

            {/* First blood count */}
            <div className="text-right">
              <div className="text-red-400 font-bold text-lg">
                {player.first_blood_count}
              </div>
              <div className="text-[10px] text-[#888]">first bloods</div>
            </div>

            {/* Conversion rate */}
            <div className="text-right ml-2 pl-2 border-l border-[#2C2E33]">
              <div className="text-[#33D9B2] font-bold text-sm">
                {player.conversion_rate}%
              </div>
              <div className="text-[10px] text-[#888]">win rate</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
