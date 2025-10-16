import { useRef, useCallback, TouchEvent, MouseEvent } from 'react';

interface LongPressOptions {
  onLongPress: () => void;
  delay?: number; // Time in ms before long press triggers
  repeatInterval?: number; // Time in ms between repeats while held
}

export function useLongPress({ onLongPress, delay = 500, repeatInterval = 100 }: LongPressOptions) {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
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
    (e: TouchEvent) => {
      start();
    },
    [start]
  );

  const onTouchEnd = useCallback(
    (e: TouchEvent) => {
      clear();
    },
    [clear]
  );

  const onMouseDown = useCallback(
    (e: MouseEvent) => {
      start();
    },
    [start]
  );

  const onMouseUp = useCallback(
    (e: MouseEvent) => {
      clear();
    },
    [clear]
  );

  const onMouseLeave = useCallback(
    (e: MouseEvent) => {
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
