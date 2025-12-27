import { useState } from 'react';
import { createPortal } from 'react-dom';
import type { PodHealth } from '../../services/api';
import { Users, Trophy, Shuffle, Target, Info, X } from 'lucide-react';

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
  const [showWinnersInfo, setShowWinnersInfo] = useState(false);
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

        <button
          onClick={() => setShowWinnersInfo(true)}
          className="bg-[#141517] rounded-lg p-3 text-center w-full active:bg-[#1e1f22] transition-colors"
        >
          <div className="flex items-center justify-center gap-1 text-[#909296] text-[10px] mb-1">
            <Trophy size={10} />
            <span>Winners</span>
            <Info size={8} className="opacity-50" />
          </div>
          <div className="text-white text-lg font-bold">{health.unique_winners_total}</div>
          <div className="text-[#909296] text-[10px]">all time</div>
        </button>

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

      {/* Winners Info Modal */}
      {showWinnersInfo && createPortal(
        <div
          className="fixed top-0 left-0 right-0 bottom-0 bg-black/60 flex items-end md:items-center justify-center"
          style={{ zIndex: 9999, height: '100dvh', width: '100vw' }}
          onClick={() => setShowWinnersInfo(false)}
        >
          <div
            className="bg-[#1A1B1E] w-full md:w-auto md:max-w-md md:rounded-xl rounded-t-xl border border-[#2C2E33] overflow-hidden animate-slide-up"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-[#2C2E33]">
              <div className="flex items-center gap-2">
                <Trophy size={18} className="text-[#667eea]" />
                <span className="text-white font-semibold">Winners</span>
              </div>
              <button
                onClick={() => setShowWinnersInfo(false)}
                className="p-2 -mr-2 text-[#909296] active:bg-[#2C2E33] rounded-lg"
              >
                <X size={20} />
              </button>
            </div>

            {/* Content */}
            <div className="p-4 space-y-4">
              <p className="text-[#C1C2C5] text-sm leading-relaxed">
                The total number of unique players who have won at least one game in your pod.
              </p>

              <div className="space-y-3">
                <div className="flex items-center gap-3 p-3 bg-[#141517] rounded-lg">
                  <div className="w-10 h-10 rounded-full bg-[#33D9B2]/20 flex items-center justify-center">
                    <Users size={20} className="text-[#33D9B2]" />
                  </div>
                  <div>
                    <div className="text-[#33D9B2] font-semibold text-sm">High Winner Count</div>
                    <div className="text-[#909296] text-xs">Sign of healthy competition - everyone has a chance</div>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-3 bg-[#141517] rounded-lg">
                  <div className="w-10 h-10 rounded-full bg-[#FF6B6B]/20 flex items-center justify-center">
                    <Trophy size={20} className="text-[#FF6B6B]" />
                  </div>
                  <div>
                    <div className="text-[#FF6B6B] font-semibold text-sm">Low Winner Count</div>
                    <div className="text-[#909296] text-xs">May indicate power imbalance or matchup issues</div>
                  </div>
                </div>
              </div>

              <p className="text-[#909296] text-xs">
                A healthy pod typically has most players winning at least occasionally.
              </p>
            </div>

            {/* Dismiss button for mobile */}
            <div className="p-4 pt-0">
              <button
                onClick={() => setShowWinnersInfo(false)}
                className="w-full py-3 bg-[#667eea] text-white font-medium rounded-lg active:bg-[#5a6fd6] transition-colors"
              >
                Got it
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
