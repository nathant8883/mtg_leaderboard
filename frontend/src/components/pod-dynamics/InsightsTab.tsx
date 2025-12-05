import { useState, useEffect } from 'react';
import { InsightCard } from './InsightCard';
import { PlayFrequencyCalendar } from './PlayFrequencyCalendar';
import { PodHealthMetrics } from './PodHealthMetrics';
import { podDynamicsApi } from '../../services/api';
import type { InsightsData, CalendarData } from '../../services/api';
import { Lightbulb, Calendar, Heart, Sparkles } from 'lucide-react';

export function InsightsTab() {
  const [insightsData, setInsightsData] = useState<InsightsData | null>(null);
  const [calendarData, setCalendarData] = useState<CalendarData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [insights, calendar] = await Promise.all([
        podDynamicsApi.getInsights(),
        podDynamicsApi.getCalendar(),
      ]);
      setInsightsData(insights);
      setCalendarData(calendar);
    } catch (err) {
      console.error('Error loading insights data:', err);
      setError('Failed to load insights data');
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

  const hasInsights = insightsData && insightsData.insights.length > 0;
  const hasCalendar = calendarData && calendarData.calendar.length > 0;
  const hasHealth = insightsData && insightsData.pod_health.total_players > 0;

  if (!hasInsights && !hasCalendar && !hasHealth) {
    return (
      <div className="text-center py-12 text-[#909296]">
        <Sparkles size={48} className="mx-auto mb-4 opacity-50" />
        <p>Play some games to unlock insights!</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Auto-Generated Insights */}
      {hasInsights && (
        <div className="bg-[#1A1B1E] border border-[#2C2E33] rounded-xl p-4">
          <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
            <Lightbulb size={18} className="text-[#FFD700]" />
            What's Happening
          </h3>
          <div className="grid gap-3">
            {insightsData.insights.map((insight, index) => (
              <InsightCard key={`${insight.type}-${index}`} insight={insight} />
            ))}
          </div>
          {insightsData.insights.length === 0 && (
            <p className="text-[#909296] text-sm text-center py-4">
              No notable patterns detected yet. Keep playing!
            </p>
          )}
        </div>
      )}

      {/* Pod Health */}
      {hasHealth && (
        <div className="bg-[#1A1B1E] border border-[#2C2E33] rounded-xl p-4">
          <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
            <Heart size={18} className="text-[#FF6B6B]" />
            Pod Health
          </h3>
          <PodHealthMetrics health={insightsData.pod_health} />
        </div>
      )}

      {/* Play Frequency Calendar */}
      {hasCalendar && (
        <div className="bg-[#1A1B1E] border border-[#2C2E33] rounded-xl p-4">
          <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
            <Calendar size={18} className="text-[#33D9B2]" />
            Play Activity
          </h3>
          <PlayFrequencyCalendar data={calendarData} />
        </div>
      )}
    </div>
  );
}
