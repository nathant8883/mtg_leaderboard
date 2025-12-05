import { useState, useEffect } from 'react';
import { TrendsTab } from '../components/pod-dynamics/TrendsTab';
import { RelationshipsTab } from '../components/pod-dynamics/RelationshipsTab';
import { DecksTab } from '../components/pod-dynamics/DecksTab';
import { InsightsTab } from '../components/pod-dynamics/InsightsTab';
import { podDynamicsApi } from '../services/api';
import type { PodDynamicsOverview } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { usePod } from '../contexts/PodContext';
import { NoPodPlaceholder } from '../components/NoPodPlaceholder';
import { TrendingUp, Users, GitBranch, Lightbulb, BarChart3, Clock, Trophy } from 'lucide-react';

type TabId = 'trends' | 'relationships' | 'decks' | 'insights';

interface Tab {
  id: TabId;
  label: string;
  icon: React.ReactNode;
}

const TABS: Tab[] = [
  { id: 'trends', label: 'Trends', icon: <TrendingUp size={16} /> },
  { id: 'relationships', label: 'Relationships', icon: <GitBranch size={16} /> },
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
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white mb-2">Pod Dynamics</h1>
        <p className="text-[#909296] text-sm">
          Deep analytics and insights for your playgroup
        </p>
      </div>

      {/* Overview Stats Cards */}
      {overview && !loadingOverview && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <div className="bg-[#1A1B1E] border border-[#2C2E33] rounded-xl p-4 text-center">
            <div className="flex items-center justify-center gap-2 text-[#909296] text-xs mb-1">
              <BarChart3 size={14} />
              <span>Total Games</span>
            </div>
            <div className="text-white text-2xl font-bold">{overview.total_games}</div>
          </div>
          <div className="bg-[#1A1B1E] border border-[#2C2E33] rounded-xl p-4 text-center">
            <div className="flex items-center justify-center gap-2 text-[#909296] text-xs mb-1">
              <Trophy size={14} />
              <span>Unique Winners</span>
            </div>
            <div className="text-white text-2xl font-bold">{overview.unique_winners}</div>
          </div>
          <div className="bg-[#1A1B1E] border border-[#2C2E33] rounded-xl p-4 text-center">
            <div className="flex items-center justify-center gap-2 text-[#909296] text-xs mb-1">
              <Clock size={14} />
              <span>Avg Duration</span>
            </div>
            <div className="text-white text-2xl font-bold">
              {overview.avg_duration_minutes ? `${overview.avg_duration_minutes}m` : 'N/A'}
            </div>
          </div>
          <div className="bg-[#1A1B1E] border border-[#2C2E33] rounded-xl p-4 text-center">
            <div className="flex items-center justify-center gap-2 text-[#909296] text-xs mb-1">
              <Users size={14} />
              <span>Pod Balance</span>
            </div>
            <div className={`text-2xl font-bold ${
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
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-[#1A1B1E] border border-[#2C2E33] rounded-xl p-4 text-center animate-pulse">
              <div className="h-4 bg-[#2C2E33] rounded w-20 mx-auto mb-2" />
              <div className="h-8 bg-[#2C2E33] rounded w-12 mx-auto" />
            </div>
          ))}
        </div>
      )}

      {/* Tab Navigation */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-2 -mx-3 px-3 scrollbar-hide">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
              activeTab === tab.id
                ? 'bg-[#667eea] text-white'
                : 'bg-[#1A1B1E] text-[#909296] border border-[#2C2E33] hover:border-[#667eea] hover:text-white'
            }`}
          >
            {tab.icon}
            {tab.label}
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
