import { useState, useEffect } from 'react';
import { KillLeaderboard } from './KillLeaderboard';
import { ScoopShame } from './ScoopShame';
import HuntingAsymmetry from './HuntingAsymmetry';
import { podDynamicsApi } from '../../services/api';
import type { EliminationStatsData } from '../../services/api';
import { Swords, Skull, Flag, Target, Sparkles } from 'lucide-react';

export function CombatTab() {
  const [data, setData] = useState<EliminationStatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
          <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
            <Swords size={18} className="text-[#FF6B6B]" />
            Kill Leaders
          </h3>
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

      {/* Hunting Asymmetry */}
      {hasHuntingPairs && (
        <div className="bg-[#1A1B1E] border border-[#2C2E33] rounded-xl p-4">
          <h3 className="text-white font-semibold mb-1 flex items-center gap-2">
            <Target size={18} className="text-[#C0392B]" />
            Hunting Asymmetry
          </h3>
          <p className="text-[#909296] text-xs mb-4">Who hunts who?</p>
          <HuntingAsymmetry pairs={data.hunting_pairs} />
        </div>
      )}

    </div>
  );
}
