import { useRef, useCallback } from 'react';
import type { TouchEvent, MouseEvent } from 'react';

interface LongPressOptions {
  onLongPress: () => void;
  delay?: number; // Time in ms before long press triggers
  repeatInterval?: number; // Time in ms between repeats while held
}

export function useLongPress({ onLongPress, delay = 500, repeatInterval = 100 }: LongPressOptions) {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isLongPressRef = useRef(false);

  const start = useCallback(() => {
    isLongPressRef.current = false;

    // Initial long press trigger
    timeoutRef.current = setTimeout(() => {
      isLongPressRef.current = true;
      onLongPress();

      // Start repeat interval
      intervalRef.current = setInterval(() => {
        onLongPress();
      }, repeatInterval);
    }, delay);
  }, [onLongPress, delay, repeatInterval]);

  const clear = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    isLongPressRef.current = false;
  }, []);

  const onTouchStart = useCallback(
    (_e: TouchEvent) => {
      start();
    },
    [start]
  );

  const onTouchEnd = useCallback(
    (_e: TouchEvent) => {
      clear();
    },
    [clear]
  );

  const onMouseDown = useCallback(
    (_e: MouseEvent) => {
      start();
    },
    [start]
  );

  const onMouseUp = useCallback(
    (_e: MouseEvent) => {
      clear();
    },
    [clear]
  );

  const onMouseLeave = useCallback(
    (_e: MouseEvent) => {
      clear();
    },
    [clear]
  );

  return {
    onTouchStart,
    onTouchEnd,
    onMouseDown,
    onMouseUp,
    onMouseLeave,
  };
}
