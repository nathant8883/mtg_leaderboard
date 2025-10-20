import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import GameSetup from '../components/match-tracker/GameSetup';
import PlayerAssignment from '../components/match-tracker/PlayerAssignment';
import ActiveGame from '../components/match-tracker/ActiveGame';
import WinnerScreen from '../components/match-tracker/WinnerScreen';
import { playerApi, deckApi, Player, Deck } from '../services/api';
import offlineQueue from '../services/offlineQueue';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

export type LayoutType = 'table';
export type StepType = 'setup' | 'assignment' | 'game' | 'winner';

export interface PlayerSlot {
  position: number; // 1-6
  playerId: string | null;
  playerName: string;
  deckId: string | null;
  deckName: string;
  commanderName: string;
  commanderImageUrl: string;
  isGuest: boolean;
}

export interface PlayerGameState {
  life: number;
  eliminated: boolean;
  eliminatedBy?: string; // player position who eliminated them
  commanderDamage: Record<string, number>; // damage from each opponent position
}

export interface ActiveGameState {
  startTime: Date;
  elapsedSeconds: number;
  playerStates: Record<number, PlayerGameState>; // keyed by position
}

export interface MatchState {
  playerCount: number;
  players: PlayerSlot[];
  layout: LayoutType;
  startingLife: number;
  currentStep: StepType;
  gameState?: ActiveGameState;
  winnerPosition?: number;
}

const STORAGE_KEY = 'mtg_active_match';

interface MatchTrackerProps {
  onExitToHome: () => void;
}

function MatchTracker({ onExitToHome }: MatchTrackerProps) {
  const { isOnline } = useOnlineStatus();
  const [players, setPlayers] = useState<Player[]>([]);
  const [decks, setDecks] = useState<Deck[]>([]);
  const [matchState, setMatchState] = useState<MatchState>(() => {
    // Try to load from localStorage on mount
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Convert startTime string back to Date
        if (parsed.gameState?.startTime) {
          parsed.gameState.startTime = new Date(parsed.gameState.startTime);
        }
        return parsed;
      } catch (e) {
        console.error('Failed to parse saved match state:', e);
      }
    }
    // Default initial state
    return {
      playerCount: 4,
      players: [],
      layout: 'table',
      startingLife: 40,
      currentStep: 'setup',
    };
  });

  const [showResumeModal, setShowResumeModal] = useState(false);

  // Check for saved match on mount
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && matchState.currentStep === 'setup' && matchState.players.length === 0) {
      setShowResumeModal(true);
    }
  }, []);

  // Save to localStorage whenever state changes (except on initial load)
  useEffect(() => {
    if (matchState.players.length > 0) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(matchState));
    }
  }, [matchState]);

  // Load players and decks - SW cache will serve if available
  useEffect(() => {
    const loadData = async () => {
      try {
        console.log('[MatchTracker] Fetching players and decks...');
        const [playersData, decksData] = await Promise.all([
          playerApi.getAll(),
          deckApi.getAll(),
        ]);
        setPlayers(playersData);
        setDecks(decksData);
        console.log(`[MatchTracker] ✅ Loaded ${playersData.length} players and ${decksData.length} decks`);
      } catch (error) {
        console.error('[MatchTracker] ❌ Failed to load data:', error);
      }
    };
    loadData();
  }, []);

  const handleGameConfig = (playerCount: number, startingLife: number) => {
    // Initialize empty player slots
    const emptyPlayers: PlayerSlot[] = Array.from({ length: playerCount }, (_, i) => ({
      position: i + 1,
      playerId: null,
      playerName: '',
      deckId: null,
      deckName: '',
      commanderName: '',
      commanderImageUrl: '',
      isGuest: false,
    }));

    setMatchState({
      ...matchState,
      playerCount,
      players: emptyPlayers,
      layout: 'table',
      startingLife,
      currentStep: 'assignment',
    });
  };

  const handlePlayerAssignment = (players: PlayerSlot[]) => {
    // Initialize game state
    const gameState: ActiveGameState = {
      startTime: new Date(),
      elapsedSeconds: 0,
      playerStates: {},
    };

    players.forEach((player) => {
      gameState.playerStates[player.position] = {
        life: matchState.startingLife,
        eliminated: false,
        commanderDamage: {},
      };
    });

    setMatchState({
      ...matchState,
      players,
      currentStep: 'game',
      gameState,
    });
  };

  const handleGameComplete = (winnerPosition: number, finalGameState?: ActiveGameState) => {
    setMatchState({
      ...matchState,
      gameState: finalGameState || matchState.gameState,
      currentStep: 'winner',
      winnerPosition: winnerPosition,
    });
  };

  const handleMatchSave = async () => {
    if (!matchState.gameState || !matchState.winnerPosition) {
      console.error('Cannot save match: missing game state or winner');
      return;
    }

    try {
      const winner = matchState.players.find(p => p.position === matchState.winnerPosition);
      if (!winner || !winner.playerId || !winner.deckId) {
        toast.error('Winner must be a registered player with a deck (not a guest)');
        return;
      }

      // Filter out guest players and prepare player-deck pairs
      const playerDeckPairs = matchState.players
        .filter(p => p.playerId && p.deckId) // Only registered players
        .map(p => ({
          player_id: p.playerId!,
          deck_id: p.deckId!,
        }));

      if (playerDeckPairs.length < 3) {
        toast.error('At least 3 registered players required to save match (guests cannot be saved)');
        return;
      }

      // Use the game start time as match date (format as YYYY-MM-DD)
      const matchDate = matchState.gameState.startTime.toISOString().split('T')[0];

      const matchRequest = {
        player_deck_pairs: playerDeckPairs,
        winner_player_id: winner.playerId,
        winner_deck_id: winner.deckId,
        match_date: matchDate,
        duration_seconds: matchState.gameState.elapsedSeconds,
      };

      // Add to IndexedDB queue (offline-first approach)
      const queuedMatch = await offlineQueue.addMatch(matchRequest, players, decks);

      if (!queuedMatch) {
        // Duplicate detected
        toast.error('This match was already recorded recently', {
          duration: 4000,
          position: 'top-center',
        });
        return;
      }

      // Show success message based on online status
      toast.success(
        isOnline ? '✅ Match saved! Syncing to server...' : '📴 Match saved offline - will sync when online',
        {
          duration: 3000,
          position: 'top-center',
        }
      );

      // Try to sync immediately if online
      if (isOnline) {
        await offlineQueue.syncMatch(queuedMatch.id, {
          onSuccess: () => {
            console.log('[MatchTracker] Match synced successfully');
            toast.success('Match synced to server!', {
              duration: 2000,
              position: 'top-center',
            });
          },
          onError: (error) => {
            console.error('[MatchTracker] Failed to sync match:', error);
            toast.error(`Sync failed: ${error.message}. Match saved in queue.`, {
              duration: 4000,
              position: 'top-center',
            });
          },
        });
      }

      // Clear localStorage after queuing (regardless of sync status)
      localStorage.removeItem(STORAGE_KEY);

      // Navigate back to dashboard
      onExitToHome();
    } catch (error) {
      console.error('Failed to save match:', error);
      toast.error('Failed to record match. Please try again.');
    }
  };

  const handleMatchDiscard = () => {
    localStorage.removeItem(STORAGE_KEY);
    setMatchState({
      playerCount: 4,
      players: [],
      layout: 'table',
      startingLife: 40,
      currentStep: 'setup',
    });
  };

  const handleResumeGame = () => {
    setShowResumeModal(false);
    // State is already loaded from localStorage
  };

  const handleStartNewGame = () => {
    setShowResumeModal(false);
    localStorage.removeItem(STORAGE_KEY);
    setMatchState({
      playerCount: 4,
      players: [],
      layout: 'table',
      startingLife: 40,
      currentStep: 'setup',
    });
  };

  const handleExitGame = () => {
    if (window.confirm('Are you sure you want to exit? Unsaved progress will be lost.')) {
      handleMatchDiscard();
    }
  };

  return (
    <div className="fixed top-0 left-0 right-0 bottom-0 min-h-screen max-h-screen bg-gradient-to-br from-[#1a1b1e] to-[#2c2e33] text-white p-0 m-0 overflow-hidden">
      {showResumeModal && (
        <div className="fixed top-0 left-0 right-0 bottom-0 bg-[rgba(0,0,0,0.8)] flex items-center justify-center z-[1000] p-4">
          <div className="bg-[#1a1b1e] border border-[#2c2e33] rounded-[12px] p-6 max-w-[500px] w-full max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-semibold m-0 mb-4">Resume Game?</h2>
            <p className="mb-6">You have an active game in progress. Would you like to resume it?</p>
            <div className="flex gap-3 mt-6">
              <button
                className="flex-1 py-3 px-6 bg-[#2c2e33] border border-[#3c3e43] rounded-[8px] text-white text-sm font-semibold cursor-pointer transition-all hover:bg-[#3c3e43]"
                onClick={handleStartNewGame}
              >
                Start New
              </button>
              <button
                className="flex-1 py-3 px-6 bg-gradient-purple border-none rounded-[8px] text-white text-sm font-semibold cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-[0_4px_12px_rgba(102,126,234,0.4)]"
                onClick={handleResumeGame}
              >
                Resume
              </button>
            </div>
          </div>
        </div>
      )}

      {matchState.currentStep === 'setup' && (
        <GameSetup
          initialPlayerCount={matchState.playerCount}
          initialStartingLife={matchState.startingLife}
          onComplete={handleGameConfig}
          onExit={onExitToHome}
        />
      )}

      {matchState.currentStep === 'assignment' && (
        <PlayerAssignment
          playerCount={matchState.playerCount}
          players={matchState.players}
          layout={matchState.layout}
          onComplete={handlePlayerAssignment}
          onBack={() => setMatchState({ ...matchState, currentStep: 'setup' })}
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
        />
      )}

      {matchState.currentStep === 'winner' && (
        <WinnerScreen
          players={matchState.players}
          gameState={matchState.gameState}
          winnerPosition={matchState.winnerPosition}
          onSave={handleMatchSave}
          onDiscard={handleMatchDiscard}
        />
      )}
    </div>
  );
}

export default MatchTracker;
