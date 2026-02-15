import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { IconTrophy, IconPlus } from '@tabler/icons-react';
import { NoPodPlaceholder } from '../components/NoPodPlaceholder';
import { useAuth } from '../contexts/AuthContext';
import { usePod } from '../contexts/PodContext';
import type { TournamentEvent } from '../services/api';
import { eventApi } from '../services/api';

const statusConfig: Record<string, { label: string; badge: string; icon: string; iconBg: string; border: string; cardBg: string }> = {
  setup: {
    label: 'Setup',
    badge: 'bg-[#25262B] text-[#909296]',
    icon: 'text-[#909296]',
    iconBg: 'bg-[#25262B]',
    border: 'border-[#2C2E33] hover:border-[#667eea]/40',
    cardBg: 'bg-[#1A1B1E]',
  },
  active: {
    label: 'Live',
    badge: 'bg-[#E67700]/20 text-[#FFA94D]',
    icon: 'text-[#FFA94D]',
    iconBg: 'bg-[#E67700]/20',
    border: 'border-[#E67700]/30 hover:border-[#E67700]/50',
    cardBg: 'bg-[#E67700]/10',
  },
  completed: {
    label: 'Completed',
    badge: 'bg-[#2B8A3E]/20 text-[#51CF66]',
    icon: 'text-[#51CF66]',
    iconBg: 'bg-[#2B8A3E]/20',
    border: 'border-[#2C2E33] hover:border-[#51CF66]/40',
    cardBg: 'bg-[#1A1B1E]',
  },
};

const defaultStatusConfig = statusConfig.setup;

export function EventsList() {
  const navigate = useNavigate();
  const { currentPlayer, isGuest } = useAuth();
  const { currentPod, loading: podLoading } = usePod();
  const [events, setEvents] = useState<TournamentEvent[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(false);

  useEffect(() => {
    loadEvents();

    const handlePodSwitch = () => {
      loadEvents();
    };

    window.addEventListener('podSwitched', handlePodSwitch);
    return () => {
      window.removeEventListener('podSwitched', handlePodSwitch);
    };
  }, []);

  useEffect(() => {
    loadEvents();
  }, [currentPod?.id]);

  const loadEvents = async () => {
    if (!currentPod?.id) return;
    try {
      setLoadingEvents(true);
      const data = await eventApi.getByPod(currentPod.id);
      setEvents(data);
    } catch (err) {
      console.error('Error loading events:', err);
    } finally {
      setLoadingEvents(false);
    }
  };

  if (!isGuest && currentPlayer && !currentPod && !podLoading) {
    return <NoPodPlaceholder />;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-white flex items-center gap-2">
          <IconTrophy size={24} className="text-[#667eea]" />
          Events
        </h2>
        {!isGuest && currentPod && (
          <button
            onClick={() => navigate('/event/create')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] text-sm font-medium text-[#667eea] bg-[#667eea]/10 border border-[#667eea]/20 hover:bg-[#667eea]/20 transition-colors"
          >
            <IconPlus size={16} />
            Create Event
          </button>
        )}
      </div>

      {loadingEvents ? (
        <div className="text-center py-8 text-[#909296] text-sm">Loading events...</div>
      ) : events.length === 0 ? (
        <div className="bg-[#1A1B1E] rounded-[12px] border border-[#2C2E33] p-8 text-center">
          <IconTrophy size={40} className="mx-auto mb-3 text-[#5C5F66]" />
          <p className="text-sm text-[#909296] mb-1">No events yet</p>
          <p className="text-xs text-[#5C5F66] mb-4">Create a tournament for your pod!</p>
          {!isGuest && currentPod && (
            <button
              onClick={() => navigate('/event/create')}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-[8px] text-sm font-medium text-white bg-[#667eea] hover:bg-[#5568d3] transition-colors"
            >
              <IconPlus size={16} />
              Create Event
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {events.map(event => {
            const cfg = statusConfig[event.status] || defaultStatusConfig;
            return (
              <button
                key={event.id}
                onClick={() => navigate(`/event/${event.id}`)}
                className={`${cfg.cardBg} rounded-[12px] border ${cfg.border} px-4 py-3 flex items-center gap-3 transition-colors text-left`}
              >
                {event.custom_image ? (
                  <div className="w-9 h-9 rounded-[8px] overflow-hidden border border-[#2C2E33] flex-shrink-0">
                    <img src={event.custom_image} alt="" className="w-full h-full object-cover" />
                  </div>
                ) : event.event_type === 'draft' && event.sets?.length > 0 ? (
                  <div className={`flex items-center justify-center w-9 h-9 rounded-[8px] ${cfg.iconBg} flex-shrink-0`}>
                    <img
                      src={event.sets[0].icon_svg_uri}
                      alt={event.sets[0].name}
                      className="w-5 h-5"
                      style={{ filter: 'invert(1)' }}
                    />
                  </div>
                ) : (
                  <div className={`flex items-center justify-center w-9 h-9 rounded-[8px] ${cfg.iconBg} flex-shrink-0`}>
                    <IconTrophy size={20} className={cfg.icon} />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-white text-sm truncate">{event.name}</span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${cfg.badge} flex-shrink-0`}>
                      {cfg.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-[#909296] mt-0.5">
                    <span>{event.player_count} players</span>
                    <span>&middot;</span>
                    {event.status === 'active' ? (
                      <span>Round {event.current_round}/{event.round_count}</span>
                    ) : (
                      <span>{event.round_count} rounds</span>
                    )}
                    <span>&middot;</span>
                    <span className="capitalize">
                      {event.event_type === 'draft' && event.game_mode
                        ? `${event.game_mode} draft`
                        : event.event_type}
                    </span>
                    <span>&middot;</span>
                    <span>{new Date(event.event_date).toLocaleDateString()}</span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
