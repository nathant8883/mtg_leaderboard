import type { PlayerSlot, ActiveGameState } from '../../pages/MatchTracker';

interface WinnerScreenProps {
  players: PlayerSlot[];
  gameState?: ActiveGameState;
  winnerPosition?: number;
  onSave: () => void;
  onDiscard: () => void;
}

function WinnerScreen({ players, gameState, winnerPosition, onSave, onDiscard }: WinnerScreenProps) {
  // Find winner by position
  const winner = winnerPosition
    ? players.find((p) => p.position === winnerPosition)
    : players.find((p) => gameState && !gameState.playerStates[p.position]?.eliminated);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="winner-screen">
      {/* Left Side - Winner Info */}
      <div className="winner-info-section">
        {winner && (
          <div className="winner-card">
            <div className="trophy-icon">🏆</div>
            {winner.commanderImageUrl ? (
              <img
                src={winner.commanderImageUrl}
                alt={winner.commanderName}
                className="winner-commander-art"
              />
            ) : (
              <div className="winner-commander-art winner-placeholder">🎴</div>
            )}
            <div className="winner-info">
              <div className="winner-name">{winner.playerName}</div>
              <div className="winner-deck">{winner.deckName}</div>
            </div>
          </div>
        )}
      </div>

      {/* Right Side - Match Stats */}
      <div className="match-stats-section">
        <div className="winner-stats-grid">
          <div className="stat-row">
            <div className="stat-label">
              <span className="stat-icon">⏱️</span>
              <span>Duration</span>
            </div>
            <div className="stat-value highlight">
              {gameState ? formatDuration(gameState.elapsedSeconds) : '0:00'}
            </div>
          </div>

          <div className="stat-row">
            <div className="stat-label">
              <span className="stat-icon">👥</span>
              <span>Players</span>
            </div>
            <div className="stat-value">{players.length}</div>
          </div>
        </div>

        <div className="action-buttons">
          <button className="action-btn discard-btn" onClick={onDiscard}>
            <span>✕</span>
            <span>Discard</span>
          </button>
          <button className="action-btn save-btn" onClick={onSave}>
            <span>💾</span>
            <span>Save Match</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export default WinnerScreen;
