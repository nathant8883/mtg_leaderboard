import { useCallback, useEffect, useRef, useState } from 'react';

const DEFAULT_HOLD_DELAY = 500;
const DEFAULT_REPEAT_INTERVAL = 500;

export interface PressConfig {
  /** Fired on each step. `isHold` is false for a single tap, true for an accelerated hold-repeat step. */
  onStep: (isHold: boolean) => void;
  /** ms to wait before the hold-repeat begins. Default 500. */
  holdDelay?: number;
  /** ms between hold-repeat steps. Default 500. */
  repeatInterval?: number;
}

interface ActivePress {
  visualKey: string;
  didHold: boolean;
  holdTimer: ReturnType<typeof setTimeout>;
  repeatTimer: ReturnType<typeof setInterval> | null;
  config: PressConfig;
}

/**
 * Press-and-hold input for tactile +/- buttons, built on Pointer Events.
 *
 * Why this exists (replaces ad-hoc mouse+touch handlers + shared hold refs):
 *  - Multi-touch: one press is tracked per pointerId, so several players can
 *    hold buttons at once on a shared center-of-table device. The old code kept
 *    a single set of hold refs, so a second press cancelled the first.
 *  - Un-stickable: releases/cancels are resolved at the window level, so a press
 *    can never strand its repeat timer if the finger lifts off the (narrow)
 *    button, the OS steals the gesture (notification, edge-swipe -> pointercancel),
 *    or the button unmounts mid-press.
 *  - No double-fire: pointer events unify mouse + touch, removing the synthesized
 *    mouse events that could count a single tap twice.
 *  - Tap vs. hold is decided purely by whether the repeat fired, deleting the
 *    brittle elapsed-time thresholds that occasionally dropped taps.
 */
export function usePressAndHold() {
  const pressesRef = useRef<Map<number, ActivePress>>(new Map());
  const [activeKeys, setActiveKeys] = useState<Set<string>>(new Set());

  const setKeyActive = useCallback((key: string, active: boolean) => {
    setActiveKeys((prev) => {
      if (active === prev.has(key)) return prev;
      const next = new Set(prev);
      if (active) next.add(key);
      else next.delete(key);
      return next;
    });
  }, []);

  const endPress = useCallback((pointerId: number, fireTap: boolean) => {
    const press = pressesRef.current.get(pointerId);
    if (!press) return;
    clearTimeout(press.holdTimer);
    if (press.repeatTimer !== null) clearInterval(press.repeatTimer);
    pressesRef.current.delete(pointerId);
    setKeyActive(press.visualKey, false);
    // A tap only counts if the hold-repeat never kicked in.
    if (fireTap && !press.didHold) press.config.onStep(false);
  }, [setKeyActive]);

  // Resolve every release/cancel globally so a press is never stranded, even if
  // the pointer is lifted away from the button or the gesture is interrupted.
  useEffect(() => {
    const presses = pressesRef.current;
    const handleUp = (e: PointerEvent) => endPress(e.pointerId, true);
    const handleCancel = (e: PointerEvent) => endPress(e.pointerId, false);
    window.addEventListener('pointerup', handleUp);
    window.addEventListener('pointercancel', handleCancel);
    return () => {
      window.removeEventListener('pointerup', handleUp);
      window.removeEventListener('pointercancel', handleCancel);
      presses.forEach((press) => {
        clearTimeout(press.holdTimer);
        if (press.repeatTimer !== null) clearInterval(press.repeatTimer);
      });
      presses.clear();
    };
  }, [endPress]);

  /** Cancel all in-flight presses without firing a tap (e.g. when a swipe wins the gesture). */
  const cancelAll = useCallback(() => {
    Array.from(pressesRef.current.keys()).forEach((id) => endPress(id, false));
  }, [endPress]);

  /**
   * Pointer handlers to spread onto a button. `visualKey` identifies the button
   * for active-state styling (e.g. "1:plus"). Release is handled on window, so
   * only pointerdown is bound here.
   */
  const getPointerHandlers = useCallback(
    (visualKey: string, config: PressConfig) => ({
      onPointerDown: (e: React.PointerEvent) => {
        // Defensively clear any stale press for this pointer id.
        endPress(e.pointerId, false);

        const holdDelay = config.holdDelay ?? DEFAULT_HOLD_DELAY;
        const repeatInterval = config.repeatInterval ?? DEFAULT_REPEAT_INTERVAL;

        const press: ActivePress = {
          visualKey,
          didHold: false,
          repeatTimer: null,
          config,
          holdTimer: setTimeout(() => {
            press.didHold = true;
            config.onStep(true);
            press.repeatTimer = setInterval(() => config.onStep(true), repeatInterval);
          }, holdDelay),
        };
        pressesRef.current.set(e.pointerId, press);
        setKeyActive(visualKey, true);
      },
    }),
    [endPress, setKeyActive],
  );

  const isActive = useCallback((visualKey: string) => activeKeys.has(visualKey), [activeKeys]);

  return { getPointerHandlers, isActive, cancelAll };
}
