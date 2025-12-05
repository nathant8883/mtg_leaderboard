import type { PodHealth } from '../../services/api';
import { Users, Trophy, Shuffle, Target } from 'lucide-react';

interface PodHealthMetricsProps {
  health: PodHealth;
}

function getVarietyLabel(score: number): { label: string; color: string } {
  if (score >= 80) return { label: 'Excellent', color: 'text-[#33D9B2]' };
  if (score >= 60) return { label: 'Good', color: 'text-[#667eea]' };
  if (score >= 40) return { label: 'Fair', color: 'text-[#FFA500]' };
  return { label: 'Low', color: 'text-[#FF6B6B]' };
}

export function PodHealthMetrics({ health }: PodHealthMetricsProps) {
  const variety = getVarietyLabel(health.variety_score);

  return (
    <div className="space-y-4">
      {/* Main Variety Score */}
      <div className="bg-[#141517] rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 text-[#909296] text-sm">
            <Shuffle size={16} />
            <span>Winner Variety</span>
          </div>
          <span className={`text-sm font-medium ${variety.color}`}>{variety.label}</span>
        </div>

        {/* Progress Bar */}
        <div className="h-2 bg-[#2C2E33] rounded-full overflow-hidden mb-2">
          <div
            className="h-full bg-gradient-to-r from-[#667eea] to-[#33D9B2] rounded-full transition-all duration-500"
            style={{ width: `${health.variety_score}%` }}
          />
        </div>

        <div className="flex justify-between text-xs text-[#909296]">
          <span>{health.unique_winners_recent} different winners</span>
          <span>Last {health.games_analyzed} games</span>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-[#141517] rounded-lg p-3 text-center">
          <div className="flex items-center justify-center gap-1 text-[#909296] text-[10px] mb-1">
            <Users size={10} />
            <span>Players</span>
          </div>
          <div className="text-white text-lg font-bold">{health.total_players}</div>
          <div className="text-[#909296] text-[10px]">active</div>
        </div>

        <div className="bg-[#141517] rounded-lg p-3 text-center">
          <div className="flex items-center justify-center gap-1 text-[#909296] text-[10px] mb-1">
            <Trophy size={10} />
            <span>Winners</span>
          </div>
          <div className="text-white text-lg font-bold">{health.unique_winners_total}</div>
          <div className="text-[#909296] text-[10px]">all time</div>
        </div>

        <div className="bg-[#141517] rounded-lg p-3 text-center">
          <div className="flex items-center justify-center gap-1 text-[#909296] text-[10px] mb-1">
            <Target size={10} />
            <span>Upsets</span>
          </div>
          <div className="text-white text-lg font-bold">{health.underdog_wins_recent}</div>
          <div className="text-[#909296] text-[10px]">recent</div>
        </div>
      </div>

      {/* Interpretation */}
      <div className="text-xs text-center text-[#909296]">
        {health.variety_score >= 70 ? (
          <p>Your pod has great competitive balance!</p>
        ) : health.variety_score >= 50 ? (
          <p>Winners are fairly distributed in your pod.</p>
        ) : health.variety_score >= 30 ? (
          <p>A few players tend to dominate. Consider power level discussions.</p>
        ) : (
          <p>One player may be significantly ahead. Time for a rule 0 chat?</p>
        )}
      </div>
    </div>
  );
}
