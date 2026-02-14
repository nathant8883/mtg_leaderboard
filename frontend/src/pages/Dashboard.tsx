import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { IconTrophy, IconPlus } from '@tabler/icons-react';
import StatsCards from '../components/StatsCards';
import TopPlayers from '../components/TopPlayers';
import TopDecks from '../components/TopDecks';
import RecentMatches from '../components/RecentMatches';
import { NoPodPlaceholder } from '../components/NoPodPlaceholder';
import { useAuth } from '../contexts/AuthContext';
import { usePod } from '../contexts/PodContext';
import type { Match, Deck, EloHistoryPoint, TournamentEvent } from '../services/api';
import { matchApi, deckApi, podDynamicsApi, eventApi } from '../services/api';
import type { PendingMatch } from '../types/matchTypes';
import offlineQueue from '../services/offlineQueue';

function StatusBadge({ status }: { status: string }) {
  const config = {
    setup: { label: 'Setup', bg: 'bg-[#25262B]', text: 'text-[#909296]' },
    active: { label: 'Active', bg: 'bg-[#E67700]/15', text: 'text-[#FFA94D]' },
    completed: { label: 'Completed', bg: 'bg-[#2B8A3E]/20', text: 'text-[#51CF66]' },
  }[status] || { label: status, bg: 'bg-[#25262B]', text: 'text-[#909296]' };

  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${config.bg} ${config.text}`}>
      {config.label}
    </span>
  );
}

/**
 * Dashboard page - main landing page showing stats, top players/decks, and recent matches
 */
export function Dashboard() {
  const navigate = useNavigate();
  const { currentPlayer, isGuest } = useAuth();
  const { currentPod, loading: podLoading } = usePod();
  const [matches, setMatches] = useState<Match[]>([]);
  const [pendingMatches, setPendingMatches] = useState<PendingMatch[]>([]);
  const [loadingMatches, setLoadingMatches] = useState(true);
  const [decks, setDecks] = useState<Deck[]>([]);
  const [eloHistoryByPlayer, setEloHistoryByPlayer] = useState<Map<string, EloHistoryPoint[]>>(new Map());
  const [events, setEvents] = useState<TournamentEvent[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(false);

  useEffect(() => {
    loadMatches();
    loadPendingMatches();
    loadDecks();
    loadEvents();

    // Listen for refresh events from MainLayout
    const handleRefreshMatches = () => {
      loadMatches();
      loadPendingMatches();
    };

    // Listen for pod switch events - refresh all data when switching pods
    const handlePodSwitch = () => {
      loadMatches();
      loadPendingMatches();
      loadDecks();
      loadEvents();
      // Trigger a full page refresh for child components
      window.dispatchEvent(new Event('podSwitched-refresh'));
    };

    window.addEventListener('refreshMatches', handleRefreshMatches);
    window.addEventListener('podSwitched', handlePodSwitch);
    return () => {
      window.removeEventListener('refreshMatches', handleRefreshMatches);
      window.removeEventListener('podSwitched', handlePodSwitch);
    };
  }, []);

  const loadMatches = async () => {
    try {
      setLoadingMatches(true);
      const matchesData = await matchApi.getRecent(3);
      setMatches(matchesData);

      // Load ELO history for all unique players in these matches
      loadEloHistoryForMatches(matchesData);
    } catch (err) {
      console.error('Error loading matches:', err);
    } finally {
      setLoadingMatches(false);
    }
  };

  const loadDecks = async () => {
    try {
      const decksData = await deckApi.getAll();
      setDecks(decksData);
    } catch (err) {
      console.error('Error loading decks:', err);
    }
  };

  const loadEloHistoryForMatches = async (matchesData: Match[]) => {
    try {
      // Get unique player IDs from matches
      const playerIds = new Set<string>();
      matchesData.forEach((match) => {
        match.players.forEach((player) => {
          playerIds.add(player.player_id);
        });
      });

      // Fetch ELO history for each player
      const historyMap = new Map<string, EloHistoryPoint[]>();
      await Promise.all(
        Array.from(playerIds).map(async (playerId) => {
          try {
            const data = await podDynamicsApi.getEloHistory(playerId);
            if (data.history && data.history.length > 0) {
              historyMap.set(playerId, data.history);
            }
          } catch (err) {
            // Silently fail for individual player - ELO just won't show
            console.debug(`Failed to load ELO history for player ${playerId}:`, err);
          }
        })
      );

      setEloHistoryByPlayer(historyMap);
    } catch (err) {
      console.error('Error loading ELO history:', err);
    }
  };

  const loadPendingMatches = async () => {
    try {
      const allQueuedMatches = await offlineQueue.getAllMatches();
      // Convert queued matches to PendingMatch format
      const pending: PendingMatch[] = allQueuedMatches.map((qm) => {
        // Create lookup maps from snapshots for efficient access
        const playerNames = Object.fromEntries(
          qm.metadata.playerSnapshots.map(p => [p.id, p.name])
        );
        const deckNames = Object.fromEntries(
          qm.metadata.deckSnapshots.map(d => [d.id, d.name])
        );

        return {
          id: qm.id,
          _pending: true as const,
          _tempId: qm.id,
          _canUndo: false, // Can't undo from dashboard view
          players: qm.matchData.player_deck_pairs.map((pair) => ({
            player_id: pair.player_id,
            player_name: playerNames[pair.player_id] || 'Unknown Player',
            deck_id: pair.deck_id,
            deck_name: deckNames[pair.deck_id] || 'Unknown Deck',
            deck_colors: [], // Colors not stored in queue snapshots
            is_winner: pair.player_id === qm.matchData.winner_player_id,
          })),
          winner_player_id: qm.matchData.winner_player_id,
          winner_deck_id: qm.matchData.winner_deck_id,
          match_date: qm.matchData.match_date,
          created_at: new Date(qm.metadata.queuedAt).toISOString(),
        };
      });
      setPendingMatches(pending);
    } catch (err) {
      console.error('Error loading pending matches:', err);
    }
  };

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

  const handleViewPlayerDetail = (playerId: string) => {
    navigate(`/players/${playerId}`);
  };

  // Create deck lookup map for RecentMatches
  const deckMap = useMemo(() => {
    const map = new Map<string, Deck>();
    decks.forEach((deck) => {
      if (deck.id) {
        map.set(deck.id, deck);
      }
    });
    return map;
  }, [decks]);

  // Show placeholder if authenticated but no pod selected
  if (!isGuest && currentPlayer && !currentPod && !podLoading) {
    return <NoPodPlaceholder />;
  }

  return (
    <div>
      <StatsCards />

      {/* Events Section */}
      {!isGuest && currentPod && (
        <div className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <IconTrophy size={20} className="text-[#667eea]" />
              Events
            </h2>
            <button
              onClick={() => navigate('/event/create')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] text-sm font-medium text-[#667eea] bg-[#667eea]/10 border border-[#667eea]/20 hover:bg-[#667eea]/20 transition-colors"
            >
              <IconPlus size={16} />
              Create Event
            </button>
          </div>

          {loadingEvents ? (
            <div className="text-center py-4 text-[#909296] text-sm">Loading events...</div>
          ) : events.length === 0 ? (
            <div className="bg-[#1A1B1E] rounded-[12px] border border-[#2C2E33] p-6 text-center">
              <IconTrophy size={32} className="mx-auto mb-2 text-[#5C5F66]" />
              <p className="text-sm text-[#909296]">No events yet</p>
              <p className="text-xs text-[#5C5F66] mt-1">Create a tournament for your pod!</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {events.slice(0, 6).map(event => (
                <button
                  key={event.id}
                  onClick={() => navigate(`/event/${event.id}`)}
                  className="bg-[#1A1B1E] rounded-[12px] border border-[#2C2E33] p-4 text-left hover:border-[#667eea]/40 transition-colors"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-white text-sm truncate">{event.name}</span>
                    <StatusBadge status={event.status} />
                  </div>
                  <div className="flex items-center gap-3 text-xs text-[#909296]">
                    <span>{event.player_count} players</span>
                    <span>&middot;</span>
                    <span>{event.round_count} rounds</span>
                    <span>&middot;</span>
                    <span>{new Date(event.event_date).toLocaleDateString()}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <TopPlayers
          onViewLeaderboard={() => navigate('/leaderboard')}
          onPlayerClick={handleViewPlayerDetail}
        />
        <TopDecks
          onViewLeaderboard={() => navigate('/leaderboard')}
          onPlayerClick={handleViewPlayerDetail}
        />
      </div>

      <RecentMatches
        matches={[...pendingMatches, ...matches]}
        deckMap={deckMap}
        eloHistoryByPlayer={eloHistoryByPlayer}
        loading={loadingMatches}
        onViewAll={() => navigate('/matches')}
      />
    </div>
  );
}
