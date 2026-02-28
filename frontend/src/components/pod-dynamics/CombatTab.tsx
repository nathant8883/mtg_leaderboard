import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { KillLeaderboard } from './KillLeaderboard';
import { ScoopShame } from './ScoopShame';
import HuntingAsymmetry from './HuntingAsymmetry';
import { podDynamicsApi } from '../../services/api';
import type { EliminationStatsData } from '../../services/api';
import { Swords, Skull, Flag, Sparkles, Info, X } from 'lucide-react';

export function CombatTab() {
  const [data, setData] = useState<EliminationStatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showArchetypeInfo, setShowArchetypeInfo] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const eliminationStats = await podDynamicsApi.getEliminationStats();
      setData(eliminationStats);
    } catch (err) {
      console.error('Error loading elimination stats:', err);
      setError('Failed to load combat data');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#FF6B6B]" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-[#FF6B6B] mb-4">{error}</p>
        <button
          onClick={loadData}
          className="px-4 py-2 bg-[#667eea] text-white rounded-lg text-sm"
        >
          Try Again
        </button>
      </div>
    );
  }

  if (!data || data.total_games_with_elimination_data === 0) {
    return (
      <div className="text-center py-12 text-[#909296]">
        <Sparkles size={48} className="mx-auto mb-4 opacity-50" />
        <p>No elimination data recorded yet!</p>
        <p className="text-sm mt-2">Play games with elimination tracking enabled to see combat stats.</p>
      </div>
    );
  }

  const hasKillLeaders = data.kill_leaders.some(p => p.total_kills > 0);
  const hasScoopData = data.scoop_leaders.some(p => p.times_scooped > 0);
  const hasHuntingPairs = data.hunting_pairs.length > 0;


  return (
    <div className="space-y-6">
      {/* Pod Combat Overview */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-[#1A1B1E] border border-[#2C2E33] rounded-lg px-3 py-2 text-center">
          <div className="flex items-center justify-center gap-1.5 text-[#909296] text-[10px] mb-0.5">
            <Skull size={12} className="text-[#FF6B6B]" />
            Pod Kills
          </div>
          <div className="text-white text-lg font-bold">{data.total_kills}</div>
        </div>
        <div className="bg-[#1A1B1E] border border-[#2C2E33] rounded-lg px-3 py-2 text-center">
          <div className="flex items-center justify-center gap-1.5 text-[#909296] text-[10px] mb-0.5">
            <Flag size={12} className="text-[#667eea]" />
            Pod Scoops
          </div>
          <div className="text-white text-lg font-bold">{data.total_scoops}</div>
        </div>
        <div className="bg-[#1A1B1E] border border-[#2C2E33] rounded-lg px-3 py-2 text-center">
          <div className="flex items-center justify-center gap-1.5 text-[#909296] text-[10px] mb-0.5">
            <Swords size={12} className="text-[#FFA500]" />
            Kills/Game
          </div>
          <div className="text-white text-lg font-bold">{data.avg_kills_per_game}</div>
        </div>
      </div>

      {/* Kill Leaderboard */}
      {hasKillLeaders && (
        <div className="bg-[#1A1B1E] border border-[#2C2E33] rounded-xl p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-white font-semibold flex items-center gap-2">
              <Swords size={18} className="text-[#FF6B6B]" />
              Kill Leaders
            </h3>
            <button
              onClick={() => setShowArchetypeInfo(true)}
              className="p-1.5 text-[#909296] active:bg-[#2C2E33] rounded-lg"
            >
              <Info size={16} />
            </button>
          </div>
          <KillLeaderboard players={data.kill_leaders} />
        </div>
      )}

      {/* Scoops */}
      {hasScoopData && (
        <div className="bg-[#1A1B1E] border border-[#2C2E33] rounded-xl p-4">
          <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
            <Flag size={18} className="text-[#667eea]" />
            Scoops
          </h3>
          <ScoopShame players={data.scoop_leaders} />
        </div>
      )}

      {/* Hunting Grounds */}
      {hasHuntingPairs && (
        <HuntingAsymmetry pairs={data.hunting_pairs} />
      )}

      {/* Archetype Info Drawer */}
      {showArchetypeInfo && createPortal(
        <div
          className="fixed top-0 left-0 right-0 bottom-0 bg-black/60 flex items-end md:items-center justify-center"
          style={{ zIndex: 9999, height: '100dvh', width: '100vw' }}
          onClick={() => setShowArchetypeInfo(false)}
        >
          <div
            className="bg-[#1A1B1E] w-full md:w-auto md:max-w-md md:rounded-xl rounded-t-xl border border-[#2C2E33] overflow-hidden animate-slide-up"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-[#2C2E33]">
              <div className="flex items-center gap-2">
                <Swords size={18} className="text-[#FF6B6B]" />
                <span className="text-white font-semibold">Combat Archetypes</span>
              </div>
              <button
                onClick={() => setShowArchetypeInfo(false)}
                className="p-2 -mr-2 text-[#909296] active:bg-[#2C2E33] rounded-lg"
              >
                <X size={20} />
              </button>
            </div>

            {/* Content */}
            <div className="p-4 space-y-4">
              <p className="text-[#C1C2C5] text-sm leading-relaxed">
                Each player is assigned an archetype based on their combat patterns.
              </p>

              <div className="space-y-3">
                <div className="flex items-center gap-3 p-3 bg-[#141517] rounded-lg">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: 'rgba(255, 68, 68, 0.2)' }}>
                    <span className="text-lg">🗡️</span>
                  </div>
                  <div>
                    <div className="font-semibold text-sm" style={{ color: '#FF4444' }}>Assassin</div>
                    <div className="text-[#909296] text-xs">Highest kill rate in games they lost</div>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-3 bg-[#141517] rounded-lg">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: 'rgba(255, 215, 0, 0.2)' }}>
                    <span className="text-lg">👑</span>
                  </div>
                  <div>
                    <div className="font-semibold text-sm" style={{ color: '#FFD700' }}>Kingmaker</div>
                    <div className="text-[#909296] text-xs">High kills but below-average win rate</div>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-3 bg-[#141517] rounded-lg">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: 'rgba(255, 107, 53, 0.2)' }}>
                    <span className="text-lg">🔥</span>
                  </div>
                  <div>
                    <div className="font-semibold text-sm" style={{ color: '#FF6B35' }}>Berserker</div>
                    <div className="text-[#909296] text-xs">Gets first blood most often</div>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-3 bg-[#141517] rounded-lg">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: 'rgba(255, 105, 180, 0.2)' }}>
                    <span className="text-lg">🎯</span>
                  </div>
                  <div>
                    <div className="font-semibold text-sm" style={{ color: '#FF69B4' }}>Target</div>
                    <div className="text-[#909296] text-xs">First eliminated most often</div>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-3 bg-[#141517] rounded-lg">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: 'rgba(51, 217, 178, 0.2)' }}>
                    <span className="text-lg">🛡️</span>
                  </div>
                  <div>
                    <div className="font-semibold text-sm" style={{ color: '#33D9B2' }}>Survivor</div>
                    <div className="text-[#909296] text-xs">Best placement with low kill count</div>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-3 bg-[#141517] rounded-lg">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: 'rgba(155, 89, 182, 0.2)' }}>
                    <span className="text-lg">🃏</span>
                  </div>
                  <div>
                    <div className="font-semibold text-sm" style={{ color: '#9B59B6' }}>Table Flipper</div>
                    <div className="text-[#909296] text-xs">Highest scoop rate</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Dismiss button */}
            <div className="p-4 pt-0">
              <button
                onClick={() => setShowArchetypeInfo(false)}
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
