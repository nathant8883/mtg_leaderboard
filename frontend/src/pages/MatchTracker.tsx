import { useState, useEffect } from 'react';
import './MatchTracker.css';
import GameSetup from '../components/match-tracker/GameSetup';
import PlayerAssignment from '../components/match-tracker/PlayerAssignment';
import ActiveGame from '../components/match-tracker/ActiveGame';
import WinnerScreen from '../components/match-tracker/WinnerScreen';

export type LayoutType = 'grid' | 'horizontal' | 'vertical' | 'table' | 'sides' | 'circle';
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
}

const STORAGE_KEY = 'mtg_active_match';

interface MatchTrackerProps {
  onExitToHome: () => void;
}

function MatchTracker({ onExitToHome }: MatchTrackerProps) {
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
      layout: 'grid',
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

  const handleGameConfig = (playerCount: number, layout: LayoutType, startingLife: number) => {
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
      layout,
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

  const handleGameComplete = (winnerPosition: number) => {
    setMatchState({
      ...matchState,
      currentStep: 'winner',
    });
  };

  const handleMatchSave = async () => {
    // This will be implemented with API call
    console.log('Saving match...', matchState);
    // Clear localStorage after successful save
    localStorage.removeItem(STORAGE_KEY);
    // Navigate back to dashboard (will implement with parent callback)
  };

  const handleMatchDiscard = () => {
    localStorage.removeItem(STORAGE_KEY);
    setMatchState({
      playerCount: 4,
      players: [],
      layout: 'grid',
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
      layout: 'grid',
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
    <div className="match-tracker">
      {showResumeModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2>Resume Game?</h2>
            <p>You have an active game in progress. Would you like to resume it?</p>
            <div className="modal-actions">
              <button className="btn-secondary" onClick={handleStartNewGame}>
                Start New
              </button>
              <button className="btn-primary" onClick={handleResumeGame}>
                Resume
              </button>
            </div>
          </div>
        </div>
      )}

      {matchState.currentStep === 'setup' && (
        <GameSetup
          initialPlayerCount={matchState.playerCount}
          initialLayout={matchState.layout}
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
          onSave={handleMatchSave}
          onDiscard={handleMatchDiscard}
        />
      )}
    </div>
  );
}

export default MatchTracker;
