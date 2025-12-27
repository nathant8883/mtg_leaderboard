import { useState, useEffect } from 'react';
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
import { TrendingUp, GitBranch, Lightbulb, BarChart3, Swords } from 'lucide-react';

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
          <div className="bg-[#1A1B1E] border border-[#2C2E33] rounded-lg px-2 py-1.5 text-center">
            <div className="text-[#909296] text-[10px] mb-0.5">Balance</div>
            <div className={`text-lg font-bold ${
              overview.pod_balance_score !== null
                ? overview.pod_balance_score >= 70 ? 'text-[#33D9B2]'
                : overview.pod_balance_score >= 50 ? 'text-[#FFA500]'
                : 'text-[#FF6B6B]'
                : 'text-white'
            }`}>
              {overview.pod_balance_score !== null ? `${overview.pod_balance_score}%` : 'N/A'}
            </div>
          </div>
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
    </div>
  );
}
