import { useState, useEffect, useRef } from 'react';
import { Crown, Sword, Heart, Skull, X, Clock, Dices, Flag } from 'lucide-react';
import type { PlayerSlot, LayoutType, ActiveGameState } from '../../pages/MatchTracker';
import { getSeatColor } from './smash-select';

interface ActiveGameProps {
  players: PlayerSlot[];
  layout: LayoutType;
  gameState: ActiveGameState;
  onGameComplete: (winnerPosition: number, finalGameState?: ActiveGameState) => void;
  onExit: () => void;
  onUpdateGameState: (gameState: ActiveGameState) => void;
  isQuickPlay?: boolean;
  onReset?: () => void;
}

// Fun phrases for when a player scoops (concedes)
const SCOOP_PHRASES = [
  "Couldn't take the heat",
  "Folded under pressure",
  "Left the table early",
  "Threw in the towel",
  "Waved the white flag",
  "Called it quits",
  "Tapped out",
  "Rage quit? Never.",
  "Strategic retreat",
  "Lived to fight another day",
];

function ActiveGame({ players, layout, gameState, onGameComplete, onExit, onUpdateGameState, isQuickPlay, onReset }: ActiveGameProps) {
  const [timer, setTimer] = useState(gameState.elapsedSeconds || 0);
  const [menuState, setMenuState] = useState<'closed' | 'spinning' | 'open' | 'closing'>('closed');
  const [commanderDamageMode, setCommanderDamageMode] = useState(false);
  const [trackingPlayerPosition, setTrackingPlayerPosition] = useState<number | null>(null);
  const [showWinnerSelect, setShowWinnerSelect] = useState(false);
  const [quickPlayWinner, setQuickPlayWinner] = useState<PlayerSlot | null>(null);

  // First player selection state
  const [selectingFirstPlayer, setSelectingFirstPlayer] = useState(!gameState.firstPlayerPosition);
  const [firstPlayerPosition, setFirstPlayerPosition] = useState<number | null>(gameState.firstPlayerPosition ?? null);

  // Dice roll state for first player selection
  type DiceRollPhase = 'idle' | 'rolling' | 'stopping' | 'revealing' | 'tiebreaker';
  interface DieState {
    currentValue: number;
    finalValue: number | null;
    isStopped: boolean;
    isWinner: boolean;
    isTied: boolean;
  }
  const [diceRollPhase, setDiceRollPhase] = useState<DiceRollPhase>('idle');
  const [diceStates, setDiceStates] = useState<Record<number, DieState>>({});
  const rollIntervalRef = useRef<number | null>(null);

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

  // Handle menu button click with spin animation
  const handleMenuButtonClick = () => {
    if (commanderDamageMode) {
      exitCommanderDamageMode();
    } else if (menuState === 'closed') {
      setMenuState('spinning');
      // After spin animation completes, open menu
      setTimeout(() => setMenuState('open'), 350);
    } else if (menuState === 'open') {
      setMenuState('closing');
      // After closing animation completes, set to closed
      setTimeout(() => setMenuState('closed'), 250);
    }
  };

  // Helper to close menu (used by pills and backdrop)
  const closeMenu = () => {
    setMenuState('closing');
    setTimeout(() => setMenuState('closed'), 250);
  };

  // Handle first player selection
  const handleSelectFirstPlayer = (position: number) => {
    setFirstPlayerPosition(position);
    setSelectingFirstPlayer(false);
    setDiceRollPhase('idle');
    setDiceStates({});

    // Update game state with first player position
    const updatedState = {
      ...gameState,
      firstPlayerPosition: position,
    };
    onUpdateGameState(updatedState);
  };

  // Dice roll functions for first player selection
  const startRolling = (positionsToRoll?: number[]) => {
    const positions = positionsToRoll || players.map(p => p.position);

    rollIntervalRef.current = window.setInterval(() => {
      setDiceStates(prev => {
        const updated = { ...prev };
        positions.forEach(pos => {
          if (updated[pos] && !updated[pos].isStopped) {
            updated[pos] = {
              ...updated[pos],
              currentValue: Math.floor(Math.random() * 10) + 1,
            };
          }
        });
        return updated;
      });
    }, 50);
  };

  const handleStartRoll = () => {
    if (diceRollPhase !== 'idle') return;

    // Initialize dice states for all players
    const initialDiceStates: Record<number, DieState> = {};
    players.forEach(player => {
      initialDiceStates[player.position] = {
        currentValue: Math.floor(Math.random() * 10) + 1,
        finalValue: null,
        isStopped: false,
        isWinner: false,
        isTied: false,
      };
    });

    setDiceStates(initialDiceStates);
    setDiceRollPhase('rolling');

    startRolling();

    // After 1.5s, start stopping dice sequentially
    setTimeout(() => {
      stopDiceSequentially();
    }, 1500);
  };

  const stopDiceSequentially = (positionsToStop?: number[]) => {
    if (rollIntervalRef.current) {
      clearInterval(rollIntervalRef.current);
      rollIntervalRef.current = null;
    }

    setDiceRollPhase('stopping');

    const positions = positionsToStop || players.map(p => p.position);
    // Shuffle for random stop order
    const shuffledPositions = [...positions].sort(() => Math.random() - 0.5);

    shuffledPositions.forEach((position, index) => {
      setTimeout(() => {
        const finalValue = Math.floor(Math.random() * 10) + 1;

        setDiceStates(prev => ({
          ...prev,
          [position]: {
            ...prev[position],
            currentValue: finalValue,
            finalValue: finalValue,
            isStopped: true,
          },
        }));

        // After last die stops, determine winner
        if (index === shuffledPositions.length - 1) {
          setTimeout(() => {
            determineWinner(positions);
          }, 300);
        }
      }, index * 200);
    });
  };

  const determineWinner = (positionsToCheck?: number[]) => {
    setDiceRollPhase('revealing');

    setDiceStates(prev => {
      const positions = positionsToCheck || Object.keys(prev).map(Number);
      const values = positions.map(pos => ({
        position: pos,
        value: prev[pos]?.finalValue || 0,
      }));

      const maxValue = Math.max(...values.map(v => v.value));
      const winners = values.filter(v => v.value === maxValue);

      const updated = { ...prev };

      if (winners.length === 1) {
        // Single winner
        updated[winners[0].position] = {
          ...updated[winners[0].position],
          isWinner: true,
        };

        // Celebrate then select
        setTimeout(() => {
          handleSelectFirstPlayer(winners[0].position);
        }, 1500);
      } else {
        // Tie - mark tied dice
        winners.forEach(w => {
          updated[w.position] = {
            ...updated[w.position],
            isTied: true,
          };
        });

        // Auto re-roll after brief pause
        setTimeout(() => {
          handleTiebreakerRoll(winners.map(w => w.position));
        }, 1000);
      }

      return updated;
    });
  };

  const handleTiebreakerRoll = (tiedPositions: number[]) => {
    setDiceRollPhase('tiebreaker');

    // Reset only tied dice
    setDiceStates(prev => {
      const updated = { ...prev };
      tiedPositions.forEach(pos => {
        updated[pos] = {
          currentValue: Math.floor(Math.random() * 10) + 1,
          finalValue: null,
          isStopped: false,
          isWinner: false,
          isTied: false,
        };
      });
      // Mark non-tied dice as not in play (keep their final values visible)
      Object.keys(updated).forEach(posKey => {
        const pos = Number(posKey);
        if (!tiedPositions.includes(pos)) {
          updated[pos] = {
            ...updated[pos],
            isTied: false,
          };
        }
      });
      return updated;
    });

    setDiceRollPhase('rolling');
    startRolling(tiedPositions);

    // Shorter roll time for tiebreaker
    setTimeout(() => {
      stopDiceSequentially(tiedPositions);
    }, 1200);
  };

  // Cleanup dice roll interval on unmount
  useEffect(() => {
    return () => {
      if (rollIntervalRef.current) {
        clearInterval(rollIntervalRef.current);
      }
    };
  }, []);

  // Re-roll for first player (accessible from menu)
  const handleRerollFirstPlayer = () => {
    // Reset first player state and enter selection mode
    setFirstPlayerPosition(null);
    setSelectingFirstPlayer(true);
    setDiceRollPhase('idle');
    setDiceStates({});

    // Clear from game state
    const updatedState = {
      ...gameState,
      firstPlayerPosition: undefined,
    };
    onUpdateGameState(updatedState);

    // Start rolling immediately
    setTimeout(() => {
      handleStartRoll();
    }, 100);
  };

  // Helper function to check if match should complete
  // Match ends when only 1 player remains AND all eliminations have been confirmed (killer selected)
  const checkMatchCompletion = (state: ActiveGameState) => {
    const remainingPlayers = Object.values(state.playerStates).filter((p) => !p.eliminated);
    const eliminatedPlayers = Object.values(state.playerStates).filter((p) => p.eliminated);
    const allEliminationsConfirmed = eliminatedPlayers.every((p) => p.eliminationConfirmed);

    if (remainingPlayers.length === 1 && allEliminationsConfirmed) {
      const winnerPosition = Object.keys(state.playerStates).find(
        (pos) => !state.playerStates[parseInt(pos)].eliminated
      );
      if (winnerPosition) {
        const winner = players.find(p => p.position === parseInt(winnerPosition));

        if (isQuickPlay && winner) {
          setQuickPlayWinner(winner);
        } else {
          const finalState = { ...state, elapsedSeconds: timer };
          onGameComplete(parseInt(winnerPosition), finalState);
        }
      }
    }
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
          eliminatedAt: shouldEliminate ? Date.now() : currentState.playerStates[position].eliminatedAt,
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

    // Check if match should complete (only 1 remaining AND all eliminations confirmed)
    checkMatchCompletion(updatedState);
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
          eliminatedAt: shouldEliminate ? Date.now() : currentState.playerStates[trackingPlayerPosition].eliminatedAt,
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

    // Check if match should complete (only 1 remaining AND all eliminations confirmed)
    checkMatchCompletion(updatedState);
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
          eliminatedAt: null, // Clear timestamp on revive
          revived: true,
          // Keep current life value (0 or whatever it was)
          // Clear elimination tracking
          eliminatedByPlayerId: undefined,
          eliminationType: undefined,
          eliminationConfirmed: false,
        },
      },
    };

    onUpdateGameState(updatedState);
  };

  // Handle selecting who killed an eliminated player
  const handleSelectKiller = (eliminatedPosition: number, killerPlayerId: string) => {
    const currentState = gameStateRef.current;
    const updatedState = {
      ...currentState,
      playerStates: {
        ...currentState.playerStates,
        [eliminatedPosition]: {
          ...currentState.playerStates[eliminatedPosition],
          eliminatedByPlayerId: killerPlayerId,
          eliminationType: 'kill' as const,
          eliminationConfirmed: true,
        },
      },
    };
    onUpdateGameState(updatedState);

    // Check if match should complete (this may be the final elimination being confirmed)
    checkMatchCompletion(updatedState);
  };

  // Handle when a player scoops (concedes)
  const handleSelectScoop = (position: number) => {
    const currentState = gameStateRef.current;
    const updatedState = {
      ...currentState,
      playerStates: {
        ...currentState.playerStates,
        [position]: {
          ...currentState.playerStates[position],
          eliminatedByPlayerId: undefined,
          eliminationType: 'scoop' as const,
          eliminationConfirmed: true,
        },
      },
    };
    onUpdateGameState(updatedState);

    // Check if match should complete (this may be the final elimination being confirmed)
    checkMatchCompletion(updatedState);
  };

  // Helper to get a kill message from the killer (or fall back to "by {name}")
  const getKillDisplay = (killerId: string | undefined, victimPosition?: number): string => {
    if (!killerId) return '';
    const killer = players.find(p => p.playerId === killerId);
    if (!killer) return '';

    // If killer has custom kill messages, return one based on victim position for variety
    if (killer.killMessages && killer.killMessages.length > 0) {
      // Use a combination of killer ID and victim position for variety across different kills
      const seed = killerId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) + (victimPosition || 0);
      const index = seed % killer.killMessages.length;
      return killer.killMessages[index];
    }

    // Fall back to showing killer name
    return `by ${killer.playerName}`;
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
          eliminatedAt: Date.now(),
          forceEliminated: true,
        },
      },
    };

    onUpdateGameState(updatedState);
    setConfirmEliminatePosition(null); // Close confirmation modal

    // Check if match should complete (only 1 remaining AND all eliminations confirmed)
    checkMatchCompletion(updatedState);
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
    // For 2 player games (1x2 grid - 1 column, 2 rows)
    if (playerCount === 2) {
      // Position 1 is top (rotated 180°), position 2 is bottom
      if (position === 1) return 'top-2 right-2'; // top card (rotated)
      if (position === 2) return 'top-2 left-2'; // bottom card
    }
    // For 3-4 player games (2x2 grid)
    else if (playerCount <= 4) {
      // Top row (positions 1-2): cards rotated 180°, badge at rotate(0) via CSS
      // Since badge doesn't rotate, we use top/right for visual top-left corner
      // Bottom row (positions 3-4): cards not rotated, normal positioning
      if (position === 1) return 'top-2 right-2'; // top-left card (visual top-left = top-right in rotated card space)
      if (position === 2) return 'top-2 left-2'; // top-right card (visual top-right = top-left in rotated card space)
      if (position === 3) return 'top-2 left-2'; // bottom-left card
      if (position === 4) return 'top-2 right-2'; // bottom-right card
    }
    // For 5-6 player games (3x2 grid)
    else {
      // Top row (positions 1-3): cards rotated 180°, badge doesn't rotate
      // Bottom row (positions 4-6): cards not rotated
      if (position === 1) return 'top-2 right-2'; // top-left card
      if (position === 2) return 'top-2 right-2'; // top-center card (right side for visual left)
      if (position === 3) return 'top-2 left-2'; // top-right card
      if (position === 4) return 'top-2 left-2'; // bottom-left card
      if (position === 5) return 'top-2 right-2'; // bottom-center card
      if (position === 6) return 'top-2 right-2'; // bottom-right card
    }
    // Fallback for any unexpected position
    return 'top-2 right-2';
  };

  // Determine total grid slots based on player count (to match PlayerAssignment layout)
  // 2 players use 2 slots (1x2), 3 players use 4 slots (2x2), 5 players use 6 slots (3x2), others use exact count
  const totalSlots = playerCount === 2 ? 2 : playerCount === 3 ? 4 : playerCount === 5 ? 6 : playerCount;
  const allSlots = Array.from({ length: totalSlots }, (_, i) => i + 1);

  return (
    <div className="min-h-screen flex flex-col">
      {/* Menu Backdrop */}
      {(menuState === 'open' || menuState === 'closing') && (
        <div
          className="radial-menu-backdrop"
          onClick={closeMenu}
        />
      )}

      {/* Radial Pill Menu */}
      <div className={`radial-menu ${menuState === 'open' ? 'open' : ''} ${menuState === 'closing' ? 'closing' : ''}`}>
        {/* Timer - Top */}
        <div className="radial-pill timer-pill">
          <Clock className="timer-icon" />
          <span className="timer-value">{formatTime(timer)}</span>
        </div>

        {/* End Game - Bottom Left */}
        <button
          className="radial-pill"
          onClick={() => {
            closeMenu();
            setShowWinnerSelect(true);
          }}
        >
          End Game
        </button>

        {/* Exit Game - Bottom Right */}
        <button
          className="radial-pill"
          onClick={() => {
            closeMenu();
            onExit();
          }}
        >
          Exit Game
        </button>

        {/* Re-roll First Player - Bottom-right */}
        <button
          className="radial-pill reroll-pill"
          onClick={() => {
            closeMenu();
            handleRerollFirstPlayer();
          }}
        >
          <Dices className="w-4 h-4 inline-block mr-1" />
          Re-roll
        </button>
      </div>

      {/* Floating Center Button - Roll/Logo/X or Exit Commander Damage Mode */}
      <div className="floating-menu-btn-wrapper">
        <button
          className={`floating-menu-btn ${selectingFirstPlayer && diceRollPhase === 'idle' ? 'roll-mode' : ''} ${commanderDamageMode ? 'commander-mode-exit' : ''} ${menuState === 'spinning' ? 'spinning' : ''} ${menuState === 'open' || menuState === 'closing' ? 'menu-open' : ''}`}
          onClick={() => {
            if (selectingFirstPlayer && diceRollPhase === 'idle') {
              handleStartRoll();
            } else {
              handleMenuButtonClick();
            }
          }}
          disabled={selectingFirstPlayer && diceRollPhase !== 'idle'}
        >
          {selectingFirstPlayer && diceRollPhase === 'idle' ? (
            <Dices className="w-8 h-8" />
          ) : commanderDamageMode ? (
            <Sword className="w-8 h-8" />
          ) : (
            <>
              <img src="/logo.png" alt="" className="menu-logo" />
              <X className="w-8 h-8 menu-close-icon" />
            </>
          )}
        </button>
      </div>

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
              className={`player-card player-slot ${playerState.eliminated ? 'eliminated' : ''} ${playerState.eliminated && playerState.eliminationConfirmed ? 'elimination-confirmed' : ''} ${commanderDamageMode ? 'commander-damage-mode' : ''} ${isTrackingPlayer ? 'tracking-player' : ''} ${selectingFirstPlayer && diceRollPhase === 'idle' ? 'cursor-pointer' : ''}`}
              onTouchStart={(e) => !commanderDamageMode && !selectingFirstPlayer && handleTouchStart(e, player)}
              onTouchMove={(e) => !commanderDamageMode && !selectingFirstPlayer && handleTouchMove(e)}
              onTouchEnd={(e) => !commanderDamageMode && !selectingFirstPlayer && handleTouchEnd(e, player)}
              onClick={() => selectingFirstPlayer && diceRollPhase === 'idle' && handleSelectFirstPlayer(player.position)}
            >
              {playerState.eliminated && (
                <div className="eliminated-overlay">
                  {!playerState.eliminationConfirmed ? (
                    // Phase 1: Selection card (NOT greyed out)
                    <div className="elimination-selection-card">
                      {/* Revive button in corner */}
                      {!playerState.forceEliminated && (
                        <button
                          className="revive-btn-corner"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRevive(player.position);
                          }}
                          title="Revive Player"
                        >
                          <Heart />
                        </button>
                      )}

                      <div className="elimination-title">ELIMINATED</div>
                      <div className="elimination-prompt">Who took them out?</div>

                      <div className="killer-selection-grid">
                        {/* Buttons for each remaining non-eliminated player */}
                        {players
                          .filter(p => p.position !== player.position && !gameState.playerStates[p.position].eliminated && p.playerId)
                          .map(p => {
                            const seatColor = getSeatColor(p.position);
                            return (
                              <button
                                key={p.position}
                                className="killer-btn-with-color"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (p.playerId) handleSelectKiller(player.position, p.playerId);
                                }}
                              >
                                <div
                                  className="killer-color-square"
                                  style={{ backgroundColor: seatColor.primary }}
                                />
                                {p.playerName}
                              </button>
                            );
                          })}
                        {/* Scoop button */}
                        <button
                          className="killer-btn-with-color scoop-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSelectScoop(player.position);
                          }}
                        >
                          <Flag className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  ) : playerState.eliminationType === 'scoop' ? (
                    // Phase 2B: Scooped card (no revive button - selection is final)
                    <div className="scoop-card">
                      <div className="scoop-icon">
                        <Flag />
                      </div>
                      <div className="scoop-title">SCOOPED</div>
                      <div className="scoop-phrase">
                        {SCOOP_PHRASES[player.position % SCOOP_PHRASES.length]}
                      </div>
                    </div>
                  ) : (
                    // Phase 2A: Killed confirmation (no revive button - selection is final)
                    <div className="elimination-confirmed-card">
                      <div className="elimination-title">ELIMINATED</div>
                      <div className="elimination-info">{getKillDisplay(playerState.eliminatedByPlayerId, player.position)}</div>
                    </div>
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

              {/* First Player Selection Mode - Show selection overlay or dice block */}
              {selectingFirstPlayer && (
                <>
                  <div className="absolute inset-0 bg-black/50 z-[5]" />
                  {diceRollPhase === 'idle' ? (
                    // Show tap to choose text when waiting for roll
                    <div className="absolute top-1/2 left-0 right-0 z-[6] -translate-y-1/2 text-center pointer-events-none flex flex-col vertical-stack">
                      <div className="text-lg font-bold text-white mb-1">Tap or Roll To Choose</div>
                      <div className="text-base font-semibold text-white">First Player</div>
                    </div>
                  ) : diceStates[player.position] ? (
                    // Show dice block when rolling
                    <div
                      className={`dice-block ${
                        diceStates[player.position].isWinner ? 'winner' :
                        diceStates[player.position].isTied ? 'tied' :
                        diceStates[player.position].isStopped ? 'stopped' :
                        'rolling'
                      }`}
                    >
                      <span className="dice-number">
                        {diceStates[player.position].currentValue}
                      </span>
                    </div>
                  ) : null}
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
                        <div
                          className="commander-indicator-title"
                          onClick={exitCommanderDamageMode}
                          style={{ cursor: 'pointer' }}
                        >
                          COMMANDER
                        </div>
                        <div
                          className="commander-indicator-title"
                          onClick={exitCommanderDamageMode}
                          style={{ cursor: 'pointer' }}
                        >
                          DAMAGE
                        </div>
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
                      // In quick play mode, show winner modal then auto-reset
                      if (isQuickPlay) {
                        setQuickPlayWinner(player);
                      } else {
                        // Normal mode: save match and go to winner screen
                        const finalState = { ...gameState, elapsedSeconds: timer };
                        onGameComplete(player.position, finalState);
                      }
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

      {/* Quick Play Winner Modal */}
      {quickPlayWinner && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-[1000] p-4">
          <div className="bg-gradient-to-br from-[#1a1b1e] to-[#2c2e33] border-2 border-[#667eea] rounded-[20px] p-8 max-w-[500px] w-full text-center animate-[scaleIn_0.3s_ease-out]">
            {/* Crown Icon */}
            <div className="mb-6 flex justify-center">
              <div className="w-24 h-24 rounded-full bg-gradient-to-br from-[#667eea] to-[#764ba2] flex items-center justify-center">
                <Crown size={48} className="text-[#FFD700]" />
              </div>
            </div>

            {/* Winner Text */}
            <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-[#FFD700] to-[#FFA500] bg-clip-text text-transparent">
              {quickPlayWinner.playerName} Wins!
            </h1>
            <p className="text-[#9ca3af] text-lg mb-6">
              Congratulations! 🎉
            </p>

            {/* Play Again Button */}
            <button
              className="w-full py-4 px-8 bg-gradient-to-br from-[#10b981] to-[#059669] border-none rounded-[8px] text-white text-base font-semibold cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-[0_4px_12px_rgba(16,185,129,0.4)]"
              onClick={() => {
                if (onReset) {
                  onReset();
                }
              }}
            >
              Play Again
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default ActiveGame;
