import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { eventApi, matchApi, playerApi } from '../services/api';
import type { TournamentEvent, Player, CreateMatchRequest } from '../services/api';
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
  const [allPlayers, setAllPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [matchState, setMatchState] = useState<MatchState | null>(null);
  const [showExitModal, setShowExitModal] = useState(false);
  const [isAltWin, setIsAltWin] = useState(false);
  const [saving, setSaving] = useState(false);

  // Load event data + players on mount
  useEffect(() => {
    if (!eventId) return;

    const loadData = async () => {
      try {
        setLoading(true);
        setError(null);

        const [eventData, playersData] = await Promise.all([
          eventApi.getById(eventId),
          playerApi.getAll(),
        ]);

        setEvent(eventData);
        setAllPlayers(playersData);

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

        // Build PlayerSlot[] from pod.player_ids
        const slots: PlayerSlot[] = pod.player_ids.map((pid, i) => {
          const player = playersData.find((p) => p.id === pid);
          return {
            position: i + 1,
            playerId: pid,
            playerName:
              player?.name ||
              eventData.players.find((ep) => ep.player_id === pid)?.player_name ||
              'Unknown',
            deckId: null, // Not selected yet
            deckName: '', // Not selected yet
            commanderName: '',
            commanderImageUrl: '',
            isGuest: false,
            killMessages: player?.kill_messages || [],
          };
        });

        // Initialize match state starting at assignment step (deck selection)
        setMatchState({
          playerCount: slots.length,
          players: slots,
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
  }, [eventId, podIndex]);

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

      toast.success('Match saved! Tournament updated.');
      navigate(`/event/${eventId}`);
    } catch (err: any) {
      console.error('[EventMatchTracker] Failed to save event match:', err);
      const message = err?.response?.data?.detail || 'Failed to save match';
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }, [matchState, event, eventId, podIndex, isAltWin, navigate]);

  // Handle match discard — navigate back to event dashboard
  const handleMatchDiscard = useCallback(() => {
    if (eventId) {
      navigate(`/event/${eventId}`);
    } else {
      navigate('/');
    }
  }, [eventId, navigate]);

  // Exit game handlers
  const handleExitGame = useCallback(() => {
    setShowExitModal(true);
  }, []);

  const handleExitCancel = useCallback(() => {
    setShowExitModal(false);
  }, []);

  const handleExitConfirm = useCallback(() => {
    setShowExitModal(false);
    handleMatchDiscard();
  }, [handleMatchDiscard]);

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
