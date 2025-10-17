import { useState, useEffect, useRef } from 'react';
import type { PlayerSlot, LayoutType, ActiveGameState } from '../../pages/MatchTracker';
import LifeInputModal from './LifeInputModal';
import CommanderDamageOverlay from './CommanderDamageOverlay';

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
  const [showMenu, setShowMenu] = useState(false);
  const [lifeInputPlayer, setLifeInputPlayer] = useState<PlayerSlot | null>(null);
  const [commanderDamagePlayer, setCommanderDamagePlayer] = useState<PlayerSlot | null>(null);
  const [showWinnerSelect, setShowWinnerSelect] = useState(false);

  // Track touch start position for swipe detection
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);

  // Hold button state
  const holdTimerRef = useRef<NodeJS.Timeout | null>(null);
  const holdIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const holdStartTime = useRef<number | null>(null);
  const holdPosition = useRef<number | null>(null);
  const holdDelta = useRef<number | null>(null);

  // Keep a ref to the latest gameState to avoid closure issues
  const gameStateRef = useRef(gameState);
  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  // Timer logic - just for display, don't update gameState on every tick
  useEffect(() => {
    const interval = setInterval(() => {
      setTimer((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleLifeChange = (position: number, delta: number) => {
    // Read from ref to get the latest state
    const currentState = gameStateRef.current;
    const currentLife = currentState.playerStates[position].life;
    const newLife = Math.max(0, currentLife + delta);

    const updatedState = {
      ...currentState,
      playerStates: {
        ...currentState.playerStates,
        [position]: {
          ...currentState.playerStates[position],
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

  const clearHoldTimers = () => {
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
    if (holdIntervalRef.current) {
      clearInterval(holdIntervalRef.current);
      holdIntervalRef.current = null;
    }
  };

  const handleLifeButtonDown = (position: number, delta: number) => {
    // Clear any existing timers
    clearHoldTimers();

    // Store button state
    holdStartTime.current = Date.now();
    holdPosition.current = position;
    holdDelta.current = delta;

    // After 1 second, start incrementing by 10
    holdTimerRef.current = setTimeout(() => {
      // First increment immediately
      handleLifeChange(position, delta * 10);
      // Then continue every 1 second
      holdIntervalRef.current = setInterval(() => {
        handleLifeChange(position, delta * 10);
      }, 1000);
    }, 1000);
  };

  const handleLifeButtonUp = () => {
    // If released before 1 second, do a single increment
    const wasHolding = holdIntervalRef.current !== null;

    if (!wasHolding && holdStartTime.current !== null && holdPosition.current !== null && holdDelta.current !== null) {
      const elapsed = Date.now() - holdStartTime.current;
      if (elapsed < 1000) {
        handleLifeChange(holdPosition.current, holdDelta.current);
      }
    }

    clearHoldTimers();
    holdStartTime.current = null;
    holdPosition.current = null;
    holdDelta.current = null;
  };

  // Clean up timers on unmount
  useEffect(() => {
    return () => {
      clearHoldTimers();
    };
  }, []);

  const handleCommanderDamageUpdate = (playerPosition: number, opponentPosition: number, damage: number) => {
    const updatedState = {
      ...gameState,
      playerStates: {
        ...gameState.playerStates,
        [playerPosition]: {
          ...gameState.playerStates[playerPosition],
          commanderDamage: {
            ...(gameState.playerStates[playerPosition].commanderDamage || {}),
            [opponentPosition]: damage,
          },
          // Check if this player should be eliminated due to commander damage
          eliminated:
            gameState.playerStates[playerPosition].eliminated ||
            damage >= 21,
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

  // Swipe gesture handlers
  const handleTouchStart = (e: React.TouchEvent, player: PlayerSlot) => {
    if (gameState.playerStates[player.position].eliminated) return;
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent, player: PlayerSlot) => {
    if (gameState.playerStates[player.position].eliminated) return;
    if (touchStartX.current === null || touchStartY.current === null) return;

    const touchEndX = e.changedTouches[0].clientX;
    const touchEndY = e.changedTouches[0].clientY;
    const deltaX = touchEndX - touchStartX.current;
    const deltaY = touchEndY - touchStartY.current;

    // Detect horizontal swipe (threshold: 50px, must be more horizontal than vertical)
    if (Math.abs(deltaX) > 50 && Math.abs(deltaX) > Math.abs(deltaY)) {
      setCommanderDamagePlayer(player);
    }

    touchStartX.current = null;
    touchStartY.current = null;
  };

  const playerCount = players.length;

  return (
    <div className="active-game">
      {/* Floating Hamburger Menu Button */}
      <div className="floating-menu-btn-wrapper">
        <button className="floating-menu-btn" onClick={() => setShowMenu(!showMenu)}>
          ☰
        </button>
      </div>

      {/* Menu Overlay */}
      {showMenu && (
        <>
          <div className="menu-overlay" onClick={() => setShowMenu(false)} />
          <div className="floating-menu">
            <div className="menu-option" style={{ textAlign: 'center', padding: '12px', borderBottom: '1px solid #2c2e33' }}>
              <div style={{ fontSize: '12px', color: '#909296' }}>Game Time</div>
              <div style={{ fontSize: '18px', fontWeight: '700', marginTop: '4px' }}>{formatTime(timer)}</div>
            </div>
            <button
              className="menu-option"
              onClick={() => {
                setShowMenu(false);
                setShowWinnerSelect(true);
              }}
            >
              🏆 End Game
            </button>
            <button className="menu-option" onClick={() => {
              setShowMenu(false);
              onExit();
            }}>
              ← Exit Game
            </button>
          </div>
        </>
      )}

      {/* Player Cards in Game Layout */}
      <div className={`players-grid layout-${layout} players-${playerCount}`}>
        {players.map((player) => {
          const playerState = gameState.playerStates[player.position];
          return (
            <div
              key={player.position}
              className={`player-card ${playerState.eliminated ? 'eliminated' : ''}`}
              onTouchStart={(e) => handleTouchStart(e, player)}
              onTouchEnd={(e) => handleTouchEnd(e, player)}
            >
              {playerState.eliminated && <div className="eliminated-overlay">Eliminated</div>}

              <div className="player-info">
                <div className="player-name">{player.playerName}</div>
                <div className="player-deck">{player.deckName}</div>
              </div>

              {/* Life buttons on sides */}
              <button
                className="life-btn-side life-btn-left"
                onMouseDown={() => handleLifeButtonDown(player.position, -1)}
                onMouseUp={handleLifeButtonUp}
                onMouseLeave={handleLifeButtonUp}
                onTouchStart={(e) => {
                  e.stopPropagation();
                  handleLifeButtonDown(player.position, -1);
                }}
                onTouchEnd={(e) => {
                  e.stopPropagation();
                  handleLifeButtonUp();
                }}
                disabled={playerState.eliminated}
              >
                −
              </button>

              <button
                className="life-btn-side life-btn-right"
                onMouseDown={() => handleLifeButtonDown(player.position, 1)}
                onMouseUp={handleLifeButtonUp}
                onMouseLeave={handleLifeButtonUp}
                onTouchStart={(e) => {
                  e.stopPropagation();
                  handleLifeButtonDown(player.position, 1);
                }}
                onTouchEnd={(e) => {
                  e.stopPropagation();
                  handleLifeButtonUp();
                }}
                disabled={playerState.eliminated}
              >
                +
              </button>

              <div className="life-section">
                <div className="life-total" onClick={() => {
                  if (!playerState.eliminated) {
                    setLifeInputPlayer(player);
                  }
                }}>
                  {playerState.life}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Life Input Modal */}
      {lifeInputPlayer && (
        <LifeInputModal
          currentLife={gameState.playerStates[lifeInputPlayer.position].life}
          onConfirm={(newLife) => {
            const updatedState = {
              ...gameState,
              playerStates: {
                ...gameState.playerStates,
                [lifeInputPlayer.position]: {
                  ...gameState.playerStates[lifeInputPlayer.position],
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

            setLifeInputPlayer(null);
          }}
          onCancel={() => setLifeInputPlayer(null)}
        />
      )}

      {/* Commander Damage Overlay */}
      {commanderDamagePlayer && (
        <CommanderDamageOverlay
          targetPlayer={commanderDamagePlayer}
          allPlayers={players}
          commanderDamage={gameState.playerStates[commanderDamagePlayer.position].commanderDamage || {}}
          onUpdate={(opponentPosition, damage) => {
            handleCommanderDamageUpdate(commanderDamagePlayer.position, opponentPosition, damage);
          }}
          onClose={() => setCommanderDamagePlayer(null)}
        />
      )}

      {/* Winner Selection Modal */}
      {showWinnerSelect && (
        <div className="modal-overlay" onClick={() => setShowWinnerSelect(false)}>
          <div className="modal-content winner-select-modal" onClick={(e) => e.stopPropagation()}>
            <h2>Select Winner</h2>
            <div className="winner-select-grid">
              {players.map((player) => {
                const playerState = gameState.playerStates[player.position];
                return (
                  <button
                    key={player.position}
                    className="winner-select-card"
                    onClick={() => {
                      setShowWinnerSelect(false);
                      onGameComplete(player.position);
                    }}
                    style={{
                      opacity: playerState.eliminated ? 0.6 : 1,
                    }}
                  >
                    <div className="player-avatar-small">
                      {player.playerName.charAt(0).toUpperCase()}
                    </div>
                    <div className="winner-select-info">
                      <div className="winner-select-name">{player.playerName}</div>
                      <div className="winner-select-deck">{player.deckName}</div>
                    </div>
                    {playerState.eliminated && (
                      <div className="winner-select-eliminated">✕</div>
                    )}
                  </button>
                );
              })}
            </div>
            <button className="btn-secondary" onClick={() => setShowWinnerSelect(false)} style={{ width: '100%' }}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default ActiveGame;
