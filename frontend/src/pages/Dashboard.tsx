import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import StatsCards from '../components/StatsCards';
import TopPlayers from '../components/TopPlayers';
import TopDecks from '../components/TopDecks';
import RecentMatches from '../components/RecentMatches';
import { NoPodPlaceholder } from '../components/NoPodPlaceholder';
import { useAuth } from '../contexts/AuthContext';
import { usePod } from '../contexts/PodContext';
import { IconTrophy } from '@tabler/icons-react';
import type { Match, Deck, EloHistoryPoint, TournamentEvent } from '../services/api';
import { matchApi, deckApi, podDynamicsApi, eventApi } from '../services/api';
import type { PendingMatch } from '../types/matchTypes';
import offlineQueue from '../services/offlineQueue';

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
  const [activeEvent, setActiveEvent] = useState<TournamentEvent | null>(null);
  const [allEvents, setAllEvents] = useState<TournamentEvent[]>([]);

  useEffect(() => {
    loadMatches();
    loadPendingMatches();
    loadDecks();

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
      loadActiveEvent();
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

  useEffect(() => {
    loadActiveEvent();
  }, [currentPod?.id]);

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

  const loadActiveEvent = async () => {
    if (!currentPod?.id) {
      setActiveEvent(null);
      return;
    }
    try {
      const events = await eventApi.getByPod(currentPod.id);
      setAllEvents(events);
      setActiveEvent(events.find(e => e.status === 'active') || null);
    } catch (err) {
      console.error('Error loading active event:', err);
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

  // Create event lookup map for RecentMatches
  const eventMap = useMemo(() => {
    const map = new Map<string, TournamentEvent>();
    allEvents.forEach((event) => {
      if (event.id) map.set(event.id, event);
    });
    return map;
  }, [allEvents]);

  // Show placeholder if authenticated but no pod selected
  if (!isGuest && currentPlayer && !currentPod && !podLoading) {
    return <NoPodPlaceholder />;
  }

  return (
    <div>
      <StatsCards />

      {activeEvent && (
        <div className="mb-6">
        <div className="flex items-center gap-2 mb-2 px-1">
          <span className="text-xs font-semibold uppercase tracking-wider text-[#FFA94D]">
            Active {activeEvent.event_type}
          </span>
          <span className="h-px flex-1 bg-[#E67700]/20" />
        </div>
        <button
          onClick={() => navigate(`/event/${activeEvent.id}`)}
          className="w-full bg-[#E67700]/10 border border-[#E67700]/30 rounded-[12px] px-4 py-3 flex items-center gap-3 hover:bg-[#E67700]/15 transition-colors text-left"
        >
          {activeEvent.custom_image ? (
            <div className="w-9 h-9 rounded-[8px] overflow-hidden border border-[#E67700]/30 flex-shrink-0">
              <img src={activeEvent.custom_image} alt="" className="w-full h-full object-cover" />
            </div>
          ) : (
            <div className="flex items-center justify-center w-9 h-9 rounded-[8px] bg-[#E67700]/20 flex-shrink-0">
              <IconTrophy size={20} className="text-[#FFA94D]" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-white text-sm truncate">{activeEvent.name}</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide bg-[#E67700]/20 text-[#FFA94D]">
                Live
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs text-[#909296] mt-0.5">
              <span>{activeEvent.player_count} players</span>
              <span>&middot;</span>
              <span>Round {activeEvent.current_round}/{activeEvent.round_count}</span>
            </div>
          </div>
          <span className="text-[#909296] text-sm flex-shrink-0">&rsaquo;</span>
        </button>
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
        eventMap={eventMap}
        loading={loadingMatches}
        onViewAll={() => navigate('/matches')}
      />
    </div>
  );
}
