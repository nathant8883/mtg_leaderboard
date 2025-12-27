import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { TrendsTab } from '../components/pod-dynamics/TrendsTab';
import { RelationshipsTab } from '../components/pod-dynamics/RelationshipsTab';
import { CombatTab } from '../components/pod-dynamics/CombatTab';
import { DecksTab } from '../components/pod-dynamics/DecksTab';
import { InsightsTab } from '../components/pod-dynamics/InsightsTab';
import { podDynamicsApi } from '../services/api';
import type { PodDynamicsOverview } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { usePod } from '../contexts/PodContext';
import { NoPodPlaceholder } from '../components/NoPodPlaceholder';
import { TrendingUp, GitBranch, Lightbulb, BarChart3, Swords, Scale, Info, X, CheckCircle, AlertTriangle, XCircle } from 'lucide-react';

type TabId = 'trends' | 'relationships' | 'combat' | 'decks' | 'insights';

interface Tab {
  id: TabId;
  label: string;
  icon: React.ReactNode;
}

const TABS: Tab[] = [
  { id: 'trends', label: 'Trends', icon: <TrendingUp size={16} /> },
  { id: 'relationships', label: 'Relationships', icon: <GitBranch size={16} /> },
  { id: 'combat', label: 'Combat', icon: <Swords size={16} /> },
  { id: 'decks', label: 'Decks & Meta', icon: <BarChart3 size={16} /> },
  { id: 'insights', label: 'Insights', icon: <Lightbulb size={16} /> },
];

export function PodDynamics() {
  const { currentPlayer, isGuest } = useAuth();
  const { currentPod, loading: podLoading } = usePod();
  const [activeTab, setActiveTab] = useState<TabId>('trends');
  const [overview, setOverview] = useState<PodDynamicsOverview | null>(null);
  const [loadingOverview, setLoadingOverview] = useState(true);
  const [showBalanceInfo, setShowBalanceInfo] = useState(false);

  useEffect(() => {
    if (currentPod) {
      loadOverview();
    }
  }, [currentPod]);

  const loadOverview = async () => {
    try {
      setLoadingOverview(true);
      const data = await podDynamicsApi.getOverview();
      setOverview(data);
    } catch (err) {
      console.error('Error loading overview:', err);
    } finally {
      setLoadingOverview(false);
    }
  };

  // Show placeholder if no pod selected (similar to Dashboard)
  if (!podLoading && !isGuest && currentPlayer && !currentPod) {
    return (
      <div className="max-w-4xl mx-auto">
        <NoPodPlaceholder />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <h1 className="text-2xl font-bold text-white mb-4">Pod Dynamics</h1>

      {/* Overview Stats Cards - Compact */}
      {overview && !loadingOverview && (
        <div className="grid grid-cols-4 gap-2 mb-4">
          <div className="bg-[#1A1B1E] border border-[#2C2E33] rounded-lg px-2 py-1.5 text-center">
            <div className="text-[#909296] text-[10px] mb-0.5">Pod Games</div>
            <div className="text-white text-lg font-bold">{overview.total_games}</div>
          </div>
          <div className="bg-[#1A1B1E] border border-[#2C2E33] rounded-lg px-2 py-1.5 text-center">
            <div className="text-[#909296] text-[10px] mb-0.5">Winners</div>
            <div className="text-white text-lg font-bold">{overview.unique_winners}</div>
          </div>
          <div className="bg-[#1A1B1E] border border-[#2C2E33] rounded-lg px-2 py-1.5 text-center">
            <div className="text-[#909296] text-[10px] mb-0.5">Avg Time</div>
            <div className="text-white text-lg font-bold">
              {overview.avg_duration_minutes ? `${overview.avg_duration_minutes}m` : 'N/A'}
            </div>
          </div>
          <button
            onClick={() => setShowBalanceInfo(true)}
            className="bg-[#1A1B1E] border border-[#2C2E33] rounded-lg px-2 py-1.5 text-center w-full active:bg-[#252629] transition-colors"
          >
            <div className="flex items-center justify-center gap-1 text-[#909296] text-[10px] mb-0.5">
              <span>Balance</span>
              <Info size={8} className="opacity-50" />
            </div>
            <div className={`text-lg font-bold ${
              overview.pod_balance_score !== null
                ? overview.pod_balance_score >= 70 ? 'text-[#33D9B2]'
                : overview.pod_balance_score >= 50 ? 'text-[#FFA500]'
                : 'text-[#FF6B6B]'
                : 'text-white'
            }`}>
              {overview.pod_balance_score !== null ? `${overview.pod_balance_score}%` : 'N/A'}
            </div>
          </button>
        </div>
      )}

      {loadingOverview && (
        <div className="grid grid-cols-4 gap-2 mb-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-[#1A1B1E] border border-[#2C2E33] rounded-lg px-2 py-1.5 text-center animate-pulse">
              <div className="h-3 bg-[#2C2E33] rounded w-10 mx-auto mb-1" />
              <div className="h-5 bg-[#2C2E33] rounded w-8 mx-auto" />
            </div>
          ))}
        </div>
      )}

      {/* Tab Navigation - Sliding Pill */}
      <div className="relative flex bg-[#1A1B1E] rounded-xl p-1 mb-6 border border-[#2C2E33]">
        {/* Sliding pill background */}
        <div
          className="absolute top-1 bottom-1 bg-[#667eea] rounded-lg transition-all duration-300 ease-out"
          style={{
            width: `calc((100% - 8px) / ${TABS.length})`,
            left: `calc(4px + ${TABS.findIndex(t => t.id === activeTab)} * (100% - 8px) / ${TABS.length})`,
          }}
        />

        {/* Tab buttons */}
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`relative z-10 flex-1 flex items-center justify-center gap-2
                        px-3 py-2 rounded-lg text-sm font-medium transition-colors
                        ${activeTab === tab.id ? 'text-white' : 'text-[#909296] hover:text-white'}`}
          >
            {tab.icon}
            <span className="hidden md:inline">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="min-h-[400px]">
        {activeTab === 'trends' && (
          <TrendsTab playerId={currentPlayer?.id} />
        )}
        {activeTab === 'relationships' && (
          <RelationshipsTab playerId={currentPlayer?.id} />
        )}
        {activeTab === 'combat' && (
          <CombatTab />
        )}
        {activeTab === 'decks' && (
          <DecksTab playerName={currentPlayer?.name} />
        )}
        {activeTab === 'insights' && (
          <InsightsTab />
        )}
      </div>

      {/* Pod Balance Info Modal */}
      {showBalanceInfo && createPortal(
        <div
          className="fixed top-0 left-0 right-0 bottom-0 bg-black/60 flex items-end md:items-center justify-center"
          style={{ zIndex: 9999, height: '100dvh', width: '100vw' }}
          onClick={() => setShowBalanceInfo(false)}
        >
          <div
            className="bg-[#1A1B1E] w-full md:w-auto md:max-w-md md:rounded-xl rounded-t-xl border border-[#2C2E33] overflow-hidden animate-slide-up"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-[#2C2E33]">
              <div className="flex items-center gap-2">
                <Scale size={18} className="text-[#667eea]" />
                <span className="text-white font-semibold">Pod Balance</span>
              </div>
              <button
                onClick={() => setShowBalanceInfo(false)}
                className="p-2 -mr-2 text-[#909296] active:bg-[#2C2E33] rounded-lg"
              >
                <X size={20} />
              </button>
            </div>

            {/* Content */}
            <div className="p-4 space-y-4">
              <p className="text-[#C1C2C5] text-sm leading-relaxed">
                Measures how evenly wins are distributed across all players in your pod.
              </p>

              <div className="space-y-3">
                <div className="flex items-center gap-3 p-3 bg-[#141517] rounded-lg">
                  <div className="w-10 h-10 rounded-full bg-[#33D9B2]/20 flex items-center justify-center">
                    <CheckCircle size={20} className="text-[#33D9B2]" />
                  </div>
                  <div>
                    <div className="text-[#33D9B2] font-semibold text-sm">Healthy (70%+)</div>
                    <div className="text-[#909296] text-xs">Wins are well distributed across players</div>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-3 bg-[#141517] rounded-lg">
                  <div className="w-10 h-10 rounded-full bg-[#FFA500]/20 flex items-center justify-center">
                    <AlertTriangle size={20} className="text-[#FFA500]" />
                  </div>
                  <div>
                    <div className="text-[#FFA500] font-semibold text-sm">Uneven (50-69%)</div>
                    <div className="text-[#909296] text-xs">Some players winning more than others</div>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-3 bg-[#141517] rounded-lg">
                  <div className="w-10 h-10 rounded-full bg-[#FF6B6B]/20 flex items-center justify-center">
                    <XCircle size={20} className="text-[#FF6B6B]" />
                  </div>
                  <div>
                    <div className="text-[#FF6B6B] font-semibold text-sm">Imbalanced (&lt;50%)</div>
                    <div className="text-[#909296] text-xs">One or few players dominating wins</div>
                  </div>
                </div>
              </div>

              <div className="p-3 bg-[#141517] rounded-lg border border-[#2C2E33]">
                <div className="text-[#667eea] font-semibold text-xs mb-2">How it's calculated</div>
                <p className="text-[#909296] text-xs leading-relaxed">
                  Based on statistical variance of win rates - lower variance means wins are more evenly spread, resulting in a higher balance score.
                </p>
              </div>

              <div className="p-3 bg-[#141517] rounded-lg border border-[#2C2E33]">
                <div className="text-[#667eea] font-semibold text-xs mb-2">Tips to improve balance</div>
                <ul className="text-[#909296] text-xs space-y-1">
                  <li>• Have power level discussions with your pod</li>
                  <li>• Try deck swapping or handicap rules</li>
                  <li>• Focus on fun over winning</li>
                </ul>
              </div>
            </div>

            {/* Dismiss button for mobile */}
            <div className="p-4 pt-0">
              <button
                onClick={() => setShowBalanceInfo(false)}
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
