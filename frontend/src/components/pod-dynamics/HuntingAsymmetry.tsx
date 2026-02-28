import { Target } from 'lucide-react';
import type { HuntingPair } from '../../services/api';

interface HuntingAsymmetryProps {
  pairs: HuntingPair[];
}

export default function HuntingAsymmetry({ pairs }: HuntingAsymmetryProps) {
  if (!pairs || pairs.length === 0) {
    return null;
  }

  return (
    <div className="bg-[#1A1B1E] border border-[#2C2E33] rounded-xl p-4">
      <h3 className="text-white font-semibold mb-1 flex items-center gap-2">
        <Target className="w-[18px] h-[18px] text-[#C0392B]" />
        Hunting Grounds
      </h3>

      <div className="space-y-3">
        {pairs.map((pair, index) => (
          <div
            key={`${pair.hunter_id}-${pair.prey_id}`}
            className="p-3 rounded-[10px] border border-[#2C2E33]"
            style={{ background: 'linear-gradient(135deg, #1A1B1E 0%, #1C1D21 100%)' }}
          >
            {/* Label badge */}
            {pair.label && (
              <div className="mb-2">
                <span
                  className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
                  style={{
                    color: pair.label === 'Arch-Nemesis' ? '#FF4444' : '#FF8C00',
                    backgroundColor: pair.label === 'Arch-Nemesis' ? 'rgba(255,68,68,0.15)' : 'rgba(255,140,0,0.15)',
                  }}
                >
                  {pair.label}
                </span>
              </div>
            )}

            <div className="flex items-center gap-3">
              {/* Hunter */}
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <img
                  src={pair.hunter_avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${pair.hunter_name}`}
                  alt={pair.hunter_name}
                  className="w-9 h-9 rounded-full ring-2 ring-red-500/40"
                />
                <div className="min-w-0">
                  <div className="text-white font-medium text-sm">{pair.hunter_name.split(' ')[0]}</div>
                  <div className="text-[10px] text-red-400">Hunter</div>
                </div>
              </div>

              {/* Ratio badge */}
              <div className="flex flex-col items-center px-3">
                <div className="text-white font-bold text-lg">
                  {pair.kill_ratio}:1
                </div>
                <div className="text-[10px] text-[#888]">
                  {pair.hunter_kills} vs {pair.prey_kills}
                </div>
              </div>

              {/* Prey */}
              <div className="flex items-center gap-2 flex-1 min-w-0 justify-end">
                <div className="min-w-0 text-right">
                  <div className="text-white/75 font-medium text-sm">{pair.prey_name.split(' ')[0]}</div>
                  <div className="text-[10px] text-[#888]">Prey</div>
                </div>
                <img
                  src={pair.prey_avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${pair.prey_name}`}
                  alt={pair.prey_name}
                  className="w-9 h-9 rounded-full opacity-75"
                />
              </div>
            </div>

            {/* Games together */}
            <div className="text-[10px] text-[#555] mt-2 text-center">
              {pair.games_together} games together
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
