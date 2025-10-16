import type { PlayerSlot, ActiveGameState } from '../../pages/MatchTracker';

interface WinnerScreenProps {
  players: PlayerSlot[];
  gameState?: ActiveGameState;
  onSave: () => void;
  onDiscard: () => void;
}

function WinnerScreen({ players, gameState, onSave, onDiscard }: WinnerScreenProps) {
  // Find winner (non-eliminated player)
  const winner = players.find(
    (p) => gameState && !gameState.playerStates[p.position]?.eliminated
  );

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  return (
    <div className="winner-screen">
      <div className="winner-content">
        <h1 className="winner-title">🏆 Game Complete!</h1>

        {winner && (
          <div className="winner-card">
            {winner.commanderImageUrl ? (
              <img
                src={winner.commanderImageUrl}
                alt={winner.commanderName}
                className="winner-commander"
              />
            ) : (
              <div className="winner-placeholder">🎴</div>
            )}
            <h2 className="winner-name">{winner.playerName}</h2>
            <p className="winner-deck">{winner.deckName}</p>
            <p className="winner-commander">{winner.commanderName}</p>
          </div>
        )}

        {gameState && (
          <div className="match-summary">
            <h3>Match Summary</h3>
            <div className="summary-stat">
              <span className="summary-label">Duration:</span>
              <span className="summary-value">
                {formatDuration(gameState.elapsedSeconds)}
              </span>
            </div>
            <div className="summary-stat">
              <span className="summary-label">Players:</span>
              <span className="summary-value">{players.length}</span>
            </div>
          </div>
        )}

        <div className="winner-actions">
          <button className="btn-secondary" onClick={onDiscard}>
            Discard Match
          </button>
          <button className="btn-primary" onClick={onSave}>
            Save Match
          </button>
        </div>
      </div>
    </div>
  );
}

export default WinnerScreen;
