import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { eventApi, matchApi } from '../services/api';
import type { TournamentEvent, CreateMatchRequest } from '../services/api';
import toast from 'react-hot-toast';

// Reuse existing match tracker components
import PlayerAssignment from '../components/match-tracker/PlayerAssignment';
import ActiveGame from '../components/match-tracker/ActiveGame';
import WinnerScreen from '../components/match-tracker/WinnerScreen';
import LandscapePrompt from '../components/LandscapePrompt';
import ExitConfirmModal from '../components/match-tracker/ExitConfirmModal';
import { useWakeLock } from '../hooks/useWakeLock';
import { useOrientationLock } from '../hooks/useOrientationLock';

// Types from MatchTracker
import type { PlayerSlot, ActiveGameState, MatchState, LayoutType } from './MatchTracker';

const EVENT_MATCH_POINTER_KEY = 'mtg_active_event_match';

interface EventMatchSavedState {
  matchState: MatchState;
  isAltWin: boolean;
  eventId: string;
  podIndex: number;
  currentRound: number;
  savedAt: number;
}

export function EventMatchTracker() {
  const { eventId, podIndex: podIndexStr } = useParams<{ eventId: string; podIndex: string }>();
  const navigate = useNavigate();
  const { currentPlayer } = useAuth();
  const podIndex = parseInt(podIndexStr || '0', 10);

  // Prevent screen timeout during match play
  useWakeLock();

  // Lock screen orientation to landscape
  const orientationLockStatus = useOrientationLock();

  const [event, setEvent] = useState<TournamentEvent | null>(null);
  const [podPlayerIds, setPodPlayerIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [matchState, setMatchState] = useState<MatchState | null>(null);
  const [showExitModal, setShowExitModal] = useState(false);
  const [isAltWin, setIsAltWin] = useState(false);
  const [saving, setSaving] = useState(false);

  const storageKey = useMemo(
    () => `mtg_event_match_${eventId}_${podIndex}`,
    [eventId, podIndex]
  );

  // Load event data + players on mount
  useEffect(() => {
    if (!eventId) return;

    const loadData = async () => {
      try {
        setLoading(true);
        setError(null);

        const eventData = await eventApi.getById(eventId);
        setEvent(eventData);

        // Find the current round
        const currentRound = eventData.rounds.find(
          (r) => r.round_number === eventData.current_round
        );

        if (!currentRound) {
          setError('Current round not found');
          return;
        }

        // Find the pod
        const pod = currentRound.pods[podIndex];
        if (!pod) {
          setError(`Pod ${podIndex} not found in round ${eventData.current_round}`);
          return;
        }

        setPodPlayerIds(pod.player_ids);

        // Try to restore from localStorage
        const saved = localStorage.getItem(storageKey);
        if (saved) {
          try {
            const parsed: EventMatchSavedState = JSON.parse(saved);

            // Validate: round matches, pod is still in_progress, not older than 24h
            const isRoundMatch = parsed.currentRound === eventData.current_round;
            const isPodInProgress = pod.match_status === 'in_progress';
            const isRecent = Date.now() - parsed.savedAt < 24 * 60 * 60 * 1000;

            if (isRoundMatch && isPodInProgress && isRecent) {
              // Convert startTime string back to Date
              if (parsed.matchState.gameState?.startTime) {
                parsed.matchState.gameState.startTime = new Date(
                  parsed.matchState.gameState.startTime
                );
              }
              setMatchState(parsed.matchState);
              setIsAltWin(parsed.isAltWin);
              console.log('[EventMatchTracker] Restored match state from localStorage');
              return;
            }
          } catch (e) {
            console.error('[EventMatchTracker] Failed to parse saved state:', e);
          }
          // Invalid saved state — clear it
          localStorage.removeItem(storageKey);
          localStorage.removeItem(EVENT_MATCH_POINTER_KEY);
        }

        // Create empty slots like regular MatchTracker
        // For odd player counts, create extra slots so players can choose positions
        const podSize = pod.player_ids.length;
        const totalSlots = podSize === 3 ? 4 : podSize === 5 ? 6 : podSize;
        const emptyPlayers: PlayerSlot[] = Array.from({ length: totalSlots }, (_, i) => ({
          position: i + 1,
          playerId: null,
          playerName: '',
          deckId: null,
          deckName: '',
          commanderName: '',
          commanderImageUrl: '',
          isGuest: false,
        }));

        // Initialize match state starting at assignment step (player + deck selection)
        setMatchState({
          playerCount: podSize,
          players: emptyPlayers,
          layout: 'table' as LayoutType,
          startingLife: 40,
          currentStep: 'assignment',
        });
      } catch (err: any) {
        console.error('[EventMatchTracker] Failed to load data:', err);
        const message = err?.response?.data?.detail || 'Failed to load event data';
        setError(message);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [eventId, podIndex, storageKey]);

  // Auto-save to localStorage whenever match state changes
  useEffect(() => {
    if (!matchState || !eventId || !event) return;
    if (matchState.players.length === 0) return;

    const savedState: EventMatchSavedState = {
      matchState,
      isAltWin,
      eventId,
      podIndex,
      currentRound: event.current_round,
      savedAt: Date.now(),
    };
    localStorage.setItem(storageKey, JSON.stringify(savedState));
    localStorage.setItem(EVENT_MATCH_POINTER_KEY, JSON.stringify({ eventId, podIndex }));
  }, [matchState, isAltWin, eventId, podIndex, event, storageKey]);

  // Handle player assignment (deck selection) completion
  const handlePlayerAssignment = useCallback(
    (players: PlayerSlot[]) => {
      if (!matchState) return;

      // Filter out empty slots (for odd-number games where we create extra slots)
      const activePlayers = players.filter((p) => p.playerId !== null);

      // Initialize game state
      const gameState: ActiveGameState = {
        startTime: new Date(),
        elapsedSeconds: 0,
        playerStates: {},
      };

      activePlayers.forEach((player) => {
        gameState.playerStates[player.position] = {
          life: matchState.startingLife,
          eliminated: false,
          eliminatedAt: null,
          revived: false,
          forceEliminated: false,
          commanderDamage: {},
          eliminationConfirmed: false,
        };
      });

      setMatchState({
        ...matchState,
        players: activePlayers,
        currentStep: 'game',
        gameState,
      });
    },
    [matchState]
  );

  // Handle game completion
  const handleGameComplete = useCallback(
    (winnerPosition: number, finalGameState?: ActiveGameState) => {
      if (!matchState || (!finalGameState && !matchState.gameState)) return;

      setMatchState({
        ...matchState,
        gameState: finalGameState || matchState.gameState,
        currentStep: 'winner',
        winnerPosition,
      });
    },
    [matchState]
  );

  // Handle match save — creates match + completes tournament match
  const handleMatchSave = useCallback(async () => {
    if (!matchState?.gameState || !matchState.winnerPosition || !event || !eventId) return;

    try {
      setSaving(true);

      const winner = matchState.players.find(
        (p) => p.position === matchState.winnerPosition
      );
      if (!winner?.playerId || !winner?.deckId) {
        toast.error('Winner data is incomplete');
        return;
      }

      // Build player-deck pairs
      const playerDeckPairs = matchState.players
        .filter((p) => p.playerId && p.deckId)
        .map((p) => ({ player_id: p.playerId!, deck_id: p.deckId! }));

      const matchDate = matchState.gameState.startTime.toISOString().split('T')[0];

      // Calculate first player position index
      let firstPlayerPosition: number | undefined;
      if (matchState.gameState.firstPlayerPosition !== undefined) {
        const firstPlayer = matchState.players.find(
          (p) => p.position === matchState.gameState!.firstPlayerPosition
        );
        if (firstPlayer?.playerId) {
          firstPlayerPosition = playerDeckPairs.findIndex(
            (p) => p.player_id === firstPlayer.playerId
          );
        }
      }

      // Calculate elimination orders
      const eliminationOrders: Record<string, number> = {};
      const playerStates = matchState.gameState.playerStates;

      const eliminatedWithTimestamps = matchState.players
        .filter(
          (p) =>
            p.playerId &&
            playerStates[p.position]?.eliminated &&
            playerStates[p.position]?.eliminatedAt
        )
        .map((p) => ({
          playerId: p.playerId!,
          eliminatedAt: playerStates[p.position].eliminatedAt!,
        }))
        .sort((a, b) => b.eliminatedAt - a.eliminatedAt);

      if (winner.playerId) {
        eliminationOrders[winner.playerId] = 1;
      }

      eliminatedWithTimestamps.forEach((player, idx) => {
        if (player.playerId !== winner.playerId) {
          eliminationOrders[player.playerId] = idx + 2;
        }
      });

      // Build elimination details
      const eliminationDetails: Record<
        string,
        { eliminated_by_player_id?: string; elimination_type: 'kill' | 'scoop' }
      > = {};
      for (const player of matchState.players) {
        if (!player.playerId) continue;
        const state = playerStates[player.position];
        if (state?.eliminationConfirmed && state.eliminationType) {
          eliminationDetails[player.playerId] = {
            eliminated_by_player_id: state.eliminatedByPlayerId || undefined,
            elimination_type: state.eliminationType,
          };
        }
      }

      const matchRequest: CreateMatchRequest = {
        player_deck_pairs: playerDeckPairs,
        winner_player_id: winner.playerId,
        winner_deck_id: winner.deckId,
        match_date: matchDate,
        duration_seconds: matchState.gameState.elapsedSeconds,
        first_player_position: firstPlayerPosition,
        elimination_orders:
          Object.keys(eliminationOrders).length > 0 ? eliminationOrders : undefined,
        elimination_details:
          Object.keys(eliminationDetails).length > 0 ? eliminationDetails : undefined,
      };

      // Step 1: Save match to server
      const savedMatch = await matchApi.create(matchRequest);

      // Step 2: Complete the tournament match (updates scores)
      await eventApi.completeMatch(
        eventId,
        event.current_round,
        podIndex,
        savedMatch.id!,
        isAltWin
      );

      localStorage.removeItem(storageKey);
      localStorage.removeItem(EVENT_MATCH_POINTER_KEY);
      toast.success('Match saved! Tournament updated.');
      navigate(`/event/${eventId}`);
    } catch (err: any) {
      console.error('[EventMatchTracker] Failed to save event match:', err);
      const message = err?.response?.data?.detail || 'Failed to save match';
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }, [matchState, event, eventId, podIndex, isAltWin, navigate, storageKey]);

  // Handle match discard — cancel match on backend and navigate back
  const handleMatchDiscard = useCallback(async () => {
    localStorage.removeItem(storageKey);
    localStorage.removeItem(EVENT_MATCH_POINTER_KEY);
    if (eventId && event) {
      try {
        await eventApi.cancelMatch(eventId, event.current_round, podIndex);
      } catch (err) {
        // Best-effort cancel — still navigate away even if it fails
        console.warn('[EventMatchTracker] Failed to cancel match:', err);
      }
      navigate(`/event/${eventId}`);
    } else {
      navigate('/');
    }
  }, [eventId, event, podIndex, navigate, storageKey]);

  // Exit game handlers
  const handleExitGame = useCallback(() => {
    setShowExitModal(true);
  }, []);

  const handleExitCancel = useCallback(() => {
    setShowExitModal(false);
  }, []);

  const handleExitConfirm = useCallback(async () => {
    setShowExitModal(false);
    localStorage.removeItem(storageKey);
    localStorage.removeItem(EVENT_MATCH_POINTER_KEY);

    // Cancel match on backend (best-effort)
    if (eventId && event) {
      try {
        await eventApi.cancelMatch(eventId, event.current_round, podIndex);
      } catch (err) {
        console.warn('[EventMatchTracker] Failed to cancel match:', err);
      }
    }

    navigate(eventId ? `/event/${eventId}` : '/');
  }, [storageKey, eventId, event, podIndex, navigate]);

  // Loading state
  if (loading) {
    return (
      <div className="fixed top-0 left-0 right-0 bottom-0 min-h-screen max-h-screen bg-gradient-to-br from-[#1a1b1e] to-[#2c2e33] text-white flex items-center justify-center">
        <div className="text-center">
          <div className="text-[32px] mb-4 animate-pulse">🏆</div>
          <div className="text-[#909296] text-sm">Loading tournament match...</div>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !matchState) {
    return (
      <div className="fixed top-0 left-0 right-0 bottom-0 min-h-screen max-h-screen bg-gradient-to-br from-[#1a1b1e] to-[#2c2e33] text-white flex items-center justify-center">
        <div className="text-center max-w-[400px] px-4">
          <div className="text-[32px] mb-4">⚠️</div>
          <div className="text-[#ff6b6b] text-sm mb-4">{error || 'Failed to load match data'}</div>
          <button
            className="py-2 px-6 bg-[#2c2e33] border border-[#3c3e43] rounded-[8px] text-white text-sm font-semibold cursor-pointer transition-all hover:bg-[#3c3e43]"
            onClick={() => navigate(eventId ? `/event/${eventId}` : '/')}
          >
            Back to Event
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed top-0 left-0 right-0 bottom-0 min-h-screen max-h-screen bg-gradient-to-br from-[#1a1b1e] to-[#2c2e33] text-white p-0 m-0 overflow-hidden">
      {/* Landscape orientation prompt - only visible in portrait mode */}
      <LandscapePrompt isOrientationLocked={orientationLockStatus === 'locked'} />

      <ExitConfirmModal
        isOpen={showExitModal}
        onCancel={handleExitCancel}
        onConfirm={handleExitConfirm}
      />

      {matchState.currentStep === 'assignment' && (
        <PlayerAssignment
          playerCount={matchState.playerCount}
          players={matchState.players}
          layout={matchState.layout}
          onComplete={handlePlayerAssignment}
          onBack={handleMatchDiscard}
          allowedPlayerIds={podPlayerIds}
          hideGuestOption={true}
        />
      )}

      {matchState.currentStep === 'game' && matchState.gameState && (
        <ActiveGame
          players={matchState.players}
          layout={matchState.layout}
          gameState={matchState.gameState}
          onGameComplete={handleGameComplete}
          onExit={handleExitGame}
          onUpdateGameState={(newGameState) =>
            setMatchState({ ...matchState, gameState: newGameState })
          }
          isQuickPlay={false}
          onReset={handleMatchDiscard}
        />
      )}

      {matchState.currentStep === 'winner' && (
        <WinnerScreen
          players={matchState.players}
          gameState={matchState.gameState}
          winnerPosition={matchState.winnerPosition}
          onSave={handleMatchSave}
          onDiscard={handleMatchDiscard}
          showAltWinToggle={true}
          isAltWin={isAltWin}
          onAltWinChange={setIsAltWin}
          saving={saving}
          saveLabel="Save & Complete"
        />
      )}
    </div>
  );
}

export default EventMatchTracker;
