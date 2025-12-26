import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { EloChart } from './EloChart';
import { PlacementChart } from './PlacementChart';
import { PodSizeChart } from './PodSizeChart';
import { podDynamicsApi } from '../../services/api';
import type { EloHistoryData, PlayerTrendsData } from '../../services/api';
import { TrendingUp, TrendingDown, Target, Users, Zap, Info, X, Minus } from 'lucide-react';

interface TrendsTabProps {
  playerId?: string;
}

export function TrendsTab({ playerId }: TrendsTabProps) {
  const [eloData, setEloData] = useState<EloHistoryData | null>(null);
  const [trendsData, setTrendsData] = useState<PlayerTrendsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showFormInfo, setShowFormInfo] = useState(false);

  useEffect(() => {
    loadData();
  }, [playerId]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [elo, trends] = await Promise.all([
        podDynamicsApi.getEloHistory(playerId),
        podDynamicsApi.getPlayerTrends(playerId),
      ]);
      setEloData(elo);
      setTrendsData(trends);
    } catch (err) {
      console.error('Error loading trends data:', err);
      setError('Failed to load trends data');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#667eea]" />
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

  if (!trendsData || trendsData.total_games === 0) {
    return (
      <div className="text-center py-12 text-[#909296]">
        <p>No games played yet. Start playing to see your trends!</p>
      </div>
    );
  }

  const { first_player_stats, consistency, win_rate_trend } = trendsData;

  // Calculate current form (last 5 games trend)
  const recentTrend = win_rate_trend.slice(-5);
  const formChange = recentTrend.length >= 2
    ? recentTrend[recentTrend.length - 1].win_rate - recentTrend[0].win_rate
    : 0;
  const formLabel = formChange > 5 ? 'Hot' : formChange < -5 ? 'Cold' : 'Stable';
  const formColor = formChange > 5 ? 'text-[#33D9B2]' : formChange < -5 ? 'text-[#FF6B6B]' : 'text-[#909296]';
  const FormIcon = formChange > 5 ? TrendingUp : formChange < -5 ? TrendingDown : Minus;

  return (
    <div className="space-y-6">
      {/* Quick Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {/* Total Games */}
        <div className="bg-[#1A1B1E] border border-[#2C2E33] rounded-xl p-4">
          <div className="flex items-center gap-2 text-[#909296] text-xs mb-1">
            <Users size={14} />
            <span>Your Games</span>
          </div>
          <div className="text-white text-2xl font-bold">{trendsData.total_games}</div>
        </div>

        {/* Current Form */}
        <button
          onClick={() => setShowFormInfo(true)}
          className="bg-[#1A1B1E] border border-[#2C2E33] rounded-xl p-4 text-left active:bg-[#252629] transition-colors"
        >
          <div className="flex items-center justify-between text-[#909296] text-xs mb-1">
            <div className="flex items-center gap-2">
              <TrendingUp size={14} />
              <span>Current Form</span>
            </div>
            <Info size={14} className="opacity-50" />
          </div>
          <div className={`text-2xl font-bold ${formColor} flex items-center gap-2`}>
            <FormIcon size={24} />
            {formLabel}
          </div>
        </button>

        {/* First Player Advantage */}
        <div className="bg-[#1A1B1E] border border-[#2C2E33] rounded-xl p-4">
          <div className="flex items-center gap-2 text-[#909296] text-xs mb-1">
            <Zap size={14} />
            <span>First Player</span>
          </div>
          <div className="text-white text-2xl font-bold">
            {first_player_stats.as_first.games > 0
              ? `${first_player_stats.as_first.win_rate.toFixed(0)}%`
              : 'N/A'}
          </div>
          {first_player_stats.as_first.games > 0 && (
            <div className="text-xs text-[#909296]">
              {first_player_stats.as_first.wins}W / {first_player_stats.as_first.games}G
            </div>
          )}
        </div>

        {/* Consistency */}
        <div className="bg-[#1A1B1E] border border-[#2C2E33] rounded-xl p-4">
          <div className="flex items-center gap-2 text-[#909296] text-xs mb-1">
            <Target size={14} />
            <span>Consistency</span>
          </div>
          <div className={`text-2xl font-bold ${
            consistency.label === 'Very Consistent' || consistency.label === 'Consistent'
              ? 'text-[#33D9B2]'
              : consistency.label === 'Volatile'
              ? 'text-[#FF6B6B]'
              : 'text-white'
          }`}>
            {consistency.label || 'N/A'}
          </div>
          {consistency.average_placement && (
            <div className="text-xs text-[#909296]">
              Avg: {consistency.average_placement.toFixed(1)} place
            </div>
          )}
        </div>
      </div>

      {/* Elo Progression */}
      {eloData && (
        <div className="bg-[#1A1B1E] border border-[#2C2E33] rounded-xl p-4">
          <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
            <TrendingUp size={18} className="text-[#667eea]" />
            Elo Progression
          </h3>
          <EloChart data={eloData} />
        </div>
      )}

      {/* Two-column layout on desktop */}
      <div className="grid md:grid-cols-2 gap-4">
        {/* Performance by Pod Size */}
        <div className="bg-[#1A1B1E] border border-[#2C2E33] rounded-xl p-4">
          <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
            <Users size={18} className="text-[#667eea]" />
            Performance by Pod Size
          </h3>
          <PodSizeChart data={trendsData.pod_size_performance} />
        </div>

        {/* Placement Distribution - only show if we have actual elimination_order data */}
        {trendsData.games_with_placement_data > 0 && (
          <div className="bg-[#1A1B1E] border border-[#2C2E33] rounded-xl p-4">
            <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
              <Target size={18} className="text-[#667eea]" />
              Placement Distribution
            </h3>
            <PlacementChart data={trendsData.placement_distribution} />
          </div>
        )}
      </div>

      {/* First Player Advantage Detail */}
      {(first_player_stats.as_first.games > 0 || first_player_stats.not_first.games > 0) && (
        <div className="bg-[#1A1B1E] border border-[#2C2E33] rounded-xl p-4">
          <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
            <Zap size={18} className="text-[#667eea]" />
            First Player Advantage
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center p-4 bg-[#141517] rounded-lg">
              <div className="text-[#909296] text-sm mb-2">When Going First</div>
              <div className="text-3xl font-bold text-white mb-1">
                {first_player_stats.as_first.games > 0
                  ? `${first_player_stats.as_first.win_rate.toFixed(1)}%`
                  : 'N/A'}
              </div>
              <div className="text-xs text-[#909296]">
                {first_player_stats.as_first.wins} wins / {first_player_stats.as_first.games} games
              </div>
            </div>
            <div className="text-center p-4 bg-[#141517] rounded-lg">
              <div className="text-[#909296] text-sm mb-2">When Not First</div>
              <div className="text-3xl font-bold text-white mb-1">
                {first_player_stats.not_first.games > 0
                  ? `${first_player_stats.not_first.win_rate.toFixed(1)}%`
                  : 'N/A'}
              </div>
              <div className="text-xs text-[#909296]">
                {first_player_stats.not_first.wins} wins / {first_player_stats.not_first.games} games
              </div>
            </div>
          </div>
          {/* Insight */}
          {first_player_stats.as_first.games >= 5 && first_player_stats.not_first.games >= 5 && (
            <div className="mt-4 text-center text-sm text-[#909296]">
              {first_player_stats.as_first.win_rate > first_player_stats.not_first.win_rate + 5 ? (
                <span>
                  You have a <span className="text-[#33D9B2] font-semibold">
                    +{(first_player_stats.as_first.win_rate - first_player_stats.not_first.win_rate).toFixed(1)}%
                  </span> advantage when going first
                </span>
              ) : first_player_stats.not_first.win_rate > first_player_stats.as_first.win_rate + 5 ? (
                <span>
                  Interestingly, you perform <span className="text-[#33D9B2] font-semibold">better</span> when not going first
                </span>
              ) : (
                <span>Your performance is consistent regardless of turn order</span>
              )}
            </div>
          )}
        </div>
      )}

      {/* Current Form Info Modal - rendered via portal to escape scroll containers */}
      {showFormInfo && createPortal(
        <div
          className="fixed top-0 left-0 right-0 bottom-0 bg-black/60 flex items-end md:items-center justify-center"
          style={{ zIndex: 9999, height: '100dvh', width: '100vw' }}
          onClick={() => setShowFormInfo(false)}
        >
          <div
            className="bg-[#1A1B1E] w-full md:w-auto md:max-w-md md:rounded-xl rounded-t-xl border border-[#2C2E33] overflow-hidden animate-slide-up"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-[#2C2E33]">
              <div className="flex items-center gap-2">
                <TrendingUp size={18} className="text-[#667eea]" />
                <span className="text-white font-semibold">Current Form</span>
              </div>
              <button
                onClick={() => setShowFormInfo(false)}
                className="p-2 -mr-2 text-[#909296] active:bg-[#2C2E33] rounded-lg"
              >
                <X size={20} />
              </button>
            </div>

            {/* Content */}
            <div className="p-4 space-y-4">
              <p className="text-[#C1C2C5] text-sm leading-relaxed">
                Current Form shows how your win rate is trending based on your recent games.
              </p>

              <div className="space-y-3">
                <div className="flex items-center gap-3 p-3 bg-[#141517] rounded-lg">
                  <div className="w-10 h-10 rounded-full bg-[#33D9B2]/20 flex items-center justify-center">
                    <TrendingUp size={20} className="text-[#33D9B2]" />
                  </div>
                  <div>
                    <div className="text-[#33D9B2] font-semibold text-sm">Hot</div>
                    <div className="text-[#909296] text-xs">Win rate up more than 5%</div>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-3 bg-[#141517] rounded-lg">
                  <div className="w-10 h-10 rounded-full bg-[#909296]/20 flex items-center justify-center">
                    <Minus size={20} className="text-[#909296]" />
                  </div>
                  <div>
                    <div className="text-white font-semibold text-sm">Stable</div>
                    <div className="text-[#909296] text-xs">Win rate within ±5%</div>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-3 bg-[#141517] rounded-lg">
                  <div className="w-10 h-10 rounded-full bg-[#FF6B6B]/20 flex items-center justify-center">
                    <TrendingDown size={20} className="text-[#FF6B6B]" />
                  </div>
                  <div>
                    <div className="text-[#FF6B6B] font-semibold text-sm">Cold</div>
                    <div className="text-[#909296] text-xs">Win rate down more than 5%</div>
                  </div>
                </div>
              </div>

              <p className="text-[#909296] text-xs">
                Calculated using a 10-game rolling average, comparing your oldest vs newest recent performance.
              </p>
            </div>

            {/* Dismiss button for mobile */}
            <div className="p-4 pt-0">
              <button
                onClick={() => setShowFormInfo(false)}
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
