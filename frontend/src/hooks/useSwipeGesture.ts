import { useRef } from 'react';
import type { TouchEvent } from 'react';

interface SwipeHandlers {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onSwipeUp?: () => void;
  onSwipeDown?: () => void;
}

const SWIPE_THRESHOLD = 50; // Minimum distance in pixels to register as swipe

export function useSwipeGesture(handlers: SwipeHandlers) {
  const touchStart = useRef<{ x: number; y: number } | null>(null);

  const onTouchStart = (e: TouchEvent) => {
    touchStart.current = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY,
    };
  };

  const onTouchEnd = (e: TouchEvent) => {
    if (!touchStart.current) return;

    const touchEnd = {
      x: e.changedTouches[0].clientX,
      y: e.changedTouches[0].clientY,
    };

    const deltaX = touchEnd.x - touchStart.current.x;
    const deltaY = touchEnd.y - touchStart.current.y;

    // Determine if horizontal or vertical swipe
    if (Math.abs(deltaX) > Math.abs(deltaY)) {
      // Horizontal swipe
      if (Math.abs(deltaX) > SWIPE_THRESHOLD) {
        if (deltaX > 0) {
          handlers.onSwipeRight?.();
        } else {
          handlers.onSwipeLeft?.();
        }
      }
    } else {
      // Vertical swipe
      if (Math.abs(deltaY) > SWIPE_THRESHOLD) {
        if (deltaY > 0) {
          handlers.onSwipeDown?.();
        } else {
          handlers.onSwipeUp?.();
        }
      }
    }

    touchStart.current = null;
  };

  return {
    onTouchStart,
    onTouchEnd,
  };
}
