import { useState, useEffect, useRef } from 'react';
import { Crown, Sword, Menu, Heart, Skull } from 'lucide-react';
import type { PlayerSlot, LayoutType, ActiveGameState } from '../../pages/MatchTracker';

interface ActiveGameProps {
  players: PlayerSlot[];
  layout: LayoutType;
  gameState: ActiveGameState;
  onGameComplete: (winnerPosition: number, finalGameState?: ActiveGameState) => void;
  onExit: () => void;
  onUpdateGameState: (gameState: ActiveGameState) => void;
}

function ActiveGame({ players, layout, gameState, onGameComplete, onExit, onUpdateGameState }: ActiveGameProps) {
  const [timer, setTimer] = useState(gameState.elapsedSeconds || 0);
  const [showMenu, setShowMenu] = useState(false);
  const [commanderDamageMode, setCommanderDamageMode] = useState(false);
  const [trackingPlayerPosition, setTrackingPlayerPosition] = useState<number | null>(null);
  const [showWinnerSelect, setShowWinnerSelect] = useState(false);

  // First player selection state
  const [selectingFirstPlayer, setSelectingFirstPlayer] = useState(!gameState.firstPlayerPosition);
  const [firstPlayerPosition, setFirstPlayerPosition] = useState<number | null>(gameState.firstPlayerPosition ?? null);

  // Track active button presses for visual feedback
  const [activeButton, setActiveButton] = useState<{ position: number; type: 'minus' | 'plus' } | null>(null);

  // Track shake animation for commander damage
  const [isShaking, setIsShaking] = useState(false);

  // Life change delta tracking for visual feedback
  const [lifeChangeDeltaMap, setLifeChangeDeltaMap] = useState<Record<number, number>>({});
  const lifeChangeDeltaTimeouts = useRef<Record<number, ReturnType<typeof setTimeout>>>({});

  // Commander damage delta tracking for visual feedback
  const [commanderDamageDeltaMap, setCommanderDamageDeltaMap] = useState<Record<number, number>>({});
  const commanderDamageDeltaTimeouts = useRef<Record<number, ReturnType<typeof setTimeout>>>({});

  // Gesture state tracker for intent-based detection
  const gestureState = useRef<{
    startX: number;
    startY: number;
    currentX: number;
    currentY: number;
    startTime: number;
    isIntentDetermined: boolean;
    intent: 'swipe' | 'tap' | null;
    playerPosition: number | null;
  }>({
    startX: 0,
    startY: 0,
    currentX: 0,
    currentY: 0,
    startTime: 0,
    isIntentDetermined: false,
    intent: null,
    playerPosition: null,
  });

  // Hold button state
  const holdTimerRef = useRef<number | null>(null);
  const holdIntervalRef = useRef<number | null>(null);
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

  // Handle first player selection
  const handleSelectFirstPlayer = (position: number) => {
    setFirstPlayerPosition(position);
    setSelectingFirstPlayer(false);

    // Update game state with first player position
    const updatedState = {
      ...gameState,
      firstPlayerPosition: position,
    };
    onUpdateGameState(updatedState);
  };

  const handleLifeChange = (position: number, delta: number) => {
    // Read from ref to get the latest state
    const currentState = gameStateRef.current;
    const currentLife = currentState.playerStates[position].life;
    const playerState = currentState.playerStates[position];

    // Allow negative life if player is revived, otherwise minimum is 0
    const newLife = playerState.revived ? currentLife + delta : Math.max(0, currentLife + delta);

    // Only auto-eliminate if not revived and life reaches 0
    const shouldEliminate = !playerState.revived && newLife <= 0;

    const updatedState = {
      ...currentState,
      playerStates: {
        ...currentState.playerStates,
        [position]: {
          ...currentState.playerStates[position],
          life: newLife,
          eliminated: shouldEliminate,
        },
      },
    };

    onUpdateGameState(updatedState);

    // Update delta tracking for visual feedback
    setLifeChangeDeltaMap((prev) => ({
      ...prev,
      [position]: (prev[position] || 0) + delta,
    }));

    // Clear existing timeout for this player
    if (lifeChangeDeltaTimeouts.current[position]) {
      clearTimeout(lifeChangeDeltaTimeouts.current[position]);
    }

    // Set new timeout to clear delta after 1 second
    lifeChangeDeltaTimeouts.current[position] = setTimeout(() => {
      setLifeChangeDeltaMap((prev) => {
        const newMap = { ...prev };
        delete newMap[position];
        return newMap;
      });
      delete lifeChangeDeltaTimeouts.current[position];
    }, 1000);

    // Check if only one player remains
    const remainingPlayers = Object.values(updatedState.playerStates).filter((p) => !p.eliminated);
    if (remainingPlayers.length === 1) {
      const winnerPosition = Object.keys(updatedState.playerStates).find(
        (pos) => !updatedState.playerStates[parseInt(pos)].eliminated
      );
      if (winnerPosition) {
        // Save timer value to gameState before completing
        const finalState = { ...updatedState, elapsedSeconds: timer };
        onGameComplete(parseInt(winnerPosition), finalState);
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

    // Set active button for visual feedback
    setActiveButton({ position, type: delta > 0 ? 'plus' : 'minus' });

    // Store button state
    holdStartTime.current = Date.now();
    holdPosition.current = position;
    holdDelta.current = delta;

    // After 0.5 seconds, start incrementing by 10
    holdTimerRef.current = setTimeout(() => {
      // First increment immediately
      handleLifeChange(position, delta * 10);
      // Then continue every 0.5 seconds
      holdIntervalRef.current = setInterval(() => {
        handleLifeChange(position, delta * 10);
      }, 500);
    }, 500);
  };

  const handleLifeButtonUp = () => {
    // If swipe intent detected, don't trigger button action
    if (gestureState.current.intent === 'swipe') {
      // Clear button state
      setActiveButton(null);
      clearHoldTimers();
      holdStartTime.current = null;
      holdPosition.current = null;
      holdDelta.current = null;
      return;
    }

    // If released before 0.5 seconds, do a single increment
    const wasHolding = holdIntervalRef.current !== null;

    if (!wasHolding && holdStartTime.current !== null && holdPosition.current !== null && holdDelta.current !== null) {
      const elapsed = Date.now() - holdStartTime.current;
      if (elapsed < 500) {
        handleLifeChange(holdPosition.current, holdDelta.current);
      }
    }

    // Clear active button state
    setActiveButton(null);

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

  // Reset deltas when switching between life/commander damage modes
  useEffect(() => {
    // Clear all life change deltas
    setLifeChangeDeltaMap({});
    Object.values(lifeChangeDeltaTimeouts.current).forEach(clearTimeout);
    lifeChangeDeltaTimeouts.current = {};

    // Clear all commander damage deltas
    setCommanderDamageDeltaMap({});
    Object.values(commanderDamageDeltaTimeouts.current).forEach(clearTimeout);
    commanderDamageDeltaTimeouts.current = {};
  }, [commanderDamageMode]);

  // Clean up all delta timeouts on unmount
  useEffect(() => {
    return () => {
      Object.values(lifeChangeDeltaTimeouts.current).forEach(clearTimeout);
      Object.values(commanderDamageDeltaTimeouts.current).forEach(clearTimeout);
    };
  }, []);

  // Handle commander damage increment/decrement
  const handleCommanderDamageChange = (fromOpponentPosition: number, delta: number) => {
    if (trackingPlayerPosition === null) return;

    // Trigger shake animation
    setIsShaking(true);
    setTimeout(() => setIsShaking(false), 300); // Match animation duration

    // Read from ref to get the latest state
    const currentState = gameStateRef.current;
    const currentDamage = currentState.playerStates[trackingPlayerPosition].commanderDamage?.[fromOpponentPosition] || 0;
    const newDamage = Math.max(0, currentDamage + delta);

    // Commander damage also affects life total (commander damage is still damage!)
    // Only adjust life based on the actual damage change (handles edge case where damage is at 0)
    const actualDamageDelta = newDamage - currentDamage;
    const currentLife = currentState.playerStates[trackingPlayerPosition].life;
    const playerState = currentState.playerStates[trackingPlayerPosition];

    // Allow negative life if player is revived, otherwise minimum is 0
    const newLife = playerState.revived
      ? currentLife - actualDamageDelta
      : Math.max(0, currentLife - actualDamageDelta);

    // Check if this player should be eliminated:
    // - Commander damage >= 21 always eliminates (even if revived)
    // - Life <= 0 only eliminates if not revived
    const shouldEliminate = newDamage >= 21 || (!playerState.revived && newLife <= 0);

    const updatedState = {
      ...currentState,
      playerStates: {
        ...currentState.playerStates,
        [trackingPlayerPosition]: {
          ...currentState.playerStates[trackingPlayerPosition],
          life: newLife,
          commanderDamage: {
            ...(currentState.playerStates[trackingPlayerPosition].commanderDamage || {}),
            [fromOpponentPosition]: newDamage,
          },
          eliminated: shouldEliminate,
        },
      },
    };

    onUpdateGameState(updatedState);

    // Update delta tracking for visual feedback (track delta from opponent's perspective)
    // Only accumulate the delta if the damage actually changed
    const actualDelta = newDamage - currentDamage;
    if (actualDelta !== 0) {
      setCommanderDamageDeltaMap((prev) => ({
        ...prev,
        [fromOpponentPosition]: (prev[fromOpponentPosition] || 0) + actualDelta,
      }));

      // Clear existing timeout for this opponent
      if (commanderDamageDeltaTimeouts.current[fromOpponentPosition]) {
        clearTimeout(commanderDamageDeltaTimeouts.current[fromOpponentPosition]);
      }

      // Set new timeout to clear delta after 1 second
      commanderDamageDeltaTimeouts.current[fromOpponentPosition] = setTimeout(() => {
        setCommanderDamageDeltaMap((prev) => {
          const newMap = { ...prev };
          delete newMap[fromOpponentPosition];
          return newMap;
        });
        delete commanderDamageDeltaTimeouts.current[fromOpponentPosition];
      }, 1000);
    }

    // Check if only one player remains
    const remainingPlayers = Object.values(updatedState.playerStates).filter((p) => !p.eliminated);
    if (remainingPlayers.length === 1) {
      const winnerPosition = Object.keys(updatedState.playerStates).find(
        (pos) => !updatedState.playerStates[parseInt(pos)].eliminated
      );
      if (winnerPosition) {
        // Save timer value to gameState before completing
        const finalState = { ...updatedState, elapsedSeconds: timer };
        onGameComplete(parseInt(winnerPosition), finalState);
      }
    }
  };

  // Commander damage button handlers (reuse hold-to-increment pattern)
  const handleCommanderDamageButtonDown = (opponentPosition: number, delta: number) => {
    if (trackingPlayerPosition === null) return;

    // Clear any existing timers
    clearHoldTimers();

    // Set active button for visual feedback
    setActiveButton({ position: opponentPosition, type: delta > 0 ? 'plus' : 'minus' });

    // Store button state
    holdStartTime.current = Date.now();
    holdPosition.current = opponentPosition; // Store opponent position instead of player position
    holdDelta.current = delta;

    // After 1 second, start incrementing by 5
    holdTimerRef.current = setTimeout(() => {
      // First increment immediately
      handleCommanderDamageChange(opponentPosition, delta * 5);
      // Then continue every 1 second
      holdIntervalRef.current = setInterval(() => {
        handleCommanderDamageChange(opponentPosition, delta * 5);
      }, 1000);
    }, 1000);
  };

  const handleCommanderDamageButtonUp = (opponentPosition: number) => {
    // If swipe intent detected, don't trigger button action
    if (gestureState.current.intent === 'swipe') {
      // Clear button state
      setActiveButton(null);
      clearHoldTimers();
      holdStartTime.current = null;
      holdPosition.current = null;
      holdDelta.current = null;
      return;
    }

    // If released before 1 second, do a single increment
    const wasHolding = holdIntervalRef.current !== null;

    if (!wasHolding && holdStartTime.current !== null && holdPosition.current !== null && holdDelta.current !== null) {
      const elapsed = Date.now() - holdStartTime.current;
      if (elapsed < 1000) {
        handleCommanderDamageChange(opponentPosition, holdDelta.current);
      }
    }

    // Clear active button state
    setActiveButton(null);

    clearHoldTimers();
    holdStartTime.current = null;
    holdPosition.current = null;
    holdDelta.current = null;
  };

  // Exit commander damage mode
  const exitCommanderDamageMode = () => {
    setCommanderDamageMode(false);
    setTrackingPlayerPosition(null);
  };

  // Revive a player
  const handleRevive = (position: number) => {
    const currentState = gameStateRef.current;
    const playerState = currentState.playerStates[position];

    // Can't revive if force eliminated
    if (playerState.forceEliminated) return;

    const updatedState = {
      ...currentState,
      playerStates: {
        ...currentState.playerStates,
        [position]: {
          ...currentState.playerStates[position],
          eliminated: false,
          revived: true,
          // Keep current life value (0 or whatever it was)
        },
      },
    };

    onUpdateGameState(updatedState);
  };

  // Force eliminate a player (with confirmation)
  const [confirmEliminatePosition, setConfirmEliminatePosition] = useState<number | null>(null);

  const handleForceEliminate = (position: number) => {
    const currentState = gameStateRef.current;

    const updatedState = {
      ...currentState,
      playerStates: {
        ...currentState.playerStates,
        [position]: {
          ...currentState.playerStates[position],
          eliminated: true,
          forceEliminated: true,
        },
      },
    };

    onUpdateGameState(updatedState);
    setConfirmEliminatePosition(null); // Close confirmation modal

    // Check if only one player remains
    const remainingPlayers = Object.values(updatedState.playerStates).filter((p) => !p.eliminated);
    if (remainingPlayers.length === 1) {
      const winnerPosition = Object.keys(updatedState.playerStates).find(
        (pos) => !updatedState.playerStates[parseInt(pos)].eliminated
      );
      if (winnerPosition) {
        // Save timer value to gameState before completing
        const finalState = { ...updatedState, elapsedSeconds: timer };
        onGameComplete(parseInt(winnerPosition), finalState);
      }
    }
  };

  // Swipe gesture handlers - Enter commander damage mode with velocity-based intent detection
  const handleTouchStart = (e: React.TouchEvent, player: PlayerSlot) => {
    if (gameState.playerStates[player.position].eliminated) return;

    // Only track first touch point
    const touch = e.touches[0];
    gestureState.current = {
      startX: touch.clientX,
      startY: touch.clientY,
      currentX: touch.clientX,
      currentY: touch.clientY,
      startTime: Date.now(),
      isIntentDetermined: false,
      intent: null,
      playerPosition: player.position,
    };
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    const gesture = gestureState.current;

    // If intent already determined or no active gesture, skip
    if (gesture.isIntentDetermined || gesture.playerPosition === null) return;

    // Only track first touch point
    const touch = e.touches[0];
    gesture.currentX = touch.clientX;
    gesture.currentY = touch.clientY;

    const deltaX = gesture.currentX - gesture.startX;
    const deltaY = gesture.currentY - gesture.startY;
    const totalMovement = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

    // Direction locking: Determine intent early at 5-10px of movement
    if (totalMovement > 8) {
      const isHorizontal = Math.abs(deltaX) > Math.abs(deltaY) * 1.5;

      if (isHorizontal) {
        // Calculate velocity (px/ms)
        const elapsed = Date.now() - gesture.startTime;
        const velocity = totalMovement / elapsed;

        // Intent detection: Check if velocity indicates a swipe (0.3-0.5 px/ms)
        if (velocity > 0.3) {
          gesture.intent = 'swipe';
          gesture.isIntentDetermined = true;

          // Immediately clear button hold timers and active states
          clearHoldTimers();
          setActiveButton(null);
        }
      }
    }
  };

  const handleTouchEnd = (e: React.TouchEvent, player: PlayerSlot) => {
    const gesture = gestureState.current;

    if (gameState.playerStates[player.position].eliminated || gesture.playerPosition === null) {
      // Reset gesture state
      gesture.intent = null;
      gesture.isIntentDetermined = false;
      gesture.playerPosition = null;
      return;
    }

    const touch = e.changedTouches[0];
    const deltaX = touch.clientX - gesture.startX;
    const deltaY = touch.clientY - gesture.startY;
    const totalDistance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

    // Swipe completion: Check if intent is swipe AND distance exceeds completion threshold (60px)
    if (gesture.intent === 'swipe' && totalDistance > 60) {
      // Enter commander damage mode from this player's perspective
      setCommanderDamageMode(true);
      setTrackingPlayerPosition(player.position);
    }
    // Hysteresis: If no intent determined and minimal movement, allow button tap to proceed
    // (button handlers will check gesture intent separately)

    // Reset gesture state
    gesture.intent = null;
    gesture.isIntentDetermined = false;
    gesture.playerPosition = null;
  };

  const playerCount = players.length;

  // Create a map of position -> player for easy lookup
  const playersByPosition = new Map(players.map(p => [p.position, p]));

  // Calculate badge position classes to avoid center hexagon overlap
  // Badges are positioned on outer edges based on grid layout
  const getBadgePositionClasses = (position: number): string => {
    // For 3-4 player games (2x2 grid)
    if (playerCount <= 4) {
      // Top row (positions 1-2): rotated 180°, use bottom edge
      // Bottom row (positions 3-4): use top edge
      // Left column (positions 1, 3): use left edge
      // Right column (positions 2, 4): use right edge
      if (position === 1) return 'bottom-2 left-2'; // top-left card
      if (position === 2) return 'bottom-2 right-2'; // top-right card
      if (position === 3) return 'top-2 left-2'; // bottom-left card
      if (position === 4) return 'top-2 right-2'; // bottom-right card
    }
    // For 5-6 player games (3x2 grid)
    else {
      // Top row (positions 1-3): rotated 180°, use bottom edge
      // Bottom row (positions 4-6): use top edge
      if (position === 1) return 'bottom-2 left-2'; // top-left card
      if (position === 2) return 'bottom-2 left-2'; // top-center card (left side)
      if (position === 3) return 'bottom-2 right-2'; // top-right card
      if (position === 4) return 'top-2 left-2'; // bottom-left card
      if (position === 5) return 'top-2 right-2'; // bottom-center card (right side)
      if (position === 6) return 'top-2 right-2'; // bottom-right card
    }
    // Fallback for any unexpected position
    return 'top-2 right-2';
  };

  // Determine total grid slots based on player count (to match PlayerAssignment layout)
  // 3 players use 4 slots (2x2), 5 players use 6 slots (3x2), others use exact count
  const totalSlots = playerCount === 3 ? 4 : playerCount === 5 ? 6 : playerCount;
  const allSlots = Array.from({ length: totalSlots }, (_, i) => i + 1);

  return (
    <div className="min-h-screen flex flex-col">
      {/* Floating Center Button - Hamburger Menu or Exit Commander Damage Mode */}
      <div className="floating-menu-btn-wrapper">
        <button
          className={`floating-menu-btn ${commanderDamageMode ? 'commander-mode-exit' : ''}`}
          onClick={() => {
            if (commanderDamageMode) {
              exitCommanderDamageMode();
            } else {
              setShowMenu(!showMenu);
            }
          }}
        >
          {commanderDamageMode ? <Sword className="w-8 h-8" /> : <Menu className="w-8 h-8" />}
        </button>
      </div>

      {/* Menu Overlay */}
      {showMenu && (
        <>
          <div className="fixed inset-0 bg-black/70 z-[250]" onClick={() => setShowMenu(false)} />
          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-[#1a1b1e] border border-[#2c2e33] rounded-[12px] p-2 z-[300] min-w-[200px] shadow-[0_8px_24px_rgba(0,0,0,0.5)]">
            <div className="text-center p-3 border-b border-[#2c2e33]">
              <div className="text-xs text-[#909296]">Game Time</div>
              <div className="text-lg font-bold mt-1">{formatTime(timer)}</div>
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
        {allSlots.map((slotPosition) => {
          const player = playersByPosition.get(slotPosition);

          // If no player in this slot, render an empty/invisible placeholder
          if (!player) {
            return <div key={slotPosition} className="player-card invisible" />;
          }

          // Render the actual player card
          const playerState = gameState.playerStates[player.position];
          const isTrackingPlayer = commanderDamageMode && player.position === trackingPlayerPosition;
          const commanderDamage = commanderDamageMode && trackingPlayerPosition !== null
            ? gameState.playerStates[trackingPlayerPosition].commanderDamage?.[player.position] || 0
            : 0;
          const isLethalDamage = commanderDamage >= 21;

          return (
            <div
              key={player.position}
              className={`player-card player-slot ${playerState.eliminated ? 'eliminated' : ''} ${commanderDamageMode ? 'commander-damage-mode' : ''} ${isTrackingPlayer ? 'tracking-player' : ''} ${selectingFirstPlayer ? 'cursor-pointer' : ''}`}
              onTouchStart={(e) => !commanderDamageMode && !selectingFirstPlayer && handleTouchStart(e, player)}
              onTouchMove={(e) => !commanderDamageMode && !selectingFirstPlayer && handleTouchMove(e)}
              onTouchEnd={(e) => !commanderDamageMode && !selectingFirstPlayer && handleTouchEnd(e, player)}
              onClick={() => selectingFirstPlayer && handleSelectFirstPlayer(player.position)}
            >
              {playerState.eliminated && (
                <div className="eliminated-overlay">
                  Eliminated
                  {/* Revive button - only show if not force eliminated */}
                  {!playerState.forceEliminated && (
                    <button
                      className="revive-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRevive(player.position);
                      }}
                      title="Revive Player"
                    >
                      <Heart className="w-5 h-5" strokeWidth={2} absoluteStrokeWidth />
                    </button>
                  )}
                </div>
              )}

              {/* First Player Badge - Crown icon positioned on outer edge */}
              {firstPlayerPosition === player.position && !selectingFirstPlayer && (
                <div className={`crown-badge absolute ${getBadgePositionClasses(player.position)} z-[10] w-7 h-7 rounded-full bg-black/70 flex items-center justify-center`}>
                  <Crown className="w-4 h-4 text-yellow-400" />
                </div>
              )}

              <div className="absolute top-3 left-20 right-20 z-[2] text-center flex flex-col vertical-stack">
                <div
                  className="text-lg font-bold text-shadow-[0_2px_4px_rgba(0,0,0,0.3)]"
                  onClick={() => {
                    if (!commanderDamageMode && !playerState.eliminated) {
                      setCommanderDamageMode(true);
                      setTrackingPlayerPosition(player.position);
                    }
                  }}
                  style={{ cursor: !commanderDamageMode && !playerState.eliminated ? 'pointer' : 'default' }}
                >
                  {player.playerName}
                </div>
                <div className="text-xs opacity-90 text-shadow-[0_1px_2px_rgba(0,0,0,0.3)]">{player.deckName}</div>
              </div>

              {/* First Player Selection Mode - Show selection overlay */}
              {selectingFirstPlayer && (
                <>
                  <div className="absolute inset-0 bg-black/50 z-[5]" />
                  <div className="absolute top-1/2 left-0 right-0 z-[6] -translate-y-1/2 text-center pointer-events-none flex flex-col vertical-stack">
                    <div className="text-lg font-bold text-white mb-1">Tap To Choose</div>
                    <div className="text-base font-semibold text-white">First Player</div>
                  </div>
                </>
              )}

              {/* Normal Life Tracking Mode */}
              {!commanderDamageMode && !selectingFirstPlayer && (
                <>
                  {/* Life buttons on sides */}
                  <button
                    className={`life-btn-side life-btn-left ${activeButton?.position === player.position && activeButton?.type === 'minus' ? 'active' : ''}`}
                    onMouseDown={() => handleLifeButtonDown(player.position, -1)}
                    onMouseUp={handleLifeButtonUp}
                    onMouseLeave={handleLifeButtonUp}
                    onTouchStart={(e) => {
                      e.preventDefault();
                      handleLifeButtonDown(player.position, -1);
                    }}
                    onTouchEnd={(e) => {
                      e.preventDefault();
                      handleLifeButtonUp();
                    }}
                    disabled={playerState.eliminated}
                  >
                    {lifeChangeDeltaMap[player.position] < 0 ? lifeChangeDeltaMap[player.position] : '−'}
                  </button>

                  <button
                    className={`life-btn-side life-btn-right ${activeButton?.position === player.position && activeButton?.type === 'plus' ? 'active' : ''}`}
                    onMouseDown={() => handleLifeButtonDown(player.position, 1)}
                    onMouseUp={handleLifeButtonUp}
                    onMouseLeave={handleLifeButtonUp}
                    onTouchStart={(e) => {
                      e.preventDefault();
                      handleLifeButtonDown(player.position, 1);
                    }}
                    onTouchEnd={(e) => {
                      e.preventDefault();
                      handleLifeButtonUp();
                    }}
                    disabled={playerState.eliminated}
                  >
                    {lifeChangeDeltaMap[player.position] > 0 ? `+${lifeChangeDeltaMap[player.position]}` : '+'}
                  </button>

                  <div className="absolute inset-0 flex flex-col items-center justify-center px-20">
                    <div className="life-total">
                      {playerState.life}
                    </div>
                  </div>
                </>
              )}

              {/* Commander Damage Tracking Mode */}
              {commanderDamageMode && (
                <>
                  {isTrackingPlayer ? (
                    // This is the tracking player's card - show indicator with shake animation (swipe auto-plays via CSS)
                    <div className="commander-damage-indicator">
                      <div className={`commander-indicator-content vertical-stack ${isShaking ? 'shake' : ''}`}>
                        <div className="commander-indicator-title">COMMANDER</div>
                        <div className="commander-indicator-title">DAMAGE</div>
                        <div className="commander-indicator-subtitle">YOU'VE RECEIVED</div>
                        <div
                          className="commander-indicator-return"
                          onClick={exitCommanderDamageMode}
                          style={{ cursor: 'pointer' }}
                        >
                          RETURN TO GAME
                        </div>
                      </div>
                      {/* Force eliminate button - positioned like revive button */}
                      <button
                        className="revive-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          setConfirmEliminatePosition(player.position);
                        }}
                        title="Force Eliminate Player"
                        style={{ background: 'rgba(239, 68, 68, 0.9)', borderColor: '#ef4444' }}
                      >
                        <Skull className="w-5 h-5" strokeWidth={2} absoluteStrokeWidth />
                      </button>
                    </div>
                  ) : (
                    // This is an opponent's card - show damage tracking with same layout as life
                    <>
                      {/* Commander damage buttons on sides */}
                      <button
                        className={`life-btn-side life-btn-left ${activeButton?.position === player.position && activeButton?.type === 'minus' ? 'active' : ''}`}
                        onMouseDown={() => handleCommanderDamageButtonDown(player.position, -1)}
                        onMouseUp={() => handleCommanderDamageButtonUp(player.position)}
                        onMouseLeave={() => handleCommanderDamageButtonUp(player.position)}
                        onTouchStart={(e) => {
                          e.preventDefault();
                          handleCommanderDamageButtonDown(player.position, -1);
                        }}
                        onTouchEnd={(e) => {
                          e.preventDefault();
                          handleCommanderDamageButtonUp(player.position);
                        }}
                      >
                        {commanderDamageDeltaMap[player.position] < 0 ? commanderDamageDeltaMap[player.position] : '−'}
                      </button>

                      <button
                        className={`life-btn-side life-btn-right ${activeButton?.position === player.position && activeButton?.type === 'plus' ? 'active' : ''}`}
                        onMouseDown={() => handleCommanderDamageButtonDown(player.position, 1)}
                        onMouseUp={() => handleCommanderDamageButtonUp(player.position)}
                        onMouseLeave={() => handleCommanderDamageButtonUp(player.position)}
                        onTouchStart={(e) => {
                          e.preventDefault();
                          handleCommanderDamageButtonDown(player.position, 1);
                        }}
                        onTouchEnd={(e) => {
                          e.preventDefault();
                          handleCommanderDamageButtonUp(player.position);
                        }}
                      >
                        {commanderDamageDeltaMap[player.position] > 0 ? `+${commanderDamageDeltaMap[player.position]}` : '+'}
                      </button>

                      <div className="absolute inset-0 flex flex-col items-center justify-center px-20">
                        <div
                          className={`life-total ${isLethalDamage ? 'lethal-damage' : ''}`}
                          onClick={() => {
                            // TODO: Add modal for direct commander damage input
                          }}
                        >
                          {commanderDamage}
                        </div>
                      </div>
                    </>
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>

      {/* Winner Selection Modal */}
      {showWinnerSelect && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[1000] p-4" onClick={() => setShowWinnerSelect(false)}>
          <div className="bg-[#1a1b1e] border border-[#2c2e33] rounded-[12px] p-4 max-w-[600px] w-full max-h-[90vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold mb-3 text-center">Select Winner</h2>
            <div className="grid grid-cols-[repeat(auto-fit,minmax(120px,1fr))] gap-2 mb-3 overflow-y-auto flex-1 min-h-0">
              {players.map((player) => {
                const playerState = gameState.playerStates[player.position];
                return (
                  <button
                    key={player.position}
                    className="relative flex flex-col items-center gap-1.5 p-3 px-2 bg-[#2c2e33] border-2 border-[#3c3e43] rounded-[10px] text-white cursor-pointer transition-all duration-200 min-h-0 hover:bg-[#3c3e43] hover:border-[#667eea] hover:-translate-y-0.5 active:translate-y-0"
                    onClick={() => {
                      setShowWinnerSelect(false);
                      // Save timer value to gameState before completing
                      const finalState = { ...gameState, elapsedSeconds: timer };
                      onGameComplete(player.position, finalState);
                    }}
                    style={{
                      opacity: playerState.eliminated ? 0.6 : 1,
                    }}
                  >
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#667eea] to-[#764ba2] flex items-center justify-center text-sm font-semibold">
                      {player.playerName.charAt(0).toUpperCase()}
                    </div>
                    <div className="text-center w-full">
                      <div className="text-[13px] font-semibold mb-0.5 leading-tight">{player.playerName}</div>
                      <div className="text-[10px] text-[#6b7280] leading-tight">{player.deckName}</div>
                    </div>
                    {playerState.eliminated && (
                      <div className="absolute top-1.5 right-1.5 w-[18px] h-[18px] bg-[#ef4444] rounded-full flex items-center justify-center text-[11px] font-bold text-white">✕</div>
                    )}
                  </button>
                );
              })}
            </div>
            <button className="bg-[#2c2e33] text-white border border-[#3c3e43] rounded-[8px] py-3 px-6 text-sm font-semibold cursor-pointer transition-all duration-200 w-full hover:bg-[#3c3e43]" onClick={() => setShowWinnerSelect(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Force Eliminate Confirmation Modal */}
      {confirmEliminatePosition !== null && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[1000] p-4" onClick={() => setConfirmEliminatePosition(null)}>
          <div className="bg-[#1a1b1e] border border-[#2c2e33] rounded-[12px] p-6 max-w-[400px] w-full" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold mb-2 text-center text-[#ef4444]">Force Eliminate Player</h2>
            <p className="text-sm text-center mb-6 text-[#9ca3af]">
              Are you sure you want to eliminate <span className="font-semibold text-white">{players.find(p => p.position === confirmEliminatePosition)?.playerName}</span>?
              <br />
              <span className="text-xs">This action cannot be undone (player cannot be revived).</span>
            </p>
            <div className="flex gap-3">
              <button
                className="flex-1 bg-[#2c2e33] text-white border border-[#3c3e43] rounded-[8px] py-3 px-6 text-sm font-semibold cursor-pointer transition-all duration-200 hover:bg-[#3c3e43]"
                onClick={() => setConfirmEliminatePosition(null)}
              >
                Cancel
              </button>
              <button
                className="flex-1 bg-[#ef4444] text-white rounded-[8px] py-3 px-6 text-sm font-semibold cursor-pointer transition-all duration-200 hover:bg-[#dc2626]"
                onClick={() => handleForceEliminate(confirmEliminatePosition)}
              >
                Eliminate
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ActiveGame;
