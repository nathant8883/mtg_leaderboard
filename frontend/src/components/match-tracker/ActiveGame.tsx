import { useState, useEffect } from 'react';
import type { PlayerSlot, LayoutType, ActiveGameState } from '../../pages/MatchTracker';

interface ActiveGameProps {
  players: PlayerSlot[];
  layout: LayoutType;
  gameState: ActiveGameState;
  onGameComplete: (winnerPosition: number) => void;
  onExit: () => void;
  onUpdateGameState: (gameState: ActiveGameState) => void;
}

function ActiveGame({ players, layout, gameState, onGameComplete, onExit, onUpdateGameState }: ActiveGameProps) {
  const [timer, setTimer] = useState(0);

  // Timer logic
  useEffect(() => {
    const interval = setInterval(() => {
      setTimer((prev) => prev + 1);
      onUpdateGameState({
        ...gameState,
        elapsedSeconds: timer + 1,
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [timer]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleLifeChange = (position: number, delta: number) => {
    const currentLife = gameState.playerStates[position].life;
    const newLife = Math.max(0, currentLife + delta);

    const updatedState = {
      ...gameState,
      playerStates: {
        ...gameState.playerStates,
        [position]: {
          ...gameState.playerStates[position],
          life: newLife,
          eliminated: newLife <= 0,
        },
      },
    };

    onUpdateGameState(updatedState);

    // Check if only one player remains
    const remainingPlayers = Object.values(updatedState.playerStates).filter((p) => !p.eliminated);
    if (remainingPlayers.length === 1) {
      const winnerPosition = Object.keys(updatedState.playerStates).find(
        (pos) => !updatedState.playerStates[parseInt(pos)].eliminated
      );
      if (winnerPosition) {
        onGameComplete(parseInt(winnerPosition));
      }
    }
  };

  const playerCount = players.length;

  return (
    <div className="active-game">
      {/* Header */}
      <div className="header">
        <div className="header-title">⚡ Commander Game</div>
        <div className="timer">
          ⏱️ <span>{formatTime(timer)}</span>
        </div>
        <button className="end-game-btn" onClick={() => {
          const winner = Object.keys(gameState.playerStates).find(
            (pos) => !gameState.playerStates[parseInt(pos)].eliminated
          );
          onGameComplete(winner ? parseInt(winner) : players[0].position);
        }}>
          End Game
        </button>
      </div>

      {/* Player Cards in Game Layout */}
      <div className={`players-grid layout-${layout} players-${playerCount}`}>
        {players.map((player) => {
          const playerState = gameState.playerStates[player.position];
          return (
            <div
              key={player.position}
              className={`player-card ${playerState.eliminated ? 'eliminated' : ''}`}
            >
              {playerState.eliminated && <div className="eliminated-overlay">Eliminated</div>}

              <div className="player-info">
                <div>
                  <div className="player-name">{player.playerName}</div>
                  <div className="player-deck">{player.deckName}</div>
                </div>
                {!playerState.eliminated && (
                  <button
                    className="eliminate-btn"
                    onClick={() => {
                      const updatedState = {
                        ...gameState,
                        playerStates: {
                          ...gameState.playerStates,
                          [player.position]: {
                            ...gameState.playerStates[player.position],
                            eliminated: true,
                          },
                        },
                      };
                      onUpdateGameState(updatedState);

                      const remainingPlayers = Object.values(updatedState.playerStates).filter((p) => !p.eliminated);
                      if (remainingPlayers.length === 1) {
                        const winnerPosition = Object.keys(updatedState.playerStates).find(
                          (pos) => !updatedState.playerStates[parseInt(pos)].eliminated
                        );
                        if (winnerPosition) {
                          onGameComplete(parseInt(winnerPosition));
                        }
                      }
                    }}
                  >
                    Eliminate
                  </button>
                )}
              </div>

              <div className="life-section">
                <div className="life-total" onClick={() => {
                  // TODO: Open life input modal
                }}>
                  {playerState.life}
                </div>
                <div className="life-controls">
                  <button
                    className="life-btn"
                    onClick={() => handleLifeChange(player.position, -1)}
                    disabled={playerState.eliminated}
                  >
                    −
                  </button>
                  <button
                    className="life-btn"
                    onClick={() => handleLifeChange(player.position, 1)}
                    disabled={playerState.eliminated}
                  >
                    +
                  </button>
                </div>
                <div className="swipe-indicator">← Swipe for Commander Damage →</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default ActiveGame;
